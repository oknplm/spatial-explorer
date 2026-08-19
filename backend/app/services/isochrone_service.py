"""
Isochrone generation.

Real isochrones (true "how far can I walk/drive in N minutes" polygons,
following the actual street network) require a routing engine. We call
OpenRouteService's isochrones API for that.

If no ORS_API_KEY is configured, we fall back to a PostGIS-only
approximation: a geodesic buffer around the point sized by
`assumed_speed * minutes`. This is clearly labeled as an approximation
in the API response (it's a circle, not a network-aware polygon) but
means the endpoint still works and still demonstrates ST_Buffer over
::geography for correct real-world distances.
"""

import json

import httpx

from app.config import settings

ORS_ISOCHRONES_URL = "https://api.openrouteservice.org/v2/isochrones/{profile}"

# meters/second, rough average speeds used only by the fallback approximation
_ASSUMED_SPEED_MPS = {
    "walking": 1.4,   # ~5 km/h
    "cycling": 4.2,   # ~15 km/h
    "driving": 11.1,  # ~40 km/h, urban average with lights/turns
}

_ORS_PROFILE = {
    "walking": "foot-walking",
    "cycling": "cycling-regular",
    "driving": "driving-car",
}


async def get_isochrone(conn, lat: float, lon: float, minutes: int, profile: str) -> dict:
    if settings.ors_api_key:
        geometry = await _fetch_from_ors(lat, lon, minutes, profile)
        if geometry is not None:
            return {"source": "openrouteservice", "geometry": geometry, "note": None}
        # ORS call failed (rate limit, network, etc.) -- fall through to approximation
        note = "OpenRouteService request failed; served a buffer-based approximation instead."
    else:
        note = (
            "No ORS_API_KEY configured; this is a circular buffer approximation, "
            "not a network-aware isochrone. Set ORS_API_KEY for real routing."
        )

    geometry = await _fetch_from_buffer(conn, lat, lon, minutes, profile)
    return {"source": "buffer_approximation", "geometry": geometry, "note": note}


async def _fetch_from_ors(lat: float, lon: float, minutes: int, profile: str) -> dict | None:
    ors_profile = _ORS_PROFILE[profile]
    url = ORS_ISOCHRONES_URL.format(profile=ors_profile)
    payload = {
        "locations": [[lon, lat]],
        "range": [minutes * 60],
        "range_type": "time",
    }
    headers = {"Authorization": settings.ors_api_key, "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        # ORS returns a FeatureCollection; we hand back just the first feature's geometry
        return data["features"][0]["geometry"]
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        return None


async def _fetch_from_buffer(conn, lat: float, lon: float, minutes: int, profile: str) -> dict:
    radius_m = _ASSUMED_SPEED_MPS[profile] * minutes * 60
    row = await conn.fetchrow(
        """
        SELECT ST_AsGeoJSON(
            ST_Buffer(
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3
            )::geometry
        ) AS geometry;
        """,
        lon,
        lat,
        radius_m,
    )
    # asyncpg returns plain text here (no ::json cast), and even with one
    # it hands back a str, not a dict -- parse it explicitly rather than
    # relying on an implicit conversion that doesn't actually happen.
    return json.loads(row["geometry"])
