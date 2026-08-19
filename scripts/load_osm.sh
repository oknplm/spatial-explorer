#!/usr/bin/env bash
# =========================================================
# Load a real OpenStreetMap extract into the running PostGIS
# database with osm2pgsql, replacing the synthetic seed data.
#
# Usage:
#   ./scripts/load_osm.sh ontario
#
# Prereqs:
#   - osm2pgsql installed (apt install osm2pgsql / brew install osm2pgsql)
#   - docker compose stack already running (`docker compose up -d db`)
#   - a Geofabrik .osm.pbf extract for your region of interest, e.g.
#     https://download.geofabrik.de/north-america/ca/ontario.html
#     (the full Ontario extract is large; clip it to the Toronto area with
#     osmium extract if you only need the GTHA)
# =========================================================
set -euo pipefail

REGION_NAME="${1:?Usage: $0 <region-name-without-extension>}"
PBF_FILE="./data/${REGION_NAME}.osm.pbf"

if [ ! -f "$PBF_FILE" ]; then
  echo "Missing $PBF_FILE"
  echo "Download an extract first, e.g.:"
  echo "  mkdir -p data && curl -L -o $PBF_FILE https://download.geofabrik.de/north-america/ca/ontario-latest.osm.pbf"
  exit 1
fi

export PGPASSWORD=spatial

echo "==> Loading $PBF_FILE with osm2pgsql (this populates osm2pgsql's own tables, e.g. planet_osm_point)"
osm2pgsql \
  --create \
  --slim \
  --host localhost \
  --port 5432 \
  --username spatial \
  --database spatial_explorer \
  --hstore \
  --output=flex \
  "$PBF_FILE"

echo "==> Normalizing OSM points of interest into the app's amenities table"
psql -h localhost -U spatial -d spatial_explorer <<'SQL'
INSERT INTO amenities (osm_id, name, amenity_type, tags, geom)
SELECT
    osm_id,
    name,
    amenity,
    hstore_to_jsonb(tags),
    ST_Transform(way, 4326)
FROM planet_osm_point
WHERE amenity IS NOT NULL
ON CONFLICT DO NOTHING;
SQL

echo "==> Done. Re-run the index/analyze step if you truncated tables first:"
echo "    psql -h localhost -U spatial -d spatial_explorer -f db/init/03_indexes.sql"
echo ""
echo "Note: parcels and flood_zones aren't in standard OSM extracts --"
echo "those typically come from your city/county's open-data GIS portal"
echo "as shapefiles, loaded with: ogr2ogr -f PostgreSQL PG:\"dbname=spatial_explorer user=spatial\" parcels.shp -nln parcels"
