import sys
import os
import sqlite3
import logging
import time
from pathlib import Path

from starlette.middleware.trustedhost import TrustedHostMiddleware

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from db.database import get_connection, init_db
from api.hospitals import router as hospitals_router
from api.requests import router as requests_router
from api.chatbot import router as chat_router
from api.auth import router as auth_router

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("arogyasetu.http")

APP_ENV = os.getenv("APP_ENV", "development").lower()
if APP_ENV not in {"development", "production"}:
    raise RuntimeError("APP_ENV must be either 'development' or 'production'.")

ALLOWED_HOSTS = [host.strip() for host in os.getenv("ALLOWED_HOSTS", "").split(",") if host.strip()]
if APP_ENV == "production":
    database_path = os.getenv("DATABASE_PATH", "")
    if not database_path or not Path(database_path).is_absolute():
        raise RuntimeError("Set DATABASE_PATH to an absolute persistent database path in production.")
    if not ALLOWED_HOSTS:
        raise RuntimeError("Set ALLOWED_HOSTS to the public hostnames before starting in production.")

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "" if APP_ENV == "production"
        else "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

init_db()

app = FastAPI(
    title="Nearest Hospital Recommender API",
    description="Backend API for Bhubaneswar Hospital Recommender",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "X-Hospital-Staff-Token"],
)
if APP_ENV == "production":
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)

app.include_router(hospitals_router)
app.include_router(hospitals_router, prefix="/api")
app.include_router(requests_router)
app.include_router(chat_router)
app.include_router(auth_router)


@app.middleware("http")
async def log_http_requests(request, call_next):
    started_at = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "http_request_failed method=%s path=%s",
            request.method,
            request.url.path,
            extra={"method": request.method, "path": request.url.path},
        )
        raise
    duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
    logger.info(
        "http_request method=%s path=%s status=%s duration_ms=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    return response

project_root = Path(__file__).resolve().parent.parent
frontend_dist = project_root / "frontend" / "dist"


@app.get("/api/health")
def health():
    conn = get_connection()
    try:
        conn.execute("SELECT 1")
    except sqlite3.Error as error:
        raise HTTPException(status_code=503, detail="Database is unavailable.") from error
    finally:
        conn.close()
    return {"status": "healthy", "database": "reachable"}


@app.get("/")
def root():
    if frontend_dist.exists() and (frontend_dist / "index.html").exists():
        return FileResponse(frontend_dist / "index.html")
    return {
        "status": "online",
        "city": "Bhubaneswar",
        "message": "Nearest Hospital Recommender API is running.",
    }


if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")
    app.mount("/hospitals", StaticFiles(directory=str(project_root / "frontend" / "public" / "hospitals")), name="hospital-images")

    @app.get("/{path:path}")
    async def frontend_fallback(path: str):
        if path.startswith("api"):
            raise HTTPException(status_code=404, detail="API route not found")
        index_file = frontend_dist / "index.html"
        if not index_file.exists():
            return JSONResponse({"error": "Frontend build not found. Run npm run build in frontend/"}, status_code=503)
        requested_path = (frontend_dist / path)
        if requested_path.exists() and requested_path.is_file():
            return FileResponse(requested_path)
        return FileResponse(index_file)
else:
    @app.get("/{path:path}")
    async def frontend_missing(path: str):
        return JSONResponse({
            "error": "Frontend build is missing. Run npm install and npm run build in frontend/ before production deployment.",
            "path": path,
        }, status_code=503)
