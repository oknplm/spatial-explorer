-- =========================================================
-- Core schema for the nearest-amenity / isochrone explorer
-- SRID 4326 (WGS84) everywhere; distance math casts to
-- ::geography so results come back in real meters, not degrees.
-- =========================================================

CREATE TABLE IF NOT EXISTS amenities (
    id            BIGSERIAL PRIMARY KEY,
    osm_id        BIGINT,                     -- NULL for synthetic seed rows
    name          TEXT,
    amenity_type  TEXT NOT NULL,               -- 'hospital', 'school', 'park', 'pharmacy', ...
    tags          JSONB DEFAULT '{}'::jsonb,
    geom          GEOMETRY(Point, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS parcels (
    id            BIGSERIAL PRIMARY KEY,
    apn           TEXT UNIQUE,                 -- assessor's parcel number
    zoning_code   TEXT NOT NULL,               -- Toronto Zoning By-law 569-2013 categories
    zoning_desc   TEXT,
    land_use      TEXT,
    area_sqm      DOUBLE PRECISION,
    geom          GEOMETRY(Polygon, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS neighbourhoods (
    id            BIGSERIAL PRIMARY KEY,
    area_code     TEXT UNIQUE,                 -- City of Toronto neighbourhood area code
    name          TEXT NOT NULL,
    geom          GEOMETRY(Polygon, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS flood_zones (
    id            BIGSERIAL PRIMARY KEY,
    zone_type     TEXT NOT NULL,               -- 'AE', 'X', 'A', ... (FEMA-style codes)
    description   TEXT,
    geom          GEOMETRY(MultiPolygon, 4326) NOT NULL
);

-- Simple road centerlines, used only as backdrop context for the
-- fallback (non-ORS) isochrone approximation and map styling.
CREATE TABLE IF NOT EXISTS roads (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT,
    road_type     TEXT,
    geom          GEOMETRY(LineString, 4326) NOT NULL
);

COMMENT ON TABLE amenities IS 'Points of interest loaded from OSM (osm2pgsql) or curated real-world seed data';
COMMENT ON TABLE parcels IS 'Land parcels with zoning classification';
COMMENT ON TABLE flood_zones IS 'Flood hazard zone polygons for overlap analysis';
COMMENT ON TABLE neighbourhoods IS 'Official City of Toronto neighbourhood boundaries';
