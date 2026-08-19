from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import connect, disconnect, get_pool
from app.routers import isochrone, nearest, neighbourhood, parcel


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect()
    yield
    await disconnect()


app = FastAPI(
    title="Spatial Explorer API",
    description=(
        "Nearest-amenity search, parcel/zoning lookup, and isochrone generation "
        "on top of PostgreSQL + PostGIS."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(nearest.router)
app.include_router(parcel.router)
app.include_router(isochrone.router)
app.include_router(neighbourhood.router)


@app.get("/api/health")
async def health():
    pool = get_pool()
    async with pool.acquire() as conn:
        version = await conn.fetchval("SELECT postgis_full_version();")
    return {"status": "ok", "postgis": version}
