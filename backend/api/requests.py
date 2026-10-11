from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import logging
import os
import secrets
import sqlite3
from db.database import get_connection
from api.auth import get_current_user

router = APIRouter(prefix="/api/requests", tags=["requests"])
logger = logging.getLogger(__name__)

class HoldRequest(BaseModel):
    hospital_id: str = Field(min_length=1, max_length=64)
    flow_type: str = Field(pattern="^(EMERGENCY|GENERAL_WARD)$")
    specialty: str = Field(min_length=1, max_length=100)
    bed_type: Optional[str] = Field(default="Standard", max_length=80)
    bed_unit_id: Optional[str] = Field(default=None, max_length=100)
    patient_count: int = Field(default=1, ge=1, le=5)
    patient_name: str = Field(min_length=1, max_length=120)
    contact_mobile: str = Field(pattern="^\\d{10}$")
    age: Optional[int] = Field(default=45, ge=0, le=120)
    gender: Optional[str] = "Male"
    pmjay_card_number: Optional[str] = None
    referral_notes: Optional[str] = None

class VerifyRequest(BaseModel):
    request_id: str = Field(min_length=1, max_length=80)
    otp_code: str = Field(pattern="^\\d{6}$")

DOCTOR_MAP = {
    "BBSR001": ("Dr. B. K. Mohanty (HOD, Emergency)", "AIIMS Trauma Block, Gate 2"),
    "BBSR002": ("Dr. B. K. Jena (Casualty Medical Officer)", "Main Casualty Block, Unit 6 Gate"),
    "BBSR003": ("Dr. S. K. Patra (Critical Care Lead)", "SUM Ultimate Emergency Triage, Ground Fl"),
    "BBSR004": ("Dr. P. R. Mishra (Duty Medical Officer)", "CARE Casualty Complex, Chandrasekharpur"),
    "BBSR005": ("Dr. A. K. Nayak (Chief Intensivist)", "Kalinga Hospital ER Wing"),
    "BBSR006": ("Dr. R. C. Das (Emergency Registrar)", "Hi-Tech Medical Casualty Wing, Pandara"),
    "BBSR007": ("Dr. T. K. Sahoo (Emergency Consultant)", "Apollo Emergency Bay, Samantarapur"),
    "BBSR008": ("Dr. M. M. Panda (Senior Casualty Officer)", "Manipal Hospital ER Triage"),
    "BBSR009": ("Dr. K. N. Tripathy (Critical Care Head)", "Utkal Hospital Triage Desk, Niladri Vihar"),
    "BBSR010": ("Dr. D. N. Mohapatra (Duty In-charge)", "Sparsh Critical Care Desk, Saheed Nagar")
}


def _load_request_or_404(cur, request_id: str):
    cur.execute("SELECT * FROM bed_requests WHERE id = ?", (request_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Request not found.")
    return row


def _record_request_event(
    cur,
    request_id: str,
    from_status: Optional[str],
    to_status: str,
    actor_type: str,
    actor_id: Optional[str] = None,
):
    cur.execute(
        """
        INSERT INTO bed_request_events (request_id, from_status, to_status, actor_type, actor_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (request_id, from_status, to_status, actor_type, actor_id, datetime.now(timezone.utc).isoformat()),
    )


def _expire_hold_if_needed(cur, row, now: datetime):
    if row["status"] != "HELD" or not row["hold_expires_at"]:
        return row["status"]
    expiry = datetime.fromisoformat(row["hold_expires_at"])
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if expiry <= now:
        cur.execute("UPDATE bed_requests SET status = 'EXPIRED' WHERE id = ?", (row["id"],))
        _record_request_event(cur, row["id"], "HELD", "EXPIRED", "system")
        return "EXPIRED"
    return row["status"]


def _expire_stale_holds(cur, now: datetime):
    cur.execute(
        """
        SELECT id FROM bed_requests
        WHERE status = 'HELD' AND hold_expires_at IS NOT NULL AND hold_expires_at <= ?
        """,
        (now.isoformat(),),
    )
    expired_ids = [row["id"] for row in cur.fetchall()]
    cur.execute(
        """
        UPDATE bed_requests
        SET status = 'EXPIRED'
        WHERE status = 'HELD' AND hold_expires_at IS NOT NULL AND hold_expires_at <= ?
        """,
        (now.isoformat(),),
    )
    for request_id in expired_ids:
        _record_request_event(cur, request_id, "HELD", "EXPIRED", "system")


def _get_desk_staff(token: Optional[str]):
    if not token:
        return None
    conn = get_connection()
    try:
        staff = conn.execute(
            """
            SELECT staff_id, hospital_id FROM desk_staff
            WHERE token_hash = ? AND active = 1
            """,
            (hashlib.sha256(token.encode("utf-8")).hexdigest(),),
        ).fetchone()
        if not staff:
            raise HTTPException(status_code=401, detail="Invalid or revoked hospital staff token.")
        return dict(staff)
    finally:
        conn.close()


def _require_desk_staff(token: Optional[str]):
    staff = _get_desk_staff(token)
    if not staff:
        raise HTTPException(status_code=401, detail="Hospital staff authentication is required.")
    return staff


def _authorize_staff_for_request(staff, row):
    if staff["hospital_id"] != row["hospital_id"]:
        raise HTTPException(status_code=404, detail="Request not found.")


def _hash_otp(request_id: str, otp: str) -> str:
    return hashlib.sha256(f"{request_id}:{otp}".encode("utf-8")).hexdigest()


@router.post("/hold")
def create_request_hold(req: HoldRequest, user=Depends(get_current_user)):
    if os.getenv("APP_ENV", "development").lower() == "production":
        raise HTTPException(
            status_code=503,
            detail="Booking is unavailable: an SMS OTP delivery provider has not been configured.",
        )

    req_id = f"AROGYA-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"
    otp = "".join(secrets.choice("0123456789") for _ in range(6))
    now = datetime.now(timezone.utc)
    otp_exp = now + timedelta(minutes=5)
    
    bed_unit = req.bed_unit_id
    if not bed_unit:
        prefix = (req.specialty[:4] if req.specialty else "EMER").upper()
        bed_unit = f"{prefix}-GEN-{secrets.token_hex(4).upper()}"
        
    doc_info = DOCTOR_MAP.get(req.hospital_id, ("Dr. Duty Officer (Casualty)", "Main Admission Desk, Gate 1"))
    
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("BEGIN IMMEDIATE")
    _expire_stale_holds(cur, now)
    if req.bed_unit_id:
        cur.execute(
            """
            SELECT 1 FROM bed_requests
            WHERE hospital_id = ? AND bed_unit_id = ? AND status IN ('HELD', 'ADMITTED')
            """,
            (req.hospital_id, bed_unit),
        )
        if cur.fetchone():
            conn.close()
            raise HTTPException(status_code=409, detail="That bed is no longer available.")
    cur.execute('''
    INSERT INTO bed_requests (
        id, user_id, hospital_id, flow_type, specialty, bed_type, bed_unit_id,
        doctor_incharge, desk_location,
        patient_count, patient_name, contact_mobile, age, gender,
        pmjay_card_number, referral_notes,
        otp_code, otp_expires_at, status, hospital_desk_contact, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        req_id, user["id"], req.hospital_id, req.flow_type, req.specialty, req.bed_type, bed_unit,
        doc_info[0], doc_info[1],
        req.patient_count, req.patient_name, req.contact_mobile, req.age, req.gender,
        req.pmjay_card_number, req.referral_notes,
        _hash_otp(req_id, otp), otp_exp.isoformat(), "OTP_PENDING", "+91-674-2391983", now.isoformat()
    ))
    _record_request_event(cur, req_id, None, "OTP_PENDING", "user", str(user["id"]))
    conn.commit()
    conn.close()
    
    return {
        "request_id": req_id,
        "status": "OTP_PENDING",
        "dev_otp": otp if os.getenv("APP_ENV", "development").lower() != "production" else None,
        "bed_unit_id": bed_unit,
        "otp_expires_at": otp_exp.isoformat(),
        "message": "OTP issued. Enter code within 5 minutes."
    }

@router.post("/verify")
def verify_request_hold(req: VerifyRequest, user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("BEGIN IMMEDIATE")
    cur.execute("SELECT * FROM bed_requests WHERE id = ?", (req.request_id,))
    row = cur.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Request ID not found.")

    if row["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=404, detail="Request ID not found.")
        
    if row["status"] != "OTP_PENDING":
        conn.close()
        raise HTTPException(status_code=400, detail=f"Request is in status '{row['status']}'.")
        
    if datetime.fromisoformat(row["otp_expires_at"]) < now:
        cur.execute("UPDATE bed_requests SET status = 'EXPIRED' WHERE id = ?", (req.request_id,))
        _record_request_event(cur, req.request_id, "OTP_PENDING", "EXPIRED", "system")
        conn.commit()
        conn.close()
        raise HTTPException(status_code=400, detail="OTP has expired.")
        
    if row["otp_attempts"] >= 5:
        cur.execute("UPDATE bed_requests SET status = 'OTP_FAILED' WHERE id = ?", (req.request_id,))
        _record_request_event(cur, req.request_id, "OTP_PENDING", "OTP_FAILED", "system")
        conn.commit()
        conn.close()
        raise HTTPException(status_code=429, detail="OTP verification limit reached. Start a new request.")

    if not hmac.compare_digest(_hash_otp(req.request_id, req.otp_code), row["otp_code"]):
        cur.execute("UPDATE bed_requests SET otp_attempts = otp_attempts + 1 WHERE id = ?", (req.request_id,))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid OTP code.")
        
    hold_exp = now + timedelta(minutes=30)
    try:
        cur.execute(
            """
            UPDATE bed_requests
            SET status = 'HELD', hold_expires_at = ?
            WHERE id = ? AND user_id = ? AND status = 'OTP_PENDING'
              AND NOT EXISTS (
                SELECT 1 FROM bed_requests active
                WHERE active.hospital_id = ? AND active.bed_unit_id = ?
                  AND active.status IN ('HELD', 'ADMITTED')
              )
            """,
            (hold_exp.isoformat(), req.request_id, user["id"], row["hospital_id"], row["bed_unit_id"]),
        )
        if cur.rowcount != 1:
            conn.rollback()
            raise HTTPException(status_code=409, detail="That bed is no longer available or this OTP request is no longer active.")
        _record_request_event(cur, req.request_id, "OTP_PENDING", "HELD", "user", str(user["id"]))
        conn.commit()
        logger.info(
            "bed_hold_activated request_id=%s hospital_id=%s bed_unit_id=%s",
            req.request_id,
            row["hospital_id"],
            row["bed_unit_id"],
        )
    except sqlite3.IntegrityError as error:
        conn.rollback()
        raise HTTPException(status_code=409, detail="That bed is no longer available.") from error
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    
    return {
        "request_id": req.request_id,
        "status": "HELD",
        "hold_expires_at": hold_exp.isoformat(),
        "bed_unit_id": row["bed_unit_id"],
        "doctor_incharge": row["doctor_incharge"],
        "desk_location": row["desk_location"],
        "hospital_desk_contact": row["hospital_desk_contact"],
        "remaining_seconds": 1800,
        "patient_name": row["patient_name"],
        "contact_mobile": row["contact_mobile"],
        "specialty": row["specialty"],
        "flow_type": row["flow_type"],
        "pmjay_card_number": row["pmjay_card_number"]
    }

@router.post("/{request_id}/checkin")
def confirm_patient_checkin(
    request_id: str,
    request: Request,
    x_hospital_staff_token: Optional[str] = Header(default=None),
):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("BEGIN IMMEDIATE")
        row = _load_request_or_404(cur, request_id)
        staff = _get_desk_staff(x_hospital_staff_token)
        if staff:
            _authorize_staff_for_request(staff, row)
        else:
            user = get_current_user(request)
            if row["user_id"] != user["id"]:
                raise HTTPException(status_code=404, detail="Request not found.")
        status = _expire_hold_if_needed(cur, row, datetime.now(timezone.utc))
        if status != "HELD":
            conn.commit()
            raise HTTPException(
                status_code=409,
                detail=f"Cannot mark this request admitted; it is {status.lower()}.",
            )

        cur.execute("UPDATE bed_requests SET status = 'ADMITTED' WHERE id = ? AND status = 'HELD'", (request_id,))
        if cur.rowcount != 1:
            conn.rollback()
            raise HTTPException(status_code=409, detail="Request status changed; refresh the booking.")
        _record_request_event(
            cur,
            request_id,
            "HELD",
            "ADMITTED",
            "desk" if staff else "user",
            staff["staff_id"] if staff else str(user["id"]),
        )
        conn.commit()
        logger.info("bed_hold_admitted request_id=%s hospital_id=%s", request_id, row["hospital_id"])
        return {
            "status": "ADMITTED",
            "message": f"Patient {row['patient_name']} admitted to bed {row['bed_unit_id']}.",
        }
    finally:
        conn.close()

@router.post("/{request_id}/cancel")
def cancel_patient_hold(
    request_id: str,
    request: Request,
    x_hospital_staff_token: Optional[str] = Header(default=None),
):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("BEGIN IMMEDIATE")
        row = _load_request_or_404(cur, request_id)
        staff = _get_desk_staff(x_hospital_staff_token)
        if staff:
            _authorize_staff_for_request(staff, row)
        else:
            user = get_current_user(request)
            if row["user_id"] != user["id"]:
                raise HTTPException(status_code=404, detail="Request not found.")
        status = _expire_hold_if_needed(cur, row, datetime.now(timezone.utc))
        if status != "HELD":
            conn.commit()
            raise HTTPException(
                status_code=409,
                detail=f"Cannot decline this request; it is {status.lower()}.",
            )

        cur.execute("UPDATE bed_requests SET status = 'CANCELLED' WHERE id = ? AND status = 'HELD'", (request_id,))
        if cur.rowcount != 1:
            conn.rollback()
            raise HTTPException(status_code=409, detail="Request status changed; refresh the booking.")
        _record_request_event(
            cur,
            request_id,
            "HELD",
            "CANCELLED",
            "desk" if staff else "user",
            staff["staff_id"] if staff else str(user["id"]),
        )
        conn.commit()
        logger.info("bed_hold_declined request_id=%s hospital_id=%s", request_id, row["hospital_id"])
        return {
            "status": "CANCELLED",
            "message": f"Bed hold {request_id} cancelled and released to public inventory.",
        }
    finally:
        conn.close()


@router.post("/{request_id}/discharge")
def discharge_admitted_patient(
    request_id: str,
    x_hospital_staff_token: Optional[str] = Header(default=None),
):
    staff = _require_desk_staff(x_hospital_staff_token)

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("BEGIN IMMEDIATE")
        row = _load_request_or_404(cur, request_id)
        _authorize_staff_for_request(staff, row)
        if row["status"] != "ADMITTED":
            raise HTTPException(
                status_code=409,
                detail=f"Cannot release this bed; request is {row['status'].lower()}.",
            )
        cur.execute(
            "UPDATE bed_requests SET status = 'DISCHARGED' WHERE id = ? AND status = 'ADMITTED'",
            (request_id,),
        )
        if cur.rowcount != 1:
            raise HTTPException(status_code=409, detail="Request status changed; refresh the desk registry.")
        _record_request_event(cur, request_id, "ADMITTED", "DISCHARGED", "desk", staff["staff_id"])
        conn.commit()
        logger.info(
            "admitted_bed_released request_id=%s hospital_id=%s staff_id=%s",
            request_id,
            row["hospital_id"],
            staff["staff_id"],
        )
        return {"status": "DISCHARGED", "message": f"Bed {row['bed_unit_id']} released after discharge."}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@router.get("/mine")
def get_my_requests(user=Depends(get_current_user)):
    conn = get_connection()
    try:
        _expire_stale_holds(conn.cursor(), datetime.now(timezone.utc))
        conn.commit()
        rows = conn.execute(
            """
            SELECT id AS request_id, hospital_id, flow_type, specialty, bed_type,
                   bed_unit_id, doctor_incharge, desk_location, hold_expires_at,
                   status, created_at, patient_name, contact_mobile
            FROM bed_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 100
            """,
            (user["id"],),
        ).fetchall()
        return {"requests": [dict(row) for row in rows]}
    finally:
        conn.close()


@router.get("/{request_id}")
def get_request_status(request_id: str, user=Depends(get_current_user)):
    conn = get_connection()
    cur = conn.cursor()
    try:
        row = _load_request_or_404(cur, request_id)
        if row["user_id"] != user["id"]:
            raise HTTPException(status_code=404, detail="Request not found.")
        status = _expire_hold_if_needed(cur, row, datetime.now(timezone.utc))
        conn.commit()
        expires_at = row["hold_expires_at"]
        return {
            "request_id": row["id"],
            "status": status,
            "hold_expires_at": expires_at,
            "flow_type": row["flow_type"],
            "hospital_id": row["hospital_id"],
        }
    finally:
        conn.close()


@router.get("/portal/active")
def get_all_active_desk_requests(x_hospital_staff_token: Optional[str] = Header(default=None)):
    staff = _require_desk_staff(x_hospital_staff_token)
    conn = get_connection()
    try:
        cur = conn.cursor()
        _expire_stale_holds(cur, datetime.now(timezone.utc))
        conn.commit()
        cur.execute(
            """
            SELECT id, hospital_id, flow_type, specialty, bed_type, bed_unit_id,
                   patient_name, contact_mobile, status, created_at, hold_expires_at,
                   pmjay_card_number
            FROM bed_requests WHERE hospital_id = ? ORDER BY created_at DESC LIMIT 50
            """,
            (staff["hospital_id"],),
        )
        return {"staff": staff, "requests": [dict(row) for row in cur.fetchall()]}
    finally:
        conn.close()


@router.get("/{request_id}/events")
def get_request_events(request_id: str, x_hospital_staff_token: Optional[str] = Header(default=None)):
    staff = _require_desk_staff(x_hospital_staff_token)
    conn = get_connection()
    try:
        request_row = conn.execute(
            "SELECT hospital_id FROM bed_requests WHERE id = ?", (request_id,)
        ).fetchone()
        if not request_row or request_row["hospital_id"] != staff["hospital_id"]:
            raise HTTPException(status_code=404, detail="Request not found.")
        rows = conn.execute(
            """
            SELECT from_status, to_status, actor_type, actor_id, created_at
            FROM bed_request_events WHERE request_id = ? ORDER BY created_at ASC, id ASC
            """,
            (request_id,),
        ).fetchall()
        return {"events": [dict(row) for row in rows]}
    finally:
        conn.close()

@router.get("/units/{hospital_id}/{specialty:path}")
def get_interactive_bed_units(hospital_id: str, specialty: str):
    occupied_map = {}
    recorded_units = set()
    conn = get_connection()
    try:
        cur = conn.cursor()
        _expire_stale_holds(cur, datetime.now(timezone.utc))
        conn.commit()
        cur.execute('''
        SELECT bed_unit_id, status, hold_expires_at FROM bed_requests
        WHERE hospital_id = ?
        ''', (hospital_id,))
        for row in cur.fetchall():
            if row["bed_unit_id"]:
                recorded_units.add(row["bed_unit_id"])
                if row["status"] in ("HELD", "ADMITTED"):
                    occupied_map[row["bed_unit_id"]] = {
                        "status": row["status"],
                        "hold_expires_at": row["hold_expires_at"],
                    }
    finally:
        conn.close()
    
    spec_clean = specialty.split("(")[0].strip()
    clean_prefix = "".join(c for c in spec_clean.upper() if c.isalpha())
    if "ORTH" in clean_prefix:
        spec_prefix = "ORTH"
    elif "PEDI" in clean_prefix or "PAED" in clean_prefix:
        spec_prefix = "PEDI"
    elif "NEPH" in clean_prefix:
        spec_prefix = "NEPH"
    elif "OBST" in clean_prefix or "GYNA" in clean_prefix:
        spec_prefix = "OBGY"
    elif "CARD" in clean_prefix:
        spec_prefix = "CARD"
    else:
        spec_prefix = clean_prefix[:4].ljust(4, "X") or "GENE"
    
    wards_distribution = [
        ("General Ward (Male)", "GEN-M", 4, "Free"),
        ("General Ward (Female)", "GEN-F", 4, "Free"),
        ("Semi-Private Cabin", "SEM", 4, "Rs. 400/d"),
        ("High Dependency Unit (HDU)", "HDU", 2, "Rs. 800/d")
    ]
    
    units = []
    for ward_name, unit_prefix, count, fee_display in wards_distribution:
        for idx in range(1, count + 1):
            unit_id = f"{spec_prefix}-{unit_prefix}-{idx:02d}"
            db_unit = occupied_map.get(unit_id)
            db_status = db_unit["status"] if db_unit else None

            status = "AVAILABLE"
            if db_status == "HELD":
                status = "30_MIN_HOLD"
            elif db_status == "ADMITTED" or (
                not db_status
                and unit_id == f"{spec_prefix}-GEN-M-03"
                and unit_id not in recorded_units
            ):
                status = "OCCUPIED"
                
            units.append({
                "unit_id": unit_id,
                "ward": ward_name,
                "has_o2": True,
                "has_vent": ward_name == "HDU" or idx == 1,
                "fee_display": fee_display,
                "status": status,
                "hold_expires_at": db_unit["hold_expires_at"] if db_unit else None
            })
            
    return {"units": units}
