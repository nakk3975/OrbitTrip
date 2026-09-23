# Starter hotel catalog

36 named hotel branches in 16 countries and 17 cities, reviewed 2026-09-23.
This is a starter list, not complete coverage or a booking availability feed.

Names, aliases, addresses and hotel map coordinates are in `hotels.json`.
`sourceUrl` links to a checked official page where available, otherwise the OpenStreetMap location. New coordinates come from Geoapify's geocoding search (OpenStreetMap attribution), with branch names and cities reviewed individually. Map points are not surveyed entrances. Prices, ratings, photos and room availability are not copied.

Rejected matches: The Plaza New York returned a different Manhattan location; Shangri-La Sydney returned a South Australia location. Neither was imported.

Search filters by country and a 30 km radius around the selected city and accepts Korean, English and recorded local names. Registered matches are served before external search; no match falls back to the existing API. It does not represent every branch of a matching chain.

## Database status

The Neon connector currently fails with a missing project_id. The runtime role has no schema CREATE or catalog UPDATE privilege. No hotel seed has been applied to Neon. The deployed application uses the bundled snapshot until the owner migration can run.

`deploy/hotel-seed.sql` is additive and rerunnable, and grants the application SELECT only. Test on an isolated database branch, then run against OrbitTrip with the owner/migration role once the connector is restored. It preserves unrelated records. The server reads the table on a five-minute cache and uses the snapshot when the table is unavailable.
