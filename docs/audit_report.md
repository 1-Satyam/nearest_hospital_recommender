# ArogyaSetu BBSR Audit Report

## Scope
This audit covers hospital identity reconciliation, backend data loading, API route compatibility, deterministic ranking, frontend filtering/map behavior, and production serving for Replit.

## Fixed
- Reconciled the authoritative hospital master dataset to a single 21-hospital canonical set using `BBSR001` through `BBSR021`.
- Rebuilt the unified hospital CSVs and routed backend data loading through a filesystem-safe loader that resolves files relative to the source code instead of the current working directory.
- Restored missing required fields for the backend and tests: `pmjay_gjay_empanelled`, `emergency_24x7`, `image_hero`, and alias compatibility fields.
- Normalized PM-JAY and emergency boolean handling in the API and frontend filter logic.
- Repaired the hospital ranking API to return deterministic scores and JSON-safe records without `NaN` or NumPy scalars.
- Fixed single-port production serving so FastAPI hosts both the API and the compiled frontend from `frontend/dist/`.
- Updated the frontend dashboard to keep the map, cards, and filters consistent while preserving the default initial display of 10 hospitals from the 21-record dataset.
- Added the general-ward vacancy percentage to the API response and displayed it consistently in hospital cards, comparison rows, and the ward-booking pane; the value is calculated as available beds divided by total beds.
- Added concise PM-JAY eligibility and 24x7 emergency indicators to the hospital card.
- Added a Gradient Boosting 24-hour availability forecast demo to the card. It trains and validates on generated synthetic inventory sequences, and is explicitly marked non-operational and synthetic in both the API and UI.
- Connected general admission bookings to backend-created, OTP-verified holds; emergency and general bookings now share server expiry timestamps and admitted/declined lifecycle actions.
- Added an expiry-based countdown to the active hold view and account ledger, plus backend checks that prevent admitting or declining a hold after it expires or has already reached a terminal status.
- Added Replit startup configuration via `run.sh` and `.replit`.

## Data integrity
- Master hospital count: 21
- Unique canonical IDs: 21
- Specialty-bed rows mirrored: 169
- Canonical hospital ID coverage across master, PM-JAY, specialty, and image sources: complete
- Unresolved mismatches: none after normalization and join-by-ID checks

## Matching and merge decisions
- `hospital_master.csv` was treated as the authoritative source for hospital identities.
- `hospital_pmjay_status.csv` and `hospital_specialities.csv` were merged using `hospital_id`.
- `hospital_images.csv` entries were reconciled to canonical names and used to populate `image_hero` with valid public image paths such as `/hospitals/aiims.jpg`.
- Records were deduplicated on `hospital_id` to prevent one-to-many joins from creating duplicate hospital records.
- Missing data values were filled only with safe defaults without overwriting valid source values.

## Validation results
- Command: `python -m unittest backend/tests/test_core.py`
- Result: 4 tests ran, all passed.

- Command: `python -m unittest backend/tests/test_core.py backend/tests/test_api.py`
- Result: 9 tests ran, all passed.

- Command: `cd frontend && npm install && npm run build`
- Result: production build completed successfully and generated `frontend/dist/index.html` plus bundled assets.

- Runtime checks: `GET /api/stats` and `GET /api/hospitals?top_n=10` returned HTTP 200 responses with `coverage_hospitals: 21` and rank metadata for 21 hospitals, with the first 10 marked in the top-N set.
- Regression check: hospital `BBSR020` has 9 of 47 general-ward beds available, and the API reports `19.1%` vacancy.
- Forecast regression check: predictions are bounded by each hospital's bed capacity and include `forecast_mode: synthetic_demo` and `forecast_is_operational: false`.
- Bed-hold regression checks: server expiry status, decline/release, admitted status, and rejection of expired or already-resolved actions.
- Backend core and API suite after lifecycle updates: `python -m unittest backend/tests/test_core.py backend/tests/test_api.py` — 14 tests passed.

## Deployment notes
The project is configured for Replit deployment using a single public port. The exact external Replit site URL cannot be verified from this local environment, but the application is ready to launch with the configured entrypoint:

- `run.sh`
- `.replit`

The server is configured to use `PORT` with a default of `5000` and to serve the API plus the compiled frontend from the same FastAPI process.

## Known limitations
- External live Replit hosting is outside the local workspace and could not be verified here.
- The Groq-based chatbot integration is present but will gracefully fall back to the deterministic hospital-ranking response for ranking/scoring questions to preserve the required formula semantics.
- Real operational forecasting is not supported by the supplied dataset: it contains one dated inventory snapshot rather than historical time series. The displayed Gradient Boosting forecast is trained and evaluated only on synthetic demo sequences; it must not be presented as actual hospital availability or as a calibrated confidence percentage.
