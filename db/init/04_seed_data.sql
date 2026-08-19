-- =========================================================
-- Toronto-anchored seed data.
--
-- amenities  : curated list of real, well-known Toronto points of
--              interest with their actual approximate coordinates
--              (hospitals, universities, libraries, parks, landmarks).
--              This is a hand-picked highlights list, NOT exhaustive
--              OSM-scale coverage -- for that, run scripts/load_osm.sh
--              against a real Toronto extract, which will supersede
--              these rows.
-- parcels    : a synthetic grid clipped to a real downtown-Toronto /
--              Riverdale bounding box, using Toronto's actual Zoning
--              By-law 569-2013 category codes (R, RM, CR, CL, E, I, O).
--              Individual cell-to-code assignment is illustrative, not
--              the official zoning map -- see README for how to load
--              real parcel/zoning data from the City's open-data portal.
-- flood_zones: an approximate buffer around the real Don River corridor
--              (a genuine flood-prone area in Toronto), for demo
--              purposes only -- not authoritative FEMA/conservation-
--              authority floodplain mapping.
-- neighbourhoods (05_neighbourhoods.sql): real City of Toronto
--              neighbourhood boundaries, unmodified apart from
--              geometry simplification.
-- =========================================================

SELECT setseed(0.42);

-- ---------------------------------------------------------
-- Amenities: real Toronto POIs, real approximate coordinates.
-- ---------------------------------------------------------
INSERT INTO amenities (name, amenity_type, tags, geom) VALUES
    ('Toronto General Hospital',       'hospital', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3892, 43.6588), 4326)),
    ('Mount Sinai Hospital',           'hospital', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3900, 43.6579), 4326)),
    ('Hospital for Sick Children',     'hospital', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3873, 43.6577), 4326)),
    ('St. Michael''s Hospital',        'hospital', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3775, 43.6536), 4326)),
    ('Toronto Western Hospital',       'hospital', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.4059, 43.6547), 4326)),

    ('University of Toronto (St. George)', 'school', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3957, 43.6629), 4326)),
    ('Toronto Metropolitan University',    'school', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3788, 43.6577), 4326)),
    ('George Brown College (St. James)',   'school', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3712, 43.6503), 4326)),
    ('Rose Avenue Junior Public School',   'school', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3760, 43.6677), 4326)),

    ('Toronto Reference Library',      'library', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3868, 43.6715), 4326)),
    ('Toronto Public Library - Riverdale', 'library', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3543, 43.6667), 4326)),

    ('Trinity Bellwoods Park',   'park', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.4133, 43.6467), 4326)),
    ('Riverdale Park East',      'park', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3559, 43.6677), 4326)),
    ('Withrow Park',             'park', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3479, 43.6779), 4326)),
    ('Corktown Common',          'park', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3572, 43.6553), 4326)),
    ('David Crombie Park',       'park', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3652, 43.6503), 4326)),
    ('Berczy Park',              'park', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3745, 43.6478), 4326)),

    ('St. Lawrence Market',      'grocery', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3716, 43.6487), 4326)),
    ('Distillery District Market', 'grocery', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3592, 43.6503), 4326)),

    ('CN Tower',                 'landmark', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3871, 43.6426), 4326)),
    ('Toronto City Hall',        'landmark', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3841, 43.6534), 4326)),
    ('Union Station',            'landmark', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3806, 43.6453), 4326)),
    ('Distillery District',      'landmark', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3596, 43.6503), 4326)),
    ('St. Lawrence Hall',        'landmark', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3733, 43.6497), 4326)),

    ('Toronto Police - 51 Division',  'police',       '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3719, 43.6600), 4326)),
    ('Toronto Fire Station 315',      'fire_station', '{"source":"curated_real"}', ST_SetSRID(ST_MakePoint(-79.3660, 43.6597), 4326));

-- ---------------------------------------------------------
-- Parcels: grid clipped to a real downtown-Toronto / Riverdale
-- bounding box (roughly Financial District east to across the
-- Don River), tagged with Toronto's actual Zoning By-law 569-2013
-- category codes.
-- ---------------------------------------------------------
WITH bounds AS (
    SELECT
        -79.395::double precision AS min_lon,
        43.640::double precision  AS min_lat,
        -79.352::double precision AS max_lon,
        43.672::double precision  AS max_lat
),
grid AS (
    SELECT
        x, y,
        (b.min_lon + x * 0.0011)::double precision AS lon0,
        (b.min_lat + y * 0.00085)::double precision AS lat0
    FROM bounds b
    CROSS JOIN generate_series(0, 38) AS x
    CROSS JOIN generate_series(0, 37) AS y
),
classified AS (
    SELECT
        lon0, lat0,
        -- weighted toward residential/commercial mix typical of this area,
        -- with a denser commercial band mimicking the downtown core
        (ARRAY['R','R','RM','RM','RM','CR','CR','CL','E','I','O'])[1 + floor(random()*11)::int] AS zoning_code
    FROM grid
)
INSERT INTO parcels (apn, zoning_code, zoning_desc, land_use, area_sqm, geom)
SELECT
    'TOR-' || lpad((row_number() OVER ())::text, 5, '0'),
    zoning_code,
    CASE zoning_code
        WHEN 'R'  THEN 'Residential'
        WHEN 'RM' THEN 'Residential Multiple'
        WHEN 'CR' THEN 'Commercial Residential'
        WHEN 'CL' THEN 'Commercial Local'
        WHEN 'E'  THEN 'Employment Industrial'
        WHEN 'I'  THEN 'Institutional'
        WHEN 'O'  THEN 'Open Space'
    END,
    CASE zoning_code
        WHEN 'R'  THEN 'residential'
        WHEN 'RM' THEN 'residential'
        WHEN 'CR' THEN 'mixed_use'
        WHEN 'CL' THEN 'commercial'
        WHEN 'E'  THEN 'industrial'
        WHEN 'I'  THEN 'institutional'
        WHEN 'O'  THEN 'public'
    END,
    650 + random() * 900,   -- typical downtown Toronto lot sizes are much smaller than suburban ones
    ST_SetSRID(
        ST_MakeEnvelope(lon0, lat0, lon0 + 0.0010, lat0 + 0.00078, 4326),
        4326
    )
FROM classified;

-- ---------------------------------------------------------
-- Flood zone: buffer around the real Don River corridor, which
-- runs through this part of Toronto (Riverdale / Don Valley /
-- the river mouth near the Keating Channel) and is a genuine
-- flood-prone area.
-- ---------------------------------------------------------
INSERT INTO flood_zones (zone_type, description, geom)
SELECT
    'AE',
    'Approximate floodplain buffer along the Don River corridor (demo only -- not authoritative TRCA/conservation-authority mapping)',
    ST_Multi(
        ST_Buffer(
            ST_SetSRID(
                ST_MakeLine(ARRAY[
                    ST_MakePoint(-79.3554, 43.6512),  -- river mouth / Keating Channel area
                    ST_MakePoint(-79.3559, 43.6600),
                    ST_MakePoint(-79.3565, 43.6677),  -- Riverdale
                    ST_MakePoint(-79.3540, 43.6760),
                    ST_MakePoint(-79.3490, 43.6850)
                ]),
                4326
            )::geography,
            110
        )::geometry
    );

-- ---------------------------------------------------------
-- Roads: light grid over the parcel extent, just for map context.
-- ---------------------------------------------------------
WITH h AS (
    SELECT
        'Street ' || y AS name,
        ST_SetSRID(ST_MakeLine(
            ST_MakePoint(-79.398, 43.640 + y * 0.00085),
            ST_MakePoint(-79.349, 43.640 + y * 0.00085)
        ), 4326) AS geom
    FROM generate_series(0, 37) AS y
),
v AS (
    SELECT
        'Avenue ' || x AS name,
        ST_SetSRID(ST_MakeLine(
            ST_MakePoint(-79.395 + x * 0.0011, 43.638),
            ST_MakePoint(-79.395 + x * 0.0011, 43.674)
        ), 4326) AS geom
    FROM generate_series(0, 38) AS x
)
INSERT INTO roads (name, road_type, geom)
SELECT name, 'local', geom FROM h
UNION ALL
SELECT name, 'local', geom FROM v;
