import json

from fastapi import APIRouter, Query

from app.database import get_pool
from app.schemas import Neighbourhood

router = APIRouter(prefix="/api/neighbourhoods", tags=["neighbourhoods"])

_BBOX_SQL = """
    SELECT id, area_code, name, ST_AsGeoJSON(geom)::json AS geometry
    FROM neighbourhoods
    WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
    LIMIT $5;
"""

# Point-in-polygon lookup, used by the parcel detail endpoint to answer
# "which neighbourhood is this?" via ST_Contains.
_CONTAINS_SQL = """
    SELECT name
    FROM neighbourhoods
    WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
    LIMIT 1;
"""


@router.get("", response_model=list[Neighbourhood])
async def list_neighbourhoods_in_viewport(
    min_lon: float = Query(...),
    min_lat: float = Query(...),
    max_lon: float = Query(...),
    max_lat: float = Query(...),
    limit: int = Query(300, gt=0, le=300),
):
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(_BBOX_SQL, min_lon, min_lat, max_lon, max_lat, limit)
    return [
        Neighbourhood(
            id=r["id"],
            area_code=r["area_code"],
            name=r["name"],
            geometry=json.loads(r["geometry"]),
        )
        for r in rows
    ]
