-- =========================================================
-- Indexes. GIST on every geometry column is what makes
-- ST_DWithin / ST_Intersects / the KNN "<->" operator fast
-- instead of doing a sequential scan over the whole table.
-- =========================================================

-- Spatial indexes
CREATE INDEX IF NOT EXISTS idx_amenities_geom   ON amenities   USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_parcels_geom     ON parcels     USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_flood_zones_geom ON flood_zones USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_roads_geom       ON roads       USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_neighbourhoods_geom ON neighbourhoods USING GIST (geom);

-- Attribute indexes for common filters
CREATE INDEX IF NOT EXISTS idx_amenities_type   ON amenities (amenity_type);
CREATE INDEX IF NOT EXISTS idx_amenities_name_trgm ON amenities USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parcels_zoning   ON parcels (zoning_code);
CREATE INDEX IF NOT EXISTS idx_parcels_apn      ON parcels (apn);
