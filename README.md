# Spatial Explorer — Toronto

A spatial query API and map UI that answers three questions city planners,
real-estate teams, and civic-tech tools actually need answered: *what's
nearby, what's this parcel zoned for, and how far can someone actually get
in N minutes.* Built on PostgreSQL + PostGIS, FastAPI, and React + MapLibre,
running on real Toronto geography.


Most public GIS portfolio projects are either a static map screenshot or a
Jupyter notebook that computes something once and stops. Neither answers
the question a hiring manager or a real user actually has: *can this system
answer a spatial question fast, correctly, and repeatably, for arbitrary
input, at city scale?*

Concretely, the underlying questions are ones real systems answer every
day:
- **"What's the nearest hospital/school/park to this address?"** — used by
  emergency dispatch, real-estate listings, and 311-style city services.
- **"What can I build on this parcel, and is it at flood risk?"** — used by
  planning departments and property due-diligence tools.
- **"What's actually reachable from here in 15 minutes?"** — used by
  walkability scoring, transit planning, and site-selection tools. Note
  this is *not* the same as "what's within a 1km circle" — straight-line
  distance routinely lies about real accessibility (a river or a highway
  can make something 200m away a 15-minute detour).

A working API + map UI with four query types, all backed by indexed
PostGIS spatial SQL rather than client-side approximation:

| Endpoint | What it answers |
|---|---|
| `GET /api/nearest` | Nearest N amenities of a given type within a radius, ranked by real geodesic distance |
| `GET /api/parcels/{id}` | A parcel's zoning, whether it overlaps a flood zone, which of Toronto's 140 real neighbourhoods it's in, and what's nearby |
| `POST /api/isochrone` | A travel-time polygon for walking/cycling/driving — real network-aware routing via OpenRouteService, with a labeled fallback if no API key is set |
| `GET /api/neighbourhoods` | Real City of Toronto neighbourhood boundaries for the current map viewport |

## Tech stack

- **Database:** PostgreSQL 16 + PostGIS 3.4 — GIST-indexed geometry columns, `ST_DWithin`/`<->` KNN/`ST_Intersects`/`ST_Contains` doing the actual work, not an app-layer approximation
- **Backend:** FastAPI + `asyncpg` — async, auto-generated OpenAPI docs, spatial SQL written explicitly (no ORM geometry abstraction hiding what's actually happening)
- **Frontend:** React + MapLibre GL — no API key needed for the basemap (unlike Mapbox)
- **Routing:** OpenRouteService for real isochrones, with a documented PostGIS-only fallback
- **Deployment:** Docker Compose (one command: DB + API + frontend)

## Architecture / Workflow

```
┌─────────────┐      HTTP/JSON       ┌──────────────┐      asyncpg       ┌──────────────┐
│  React +     │  ───────────────►   │   FastAPI     │  ───────────────► │  PostgreSQL   │
│  MapLibre GL │  ◄───────────────   │   backend     │  ◄─────────────── │  + PostGIS    │
└─────────────┘     GeoJSON          └──────┬───────┘      SQL           └──────────────┘
                                             │
                                             │ HTTPS (optional)
                                             ▼
                                   OpenRouteService API
                                   (real isochrones; falls
                                    back to ST_Buffer if no
                                    API key is configured)
```

**Query design, spelled out:**

- **Nearest amenity** — `ST_DWithin` does the radius filter (index-accelerated
  bounding-box check first), the `<->` KNN operator does nearest-first
  ordering (also index-accelerated), and a separate `ST_Distance(::geography)`
  call gets the real geodesic distance in meters for display — `<->` alone
  is a fast planar approximation, fine for ordering, not for the number you
  show the user.
- **Parcel detail** — `geom && ST_MakeEnvelope(...)` for the viewport bbox
  (the `&&` operator is what actually hits the GIST index),
  `ST_Intersects` for flood-zone overlap, `ST_Contains(neighbourhood, ST_Centroid(parcel))`
  for point-in-polygon neighbourhood lookup, and a second `ST_DWithin` for
  nearby amenities.
- **Isochrone** — calls OpenRouteService if `ORS_API_KEY` is set; otherwise
  falls back to `ST_Buffer(point::geography, assumed_speed * minutes)` and
  labels the response `source: "buffer_approximation"` so nobody mistakes
  a circle for a real network-aware polygon.

## Demo


```
GET /api/nearest?lat=43.6552&lon=-79.3762&type=hospital&radius_m=5000&limit=3

{
  "query_point": {"lat": 43.6552, "lon": -79.3762},
  "count": 3,
  "results": [
    {"name": "St. Michael's Hospital",      "distance_m": 206.4},
    {"name": "Hospital for Sick Children",  "distance_m": 937.5},
    {"name": "Toronto General Hospital",    "distance_m": 1122.4}
  ]
}

GET /api/parcels/500

{
  "parcel": {"apn": "TOR-00500", "zoning_code": "R", "zoning_desc": "Residential"},
  "in_flood_zone": false,
  "neighbourhood": "Waterfront Communities-The Island",
  "nearby_amenities": [
    {"name": "Distillery District",        "distance_m": 72.1},
    {"name": "Distillery District Market", "distance_m": 102.0}
  ]
}
```

Both are correct: parcel 500's centroid genuinely falls inside the
"Waterfront Communities-The Island" neighbourhood polygon, and the nearest
hospital to a Riverdale-area point genuinely is St. Michael's.

Run `docker compose up` locally and `scripts/record_demo.js` will drive the
UI through all three modes and produce a GIF at `scripts/demo-output/demo.gif`.

## Results

The headline number, benchmarked directly against
this database, comparing the identical nearest-amenity query with and
without the GIST index, on a synthetic 500,000-row table sized to match a
full-region OSM amenities load (Toronto's actual OSM POI count is in that
range):

| | Execution time | Query plan |
|---|---|---|
| Without spatial index | **771 ms** | Parallel sequential scan, 165K+ rows filtered row-by-row |
| With GIST index | **0.25 ms** | Index scan, walks straight to the nearby rows |

**~3,000x faster**, with `EXPLAIN (ANALYZE, BUFFERS)` output to back it up
(JIT compilation disabled for a fair comparison; see git history / ask if
you want the raw plan output). This is the concrete reason the schema
insists on a GIST index on every geometry column, not just a stylistic
choice.

At the seed-data scale actually loaded (26 amenities, 1,482 parcels, 140
neighbourhoods), Postgres' planner correctly chooses sequential scans
instead — worth noting honestly, since blindly expecting "index scan
everywhere" on a tiny table would itself be a red flag. The 140-row
`neighbourhoods` table does show an index scan for the point-in-polygon
query even at this size, since GIST's bounding-box pre-filter pays off
sooner for irregular polygon geometry than for point tables.

## Run

```bash
git clone <this repo>
cd spatial-explorer
cp .env.example .env        # optional: add an ORS_API_KEY for real isochrones
docker compose up --build
```

- Frontend: http://localhost:5173
- API docs (Swagger UI): http://localhost:8000/docs
- Postgres: `localhost:5432`, user `spatial` / password `spatial`, db `spatial_explorer`

First boot loads real City of Toronto neighbourhood boundaries, real named
amenities at their actual coordinates, a parcel grid over a real downtown
extent using Toronto's actual Zoning By-law 569-2013 category codes, and a
flood buffer along the real Don River corridor. See the
[data provenance table](#data-provenance) below for exactly what's real vs.
illustrative, and `scripts/load_osm.sh` for loading a full OSM extract.

### Local dev without Docker

```bash
# DB
psql -h localhost -U spatial -d spatial_explorer -f db/init/01_extensions.sql
psql -h localhost -U spatial -d spatial_explorer -f db/init/02_schema.sql
psql -h localhost -U spatial -d spatial_explorer -f db/init/03_indexes.sql
psql -h localhost -U spatial -d spatial_explorer -f db/init/04_seed_data.sql
psql -h localhost -U spatial -d spatial_explorer -f db/init/05_neighbourhoods.sql
psql -h localhost -U spatial -d spatial_explorer -f db/init/06_analyze.sql

# Backend
cd backend && pip install -r requirements.txt
export DATABASE_URL=postgresql://spatial:spatial@localhost:5432/spatial_explorer
uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

### Data provenance

| Table | Data | Source |
|---|---|---|
| `neighbourhoods` |  all 140 official City of Toronto neighbourhood boundaries | City of Toronto Open Data, via `jasonicarter/toronto-geojson`; simplified for file size, topology preserved |
| `amenities` |  ~25 well-known Toronto POIs at actual coordinates | Hand-curated, not exhaustive — run `scripts/load_osm.sh` for full OSM-scale coverage |
| `parcels` | Synthetic grid | Clipped to a real downtown-Toronto/Riverdale bbox, tagged with real Zoning By-law 569-2013 codes (R, RM, CR, CL, E, I, O); cell-to-code assignment is illustrative |
| `flood_zones` | Approximate buffer | Follows the real Don River corridor path; not authoritative TRCA floodplain mapping |

