# Discoveries & Decisions

- The provided 3 CSV datasets are remarkably clean with 21 unique hospital records, no missing values, and consistent 'Yes'/'No' flags.
- Image spreadsheet maps successfully by `hospital_name`.
- We will use SQLite for local auth and hold persistence.

## Hybrid Road Routing Implementation
- Integrated zero-key public OSRM Table and Route APIs.
- Replaced straight-line distance with actual road distance (km) as physical risk decrement in mentor formula.
- Computed travel ETA (mins) and rendered driving polyline on Leaflet OpenStreetMap tiles.
- Added calibrated urban circuity model (1.28x Haversine @ 28 km/h) as offline safety net.
