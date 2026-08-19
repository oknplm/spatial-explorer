-- Runs last (alphabetically) so the planner has fresh stats
-- once every table actually has rows in it.
ANALYZE amenities;
ANALYZE parcels;
ANALYZE flood_zones;
ANALYZE roads;
ANALYZE neighbourhoods;
