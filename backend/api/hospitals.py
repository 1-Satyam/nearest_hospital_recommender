import math
from typing import Any, Optional
import logging
from datetime import datetime, timezone
from fastapi import HTTPException

import pandas as pd
from fastapi import APIRouter

from data_engine.loader import load_hospitals, load_specialty_beds
from core.routing import RoutingService
from core.ranking import calculate_availability_pct, calculate_score
from core.forecasting import predict_demo_availability
from db.database import get_connection

router = APIRouter()
logger = logging.getLogger(__name__)


def calculate_haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c * 1.25, 2)


def to_bool(val: Any) -> bool:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return False
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    if isinstance(val, str):
        cleaned = val.strip().lower()
        return cleaned in {"true", "1", "yes", "y", "t", "on"}
    return False


def _safe_float(value: Any, default: float = 0.0) -> float:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return default
    try:
        numeric = float(value)
        if math.isnan(numeric) or math.isinf(numeric):
            return default
        return numeric
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    return int(_safe_float(value, default))


def _vacancy_percent(available_beds: Any, total_beds: Any) -> float:
    total = _safe_float(total_beds, 0.0)
    if total <= 0:
        return 0.0
    available = _safe_float(available_beds, 0.0)
    return round(min(100.0, max(0.0, available / total * 100.0)), 1)


def _get_active_booking_counts() -> dict[tuple[str, str], int]:
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT id, hospital_id, flow_type, patient_count, status, hold_expires_at
            FROM bed_requests
            WHERE status IN ('HELD', 'ADMITTED')
            """
        ).fetchall()
    finally:
        conn.close()

    now = datetime.now(timezone.utc)
    counts: dict[tuple[str, str], int] = {}
    for row in rows:
        if row["status"] == "HELD" and row["hold_expires_at"]:
            try:
                expiry = datetime.fromisoformat(row["hold_expires_at"])
                if expiry.tzinfo is None:
                    expiry = expiry.replace(tzinfo=timezone.utc)
                if expiry <= now:
                    continue
            except ValueError:
                logger.warning(
                    "Invalid hold expiry while calculating hospital inventory request_id=%s",
                    row["id"],
                )

        key = (str(row["hospital_id"]).strip(), str(row["flow_type"]).upper())
        count = max(1, _safe_int(row["patient_count"], 1))
        counts[key] = counts.get(key, 0) + count
    return counts


@router.get("/route")
@router.get("/api/route")
def get_route(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
):
    coordinates = (origin_lat, origin_lon, dest_lat, dest_lon)
    if not all(math.isfinite(value) for value in coordinates):
        return {"status": "error", "message": "Route coordinates must be finite numbers."}
    if not (-90 <= origin_lat <= 90 and -90 <= dest_lat <= 90):
        return {"status": "error", "message": "Latitude must be between -90 and 90 degrees."}
    if not (-180 <= origin_lon <= 180 and -180 <= dest_lon <= 180):
        return {"status": "error", "message": "Longitude must be between -180 and 180 degrees."}

    route = RoutingService.get_route_geometry(
        origin_lat=origin_lat,
        origin_lon=origin_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
    )
    return {
        "status": "success",
        "is_real_road": route.get("provider") == "OSRM OpenStreetMap Driving Engine",
        **route,
    }


@router.get("/hospitals")
@router.get("/api/hospitals")
def get_hospitals(
    lat: float = 20.2961,
    lon: float = 85.8245,
    top_n: int = 10,
    specialty: Optional[str] = None,
    pmjay_only: Any = False,
    emergency_only: Any = False,
):
    try:
        df = load_hospitals()
        if df is None or df.empty:
            return {"hospitals": [], "total_hospitals": 0, "total_displayed": 0, "top_n": int(top_n or 10)}

        result_df = df.copy()

        if "pmjay_active" not in result_df.columns:
            result_df["pmjay_active"] = result_df.get("pmjay_gjay_empanelled", "No").map(lambda value: to_bool(value))
        if "emergency_ready" not in result_df.columns:
            result_df["emergency_ready"] = result_df.get("emergency_24x7", "No").map(lambda value: to_bool(value))
        if "specialties" not in result_df.columns:
            result_df["specialties"] = "General Medicine"
        if "admission_fee_inr" not in result_df.columns:
            result_df["admission_fee_inr"] = pd.to_numeric(result_df.get("admission_fee", 0), errors="coerce").fillna(0)
        if "rating" not in result_df.columns:
            result_df["rating"] = pd.to_numeric(result_df.get("rating_5", 4.0), errors="coerce").fillna(4.0)
        if "rating_count" not in result_df.columns:
            result_df["rating_count"] = pd.to_numeric(result_df.get("review_count", 0), errors="coerce").fillna(0)
        if "emergency_available_beds" not in result_df.columns:
            result_df["emergency_available_beds"] = pd.to_numeric(result_df.get("general_ward_available_beds", 0), errors="coerce").fillna(0)
        if "address" not in result_df.columns:
            result_df["address"] = "Bhubaneswar, Odisha"

        if to_bool(pmjay_only):
            result_df = result_df[result_df["pmjay_active"].map(to_bool) | result_df["pmjay_gjay_empanelled"].map(lambda value: str(value).strip().lower() == "yes")]

        if to_bool(emergency_only):
            result_df = result_df[result_df["emergency_ready"].map(to_bool) | result_df["emergency_24x7"].map(lambda value: str(value).strip().lower() == "yes")]

        if specialty is not None:
            specialty_value = str(specialty).strip()
            if specialty_value and specialty_value.lower() not in {"", "all", "null", "none", "undefined"}:
                result_df = result_df[result_df["specialties"].fillna("").astype(str).str.contains(specialty_value, case=False, na=False)]

        if result_df.empty:
            return {"hospitals": [], "total_hospitals": 0, "total_displayed": 0, "top_n": int(top_n or 10)}

        result_df = result_df.copy()
        result_df["distance_km"] = result_df.apply(
            lambda row: calculate_haversine(
                float(lat),
                float(lon),
                _safe_float(row.get("latitude", row.get("lat", 20.2961)), 20.2961),
                _safe_float(row.get("longitude", row.get("lon", 85.8245)), 85.8245),
            ),
            axis=1,
        )
        result_df["road_distance_km"] = result_df["distance_km"]
        result_df["eta_minutes"] = result_df["distance_km"].clip(lower=0).apply(lambda value: max(3, int(round(float(value) * 2.3))))

        beds_df = load_specialty_beds()
        active_booking_counts = _get_active_booking_counts()
        results = []
        for idx, row in result_df.iterrows():
            hospital_id = str(row.get("hospital_id", f"BBSR{idx + 1:03d}"))
            general_bookings = active_booking_counts.get((hospital_id, "GENERAL_WARD"), 0)
            emergency_bookings = active_booking_counts.get((hospital_id, "EMERGENCY"), 0)
            general_beds_available = max(
                0,
                _safe_int(row.get("general_ward_available_beds", 0)) - general_bookings,
            )
            emergency_beds_available = max(
                0,
                _safe_int(
                    row.get("emergency_available_beds", row.get("general_ward_available_beds", 0))
                ) - emergency_bookings,
            )
            general_beds_total = _safe_int(row.get("general_ward_total_beds", 0))
            availability_pct = calculate_availability_pct(general_beds_available, general_beds_total)
            rating = _safe_float(row.get("rating", 4.0), 4.0)
            review_count = _safe_int(row.get("rating_count", 0), 0)
            admission_fee = _safe_int(row.get("admission_fee_inr", 0), 0)
            distance_km = _safe_float(row.get("distance_km", 0.0), 0.0)
            recommendation_score = calculate_score(
                availability_pct=availability_pct,
                rating=rating,
                review_count=review_count,
                distance_km=distance_km,
                fee=admission_fee,
            )
            rec = {
                "hospital_id": hospital_id,
                "hospital_name": str(row.get("hospital_name", "Hospital")),
                "address": str(row.get("address", "Bhubaneswar, Odisha")),
                "latitude": float(_safe_float(row.get("latitude", row.get("lat", 20.2961)), 20.2961)),
                "longitude": float(_safe_float(row.get("longitude", row.get("lon", 85.8245)), 85.8245)),
                "lat": float(_safe_float(row.get("latitude", row.get("lat", 20.2961)), 20.2961)),
                "lon": float(_safe_float(row.get("longitude", row.get("lon", 85.8245)), 85.8245)),
                "rating": rating,
                "rating_5": rating,
                "rating_count": review_count,
                "review_count": review_count,
                "admission_fee_inr": admission_fee,
                "admission_fee": admission_fee,
                "general_ward_available_beds": general_beds_available,
                "general_ward_total_beds": general_beds_total,
                "availability_pct": availability_pct,
                "general_ward_vacancy_pct": _vacancy_percent(
                    general_beds_available,
                    row.get("general_ward_total_beds", 0),
                ),
                "emergency_available_beds": emergency_beds_available,
                "distance_km": distance_km,
                "road_distance_km": float(_safe_float(row.get("road_distance_km", row.get("distance_km", 0.0)), 0.0)),
                "eta_minutes": int(_safe_int(row.get("eta_minutes", 0), 0)),
                "is_real_road": False,
                "distance_source": "Estimated straight-line distance and ETA; not live road routing",
                "score": recommendation_score,
                "mentor_score": recommendation_score,
                "pmjay_active": bool(to_bool(row.get("pmjay_active", row.get("pmjay_gjay_empanelled", "No")))),
                "pmjay_gjay_empanelled": str(row.get("pmjay_gjay_empanelled", "No")),
                "emergency_ready": bool(to_bool(row.get("emergency_ready", row.get("emergency_24x7", "No")))),
                "emergency_24x7": str(row.get("emergency_24x7", "No")),
                "specialties": str(row.get("specialties", "General Medicine")),
                "contact_phone": str(row.get("contact_phone", "+91 674 2391983")),
                "directions_url": str(row.get("directions_url", "https://maps.google.com")),
                "image_hero": str(row.get("image_hero", "/hospitals/default.jpg")),
                "specialty_inventory": [],
            }
            rec.update(predict_demo_availability(rec))

            if beds_df is not None and not beds_df.empty:
                matching = beds_df[beds_df["hospital_id"].astype(str).str.strip() == hospital_id]
                rec["specialty_inventory"] = matching.to_dict(orient="records")
                general_ward_rows = matching[
                    matching["specialty"].astype(str).str.strip().str.casefold() == "general ward"
                ]
                if not general_ward_rows.empty and "last_updated" in general_ward_rows.columns:
                    reported_dates = pd.to_datetime(general_ward_rows["last_updated"], errors="coerce", utc=True)
                    if reported_dates.notna().any():
                        rec["general_ward_reported_at"] = reported_dates.max().isoformat()

            results.append(rec)

        results.sort(
            key=lambda record: (
                -record["score"],
                record["distance_km"],
                record["hospital_id"],
            )
        )
        top_limit = max(1, int(top_n or 10))
        for index, record in enumerate(results, start=1):
            record["rank"] = index
            record["is_in_top_n"] = index <= top_limit

        return {
            "hospitals": results,
            "total_hospitals": len(results),
            "total_displayed": min(10, len(results)),
            "top_n": top_limit,
            "location": {"lat": float(lat), "lon": float(lon)},
        }
    except Exception as exc:
        logger.exception("Hospital recommendation request failed")
        raise HTTPException(status_code=503, detail="Hospital recommendations are temporarily unavailable.") from exc


@router.get("/stats")
@router.get("/api/stats")
def get_stats():
    df = load_hospitals()
    total_h = int(len(df)) if df is not None and not df.empty else 21
    active_booking_counts = _get_active_booking_counts()

    pmjay_cnt = 0
    gen_free = 0
    emerg_live = 0

    if df is not None and not df.empty:
        if "pmjay_gjay_empanelled" in df.columns:
            pmjay_cnt = int(df["pmjay_gjay_empanelled"].map(lambda value: str(value).strip().lower() == "yes").sum())
        if "general_ward_available_beds" in df.columns:
            gen_free = sum(
                max(
                    0,
                    _safe_int(row["general_ward_available_beds"])
                    - active_booking_counts.get((str(row["hospital_id"]).strip(), "GENERAL_WARD"), 0),
                )
                for _, row in df.iterrows()
            )
        if "emergency_available_beds" in df.columns:
            emerg_live = sum(
                max(
                    0,
                    _safe_int(row["emergency_available_beds"])
                    - active_booking_counts.get((str(row["hospital_id"]).strip(), "EMERGENCY"), 0),
                )
                for _, row in df.iterrows()
            )
        elif "general_ward_available_beds" in df.columns:
            emerg_live = sum(
                max(
                    0,
                    _safe_int(row["general_ward_available_beds"])
                    - active_booking_counts.get((str(row["hospital_id"]).strip(), "EMERGENCY"), 0),
                )
                for _, row in df.iterrows()
            )

    return {
        "status": "success",
        "coverage_hospitals": total_h,
        "total_hospitals": total_h,
        "emergency_live": emerg_live,
        "emergency_beds_live": emerg_live,
        "general_ward_free": gen_free,
        "general_beds_available": gen_free,
        "pmjay_empanelled": pmjay_cnt,
        "localities": ["Bhubaneswar Central", "Patia", "Sijua", "Ghatikia"],
    }


@router.get("/specialties")
@router.get("/api/specialties")
def get_specialties():
    df = load_hospitals()
    specs = set()
    if df is not None and not df.empty and "specialties" in df.columns:
        for specialty_value in df["specialties"].dropna():
            cleaned = str(specialty_value).replace(";", ",")
            for specialty in cleaned.split(","):
                token = specialty.strip()
                if token:
                    specs.add(token)
    if not specs:
        specs = {
            "General Medicine",
            "General Surgery",
            "Cardiology",
            "Orthopaedics",
            "Paediatrics",
            "Obstetrics & Gynaecology",
            "Nephrology",
            "Neurology",
            "Oncology",
            "Trauma & Critical Care",
        }
    return {"specialties": sorted(specs)}


@router.get("/geocode")
@router.get("/api/geocode")
def geocode(query: str = ""):
    hubs = {
        "iter": ("ITER Main Gate, Jagamara", 20.2505, 85.7974),
        "kiit": ("KIIT Square, Patia", 20.3547, 85.8190),
        "aiims": ("AIIMS Bhubaneswar, Sijua", 20.2317, 85.7788),
        "baramunda": ("Baramunda ISBT", 20.2780, 85.7876),
        "khandagiri": ("Khandagiri Square", 20.2588, 85.7876),
        "master canteen": ("Master Canteen, Station", 20.2668, 85.8436),
        "patia": ("Patia Infocity", 20.3588, 85.8160),
        "old town": ("Old Town, Lingaraj", 20.2420, 85.8340),
    }
    q_lower = query.lower().strip()
    for key, (name, lat, lon) in hubs.items():
        if key in q_lower:
            return {"status": "success", "location": {"name": name, "lat": lat, "lon": lon}}
    return {"status": "success", "location": {"name": f"{query}, Bhubaneswar", "lat": 20.2961, "lon": 85.8245}}


@router.get("/reverse-geocode")
@router.get("/api/reverse-geocode")
def reverse_geocode(lat: float = 20.2961, lon: float = 85.8245):
    return {
        "status": "success",
        "name": f"Coordinates ({round(lat, 4)}, {round(lon, 4)})",
        "lat": lat,
        "lon": lon,
    }
