import json

from fastapi import APIRouter, HTTPException, Query

from app.database import get_pool
from app.schemas import AmenityResult, ParcelDetail, ParcelSummary

router = APIRouter(prefix="/api/parcels", tags=["parcels"])


_BBOX_SQL = """
    SELECT id, apn, zoning_code, zoning_desc, land_use, area_sqm,
           ST_AsGeoJSON(geom)::json AS geometry
    FROM parcels
    WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)  -- && uses the GIST index
    LIMIT $5;
"""

_BY_ID_SQL = """
    SELECT id, apn, zoning_code, zoning_desc, land_use, area_sqm,
           ST_AsGeoJSON(geom)::json AS geometry
    FROM parcels
    WHERE id = $1;
"""

_FLOOD_SQL = """
    SELECT zone_type
    FROM flood_zones
    WHERE ST_Intersects(geom, (SELECT geom FROM parcels WHERE id = $1));
"""

_NEARBY_AMENITIES_SQL = """
    SELECT id, name, amenity_type, ST_Y(geom) AS lat, ST_X(geom) AS lon,
           ST_Distance(
               geom::geography,
               (SELECT ST_Centroid(geom)::geography FROM parcels WHERE id = $1)
           ) AS distance_m
    FROM amenities
    WHERE ST_DWithin(
        geom::geography,
        (SELECT ST_Centroid(geom)::geography FROM parcels WHERE id = $1),
        $2
    )
    ORDER BY distance_m
    LIMIT $3;
"""

# Point-in-polygon: which neighbourhood contains this parcel's centroid.
_NEIGHBOURHOOD_SQL = """
    SELECT n.name
    FROM neighbourhoods n, parcels p
    WHERE p.id = $1 AND ST_Contains(n.geom, ST_Centroid(p.geom))
    LIMIT 1;
"""


def _row_to_summary(r) -> ParcelSummary:
    return ParcelSummary(
        id=r["id"],
        apn=r["apn"],
        zoning_code=r["zoning_code"],
        zoning_desc=r["zoning_desc"],
        land_use=r["land_use"],
        area_sqm=r["area_sqm"],
        geometry=r["geometry"] if isinstance(r["geometry"], dict) else json.loads(r["geometry"]),
    )


@router.get("", response_model=list[ParcelSummary])
async def list_parcels_in_viewport(
    min_lon: float = Query(...),
    min_lat: float = Query(...),
    max_lon: float = Query(...),
    max_lat: float = Query(...),
    limit: int = Query(500, gt=0, le=2000),
):
    """Return parcels intersecting the current map viewport (bbox query)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(_BBOX_SQL, min_lon, min_lat, max_lon, max_lat, limit)
    return [_row_to_summary(r) for r in rows]


@router.get("/{parcel_id}", response_model=ParcelDetail)
async def get_parcel(
    parcel_id: int,
    nearby_radius_m: int = Query(400, gt=0, le=5000),
    nearby_limit: int = Query(10, gt=0, le=50),
):
    pool = get_pool()
    async with pool.acquire() as conn:
        parcel_row = await conn.fetchrow(_BY_ID_SQL, parcel_id)
        if parcel_row is None:
            raise HTTPException(status_code=404, detail=f"Parcel {parcel_id} not found")

        flood_rows = await conn.fetch(_FLOOD_SQL, parcel_id)
        amenity_rows = await conn.fetch(_NEARBY_AMENITIES_SQL, parcel_id, nearby_radius_m, nearby_limit)
        neighbourhood_row = await conn.fetchrow(_NEIGHBOURHOOD_SQL, parcel_id)

    flood_types = [r["zone_type"] for r in flood_rows]
    nearby = [
        AmenityResult(
            id=r["id"],
            name=r["name"],
            amenity_type=r["amenity_type"],
            lat=r["lat"],
            lon=r["lon"],
            distance_m=round(r["distance_m"], 1),
        )
        for r in amenity_rows
    ]

    return ParcelDetail(
        parcel=_row_to_summary(parcel_row),
        in_flood_zone=len(flood_types) > 0,
        flood_zone_types=flood_types,
        neighbourhood=neighbourhood_row["name"] if neighbourhood_row else None,
        nearby_amenities=nearby,
    )
