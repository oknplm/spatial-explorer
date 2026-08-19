from fastapi import APIRouter

from app.database import get_pool
from app.schemas import IsochroneRequest, IsochroneResponse
from app.services import isochrone_service

router = APIRouter(prefix="/api/isochrone", tags=["isochrone"])


@router.post("", response_model=IsochroneResponse)
async def isochrone(req: IsochroneRequest):
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await isochrone_service.get_isochrone(
            conn, lat=req.lat, lon=req.lon, minutes=req.minutes, profile=req.profile
        )

    return IsochroneResponse(
        source=result["source"],
        profile=req.profile,
        minutes=req.minutes,
        geometry=result["geometry"],
        note=result["note"],
    )
