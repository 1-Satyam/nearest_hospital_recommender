# Mentor Requirements

- **Architecture**: React + Vite + Tailwind, Python + FastAPI, Pandas/NumPy, SQLite.
- **Mapping**: Leaflet + Haversine + BallTree.
- **Ranking Formula**: `(availability_pct * 100) + (average_rating * review_count) - distance_km - admission_fee_inr`. Availability is the percentage of free general-ward beds out of total beds, with active bookings deducted from free-bed counts.
- **Datasets**: 3 frozen CSVs, 1 new specialty bed CSV. Sync map and table for top 10.
