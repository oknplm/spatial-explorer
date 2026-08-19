from fastapi import APIRouter, HTTPException, Query

from app.database import get_pool
from app.schemas import AmenityResult, NearestResponse

router = APIRouter(prefix="/api/nearest", tags=["nearest"])

# Query strategy:
#  - ST_DWithin(geography) does the cheap, index-accelerated radius filter
#    (uses the GIST index on amenities.geom via the geography cast bounding box).
#  - The "<->" KNN distance operator does the actual nearest-neighbor ordering,
#    which PostGIS can also satisfy with an index scan instead of sorting
#    every row in the radius.
#  - ST_Distance(::geography) recomputes the real geodesic distance in meters
#    for display, since "<->" on geometry alone is a fast-but-planar ordering.
_SQL = """
    SELECT
        id,
        name,
        amenity_type,
        ST_Y(geom) AS lat,
        ST_X(geom) AS lon,
        ST_Distance(
            geom::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) AS distance_m
    FROM amenities
    WHERE
        ($3::text IS NULL OR amenity_type = $3)
        AND ST_DWithin(
            geom::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $4
        )
    ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
    LIMIT $5;
"""


@router.get("", response_model=NearestResponse)
async def nearest(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    type: str | None = Query(None, description="Amenity type filter, e.g. 'hospital'"),
    radius_m: int = Query(5000, gt=0, le=50000, description="Search radius in meters"),
    limit: int = Query(10, gt=0, le=100),
):
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(_SQL, lon, lat, type, radius_m, limit)

    if not rows:
        # Not an error — just an empty, well-formed result set.
        return NearestResponse(query_point={"lat": lat, "lon": lon}, count=0, results=[])

    results = [
        AmenityResult(
            id=r["id"],
            name=r["name"],
            amenity_type=r["amenity_type"],
            lat=r["lat"],
            lon=r["lon"],
            distance_m=round(r["distance_m"], 1),
        )
        for r in rows
    ]
    return NearestResponse(query_point={"lat": lat, "lon": lon}, count=len(results), results=results)


@router.get("/types")
async def amenity_types():
    """List distinct amenity types currently in the DB, for populating a filter dropdown."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT amenity_type, COUNT(*) AS n FROM amenities GROUP BY amenity_type ORDER BY amenity_type;"
        )
    if not rows:
        raise HTTPException(status_code=404, detail="No amenities loaded yet")
    return [{"amenity_type": r["amenity_type"], "count": r["n"]} for r in rows]
