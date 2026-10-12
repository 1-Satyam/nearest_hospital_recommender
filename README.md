# ArogyaSetu

ArogyaSetu is a hospital discovery and bed-request demonstration for Bhubaneswar, Odisha. It helps users compare nearby hospitals, explore reported ward vacancy, and follow a request through a demo booking lifecycle.

> **Demonstration project:** Hospital inventory is CSV-backed, and the 24-hour Gradient Boosting forecast is trained on synthetic data. Neither is a live hospital feed or a confirmed reservation. In production mode, new bookings are intentionally unavailable until an SMS OTP provider is configured.

## What it does

- Lists and ranks hospitals using location, distance, fees, ratings, bed availability, specialties, emergency readiness, and PM-JAY status.
- Users can choose which hospitals appear in Top N by recommended order, road distance, admission fee, rating multiplied by review count, or general-ward vacancy, and reverse the sort direction where applicable.
- Provides a map, estimated route information, filters, and a side-by-side comparison matrix.
- Shows reported general-ward vacancy separately from the explicitly non-operational demo forecast.
- Includes account sign-in, a local demonstration bed-hold lifecycle, reservation history, and a hospital desk portal.
- Scopes hospital desk access to individually provisioned staff tokens and records lifecycle events.
- Supports light and dark themes.

## Technology

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, Leaflet |
| API | Python, FastAPI, Pydantic |
| Data and forecasting | CSV, pandas, NumPy, scikit-learn |
| Persistence | SQLite |

## Run localy

### Prerequisites

- Python 3.10 or later
- Node.js 18 or later and npm
- Windows PowerShell, Command Prompt, macOS, or Linux terminal

### 1. Install backend dependencies

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
```

On macOS/Linux, activate the environment with:

```bash
source .venv/bin/activate
```

### 2. Start the API

In one terminal, from the repository root:

```powershell
python -m uvicorn backend.main:app --reload --port 8000
```

The API is available at `http://localhost:8000`; interactive API documentation is at `http://localhost:8000/docs`.

### 3. Start the frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:3000`). The Vite development server proxies `/api` requests to the backend on port 8000.

The database is initialized automatically when the backend starts. The application reads the bundled CSV datasets; no external database, API key, or cloud account is needed for local development.

## Tests and production build

Run the backend regression tests from the repository root:

```powershell
python -m unittest backend/tests/test_core.py backend/tests/test_api.py
```

Build the frontend:

```powershell
cd frontend
npm run build
```

## API overview

The FastAPI documentation at `/docs` lists the available request and response schemas. Common endpoints include:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Check API and database availability |
| `GET /api/hospitals` | List and filter hospitals |
| `GET /api/stats` | Retrieve hospital summary metrics |
| `GET /api/specialties` | List available specialties |
| `GET /api/route` | Get route information between coordinates |
| `POST /api/auth/register` | Register an account |
| `POST /api/auth/login` | Sign in |
| `POST /api/requests/hold` | Start a bed-request hold |
| `POST /api/requests/verify` | Verify a development OTP and hold |

## Data, booking, and forecast limitations

- **Inventory:** Hospital and specialty-bed data is bundled in CSV files and is not synchronized with hospital systems. A bed request in this demo is not confirmation from a hospital.
- **Forecast:** The Gradient Boosting estimate is generated from synthetic demonstration data. It must not be used for clinical or operational decisions.
- **Booking:** Development mode returns a demonstration OTP to support local testing. Production mode rejects new holds with `503` until an SMS delivery provider is configured. Do not switch production to development to bypass this.
- **Routing:** Route distance and travel time can be approximate when external routing is unavailable; estimates are labeled in the UI.
- **Persistence and scale:** SQLite is suitable for this single-instance demonstration, not a horizontally scaled booking service.
- **Staff portal:** Staff tokens are issued operationally, scoped to one hospital, and stored as hashes. Protect issued tokens and never commit them.

Read [the deployment guide](docs/DEPLOYMENT.md) before exposing the application. It covers production configuration, staff-token administration, and known limitations. The [API contract](docs/API_CONTRACT.md) provides additional endpoint context.

## Production configuration

Production startup requires environment configuration; do not put secrets in source control:

- `APP_ENV=production`
- `DATABASE_PATH` set to an absolute path to a persistent, writable database
- `ALLOWED_HOSTS` set to the public hostnames
- Configure `CORS_ORIGINS` only if the frontend uses a separate origin
- Enable external chat or routing only after reviewing the associated data-sharing implications

Production booking remains disabled until SMS OTP delivery is integrated. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the complete deployment checklist.

## Contributing

Contributions should preserve the distinction between reported inventory, synthetic forecast estimates, and confirmed hospital data. Run the backend tests and frontend build before submitting changes. 
