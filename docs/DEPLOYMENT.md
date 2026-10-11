# Deployment Readiness

## Implemented safeguards

- Booking requests and their status actions are associated with a server-side account session. Session IDs are random, stored hashed in SQLite, expire after 12 hours, and are carried in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` when `APP_ENV=production`).
- Passwords use salted scrypt hashes. Existing accounts using the previous legacy hash are upgraded after a successful login.
- Repeated failed sign-ins are temporarily locked by mobile number; also configure request-rate limits at the edge, especially before exposing login publicly.
- A partial unique database index prevents more than one `HELD` or `ADMITTED` booking for the same hospital/bed unit. Hold verification checks and claims the bed in a serialized SQLite write transaction.
- OTPs are hashed in the database, fixed bypass codes have been removed, and verification attempts are limited. Development mode returns a demonstration OTP to the client. Production booking is deliberately rejected until an SMS OTP provider is integrated; it will not return an OTP as a substitute for delivery.
- Patient reservation history is associated with the signed-in account and loaded from the backend, rather than persisted in browser storage. The hospital desk registry requires an individual staff token, filters records to that staff member's hospital, and never returns OTP values.
- Bed status transitions are recorded in an append-only request event table. Hospital desk staff can mark admitted requests discharged, releasing the bed back to the application's available-unit view.
- SQLite uses foreign keys, a write timeout, WAL journaling, and full synchronous commits. Database and hospital-discovery errors are no longer disguised as successful empty results.
- HTTP request outcomes and booking lifecycle transitions are logged without patient names, mobile numbers, OTPs, or chat prompts. `/api/health` reports database reachability.

## Required production configuration

Set these values in the process environment or secret manager (never in frontend source):

| Variable | Requirement |
| --- | --- |
| `APP_ENV` | Set exactly to `production`. |
| `DATABASE_PATH` | Set an absolute path to a persistent, writable SQLite database outside ephemeral deployment storage. |
| `ALLOWED_HOSTS` | Comma-separated public hostnames, without schemes or ports. Required in production. |
| `CORS_ORIGINS` | Comma-separated exact origins only when the frontend is hosted on a separate origin. Leave empty for same-origin hosting. |
| `ENABLE_EXTERNAL_CHAT` | Set to `true` only after approving Groq processing of user chat messages; otherwise the local fallback is used. |
| `ENABLE_EXTERNAL_ROUTING` | Set to `true` only after approving transmission of user coordinates to the public OSRM endpoint; otherwise approximate offline routing is used in production. |

Terminate TLS at a trusted reverse proxy and ensure it forwards HTTPS correctly. The app serves the built frontend from `frontend/dist`; run `npm run build` in `frontend/` before starting the backend. Use a process supervisor, persistent backups, and monitor `/api/health` (which checks database reachability).

## Hospital staff tokens

Provision one staff token per staff identity and hospital from a trusted operator shell after configuring `DATABASE_PATH`:

```powershell
python backend\db\provision_desk_staff.py --staff-id desk-operator-17 --hospital-id BBSR001
```

The command prints a random token once; deliver it privately to that staff member. Only its hash is stored. Enter the token in the Hospital Desk Portal. Each token can view and act on requests for only its assigned hospital, and audit entries retain the staff ID. Rotate a token by provisioning the same staff ID again (use the correct hospital ID). Revoke it with:

```powershell
python backend\db\provision_desk_staff.py --staff-id desk-operator-17 --revoke
```

Do not run provisioning from a public endpoint or check staff tokens into source control.

**Live booking is not production-ready yet.** An SMS provider and delivery workflow are not included, so in production `/api/requests/hold` returns `503` rather than creating an unverifiable request. Configure an SMS provider before enabling bookings. Do not change the runtime to development to work around this.

Before applying this version to an existing database, reconcile any duplicate active records for the same hospital/bed; the unique-index migration intentionally fails rather than silently choosing which reservation to keep. Reservations created before account ownership was enforced have no reliable owner link and need manual reconciliation if they must be retained.

## Remaining limitations

- The hospital inventory remains CSV/demo-backed, including generated bed-unit rows and a sample occupied unit. A successful hold reflects this application database, not a reservation confirmed by a hospital.
- The forecast remains explicitly synthetic and non-operational; no training-data changes are included here.
- SQLite is suitable for this single-instance demonstration and its modest write volume, but is not the recommended database for a multi-instance/high-volume booking service. Use PostgreSQL plus managed migrations before scaling horizontally.
- Routing calls the public OSRM endpoint and estimates distance/time when that service is unavailable; it is not traffic-aware.
- Staff credentials are provisioned operationally with bearer tokens; there is no self-service staff login, per-role permission matrix, or token-expiry schedule. Protect token distribution and the provisioning shell.
- Optional age, gender, and clinical profile notes are currently session-memory only, not saved to the backend. Do not collect real clinical notes until appropriate storage, access controls, consent, and retention policies are implemented.
- SMS delivery, phone ownership verification at account registration, per-IP edge throttling, role-based staff permissions, and external monitoring/alerting still need production integration.
- Estimated hospital distance/ETA and approximate map routes are explicitly labeled; live routing remains dependent on the enabled OSRM integration.
