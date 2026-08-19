from typing import Any, Literal

from pydantic import BaseModel, Field


class AmenityResult(BaseModel):
    id: int
    name: str | None
    amenity_type: str
    lat: float
    lon: float
    distance_m: float = Field(..., description="Great-circle-accurate geodesic distance in meters")


class NearestResponse(BaseModel):
    query_point: dict[str, float]
    count: int
    results: list[AmenityResult]


class ParcelSummary(BaseModel):
    id: int
    apn: str | None
    zoning_code: str
    zoning_desc: str | None
    land_use: str | None
    area_sqm: float | None
    geometry: dict[str, Any]  # GeoJSON geometry


class ParcelDetail(BaseModel):
    parcel: ParcelSummary
    in_flood_zone: bool
    flood_zone_types: list[str]
    neighbourhood: str | None = None
    nearby_amenities: list[AmenityResult]


class Neighbourhood(BaseModel):
    id: int
    area_code: str | None
    name: str
    geometry: dict[str, Any]  # GeoJSON geometry


class IsochroneRequest(BaseModel):
    lat: float
    lon: float
    minutes: int = Field(15, ge=1, le=60)
    profile: Literal["walking", "driving", "cycling"] = "walking"


class IsochroneResponse(BaseModel):
    source: Literal["openrouteservice", "buffer_approximation"]
    profile: str
    minutes: int
    geometry: dict[str, Any]  # GeoJSON polygon/multipolygon
    note: str | None = None
