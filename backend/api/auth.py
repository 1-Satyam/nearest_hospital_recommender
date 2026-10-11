import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from db.database import get_connection, hash_password, hash_session_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
SESSION_COOKIE = "arogyasetu_session"
SESSION_TTL = timedelta(hours=12)
LOGIN_FAILURE_WINDOW = timedelta(minutes=15)
LOGIN_LOCKOUT = timedelta(minutes=15)
MAX_LOGIN_FAILURES = 5


class RegisterPayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    mobile: str = Field(min_length=10, max_length=10)
    password: str = Field(min_length=8, max_length=256)
    email: Optional[str] = None
    has_pmjay: Optional[bool] = False
    pmjay_card_number: Optional[str] = None


class LoginPayload(BaseModel):
    mobile: str = Field(pattern="^\\d{10}$")
    password: str = Field(min_length=1, max_length=256)


class ProfileUpdatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    has_pmjay: bool = False
    pmjay_card_number: Optional[str] = Field(default=None, max_length=100)


def _public_user(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "mobile": row["mobile"],
        "has_pmjay": bool(row["has_pmjay"]),
        "pmjay_card_number": row["pmjay_card_number"],
    }


def _set_session(response: Response, user_id: int):
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    conn = get_connection()
    try:
        conn.execute("DELETE FROM user_sessions WHERE expires_at <= ?", (now.isoformat(),))
        conn.execute(
            "INSERT INTO user_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (hash_session_token(token), user_id, (now + SESSION_TTL).isoformat(), now.isoformat()),
        )
        conn.commit()
    finally:
        conn.close()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        secure=os.getenv("APP_ENV", "development").lower() == "production",
        samesite="lax",
        max_age=int(SESSION_TTL.total_seconds()),
        path="/",
    )


def get_current_user(request: Request):
    user = get_optional_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    return user


def get_optional_current_user(request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None

    now = datetime.now(timezone.utc)
    conn = get_connection()
    try:
        row = conn.execute(
            """
            SELECT u.id, u.name, u.mobile, u.has_pmjay, u.pmjay_card_number, s.expires_at
            FROM user_sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ?
            """,
            (hash_session_token(token),),
        ).fetchone()
        if not row:
            return None
        expires_at = datetime.fromisoformat(row["expires_at"])
        if expires_at <= now:
            conn.execute("DELETE FROM user_sessions WHERE token_hash = ?", (hash_session_token(token),))
            conn.commit()
            return None
        return _public_user(row)
    finally:
        conn.close()


@router.post("/register")
def register_user(payload: RegisterPayload, response: Response):
    if not payload.mobile.isdigit():
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit mobile number.")

    conn = get_connection()
    try:
        now = datetime.now(timezone.utc).isoformat()
        cursor = conn.execute(
            """
            INSERT INTO users (name, mobile, email, password_hash, has_pmjay, pmjay_card_number, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.name.strip(),
                payload.mobile,
                payload.email,
                hash_password(payload.password),
                1 if payload.has_pmjay else 0,
                payload.pmjay_card_number,
                now,
            ),
        )
        user_id = cursor.lastrowid
        conn.commit()
        user = conn.execute(
            "SELECT id, name, mobile, has_pmjay, pmjay_card_number FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    except Exception as error:
        conn.rollback()
        if "UNIQUE constraint failed" in str(error):
            raise HTTPException(status_code=400, detail="An account with this mobile number already exists.") from error
        raise
    finally:
        conn.close()

    _set_session(response, user_id)
    return {"status": "success", "user": _public_user(user)}


@router.post("/login")
def login_user(payload: LoginPayload, response: Response):
    now = datetime.now(timezone.utc)
    conn = get_connection()
    try:
        attempt = conn.execute(
            "SELECT failure_count, window_started_at, locked_until FROM login_attempts WHERE mobile = ?",
            (payload.mobile,),
        ).fetchone()
        if attempt and attempt["locked_until"]:
            locked_until = datetime.fromisoformat(attempt["locked_until"])
            if locked_until > now:
                raise HTTPException(status_code=429, detail="Too many sign-in attempts. Try again later.")

        user = conn.execute(
            "SELECT id, name, mobile, has_pmjay, pmjay_card_number, password_hash FROM users WHERE mobile = ?",
            (payload.mobile,),
        ).fetchone()
        valid, needs_upgrade = verify_password(
            payload.password,
            user["password_hash"] if user else "scrypt$00112233445566778899aabbccddeeff$" + ("00" * 64),
        )
        if not user or not valid:
            if attempt and now - datetime.fromisoformat(attempt["window_started_at"]) < LOGIN_FAILURE_WINDOW:
                failure_count = attempt["failure_count"] + 1
                window_started_at = attempt["window_started_at"]
            else:
                failure_count = 1
                window_started_at = now.isoformat()
            locked_until = (now + LOGIN_LOCKOUT).isoformat() if failure_count >= MAX_LOGIN_FAILURES else None
            conn.execute(
                """
                INSERT INTO login_attempts (mobile, failure_count, window_started_at, locked_until)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(mobile) DO UPDATE SET
                    failure_count = excluded.failure_count,
                    window_started_at = excluded.window_started_at,
                    locked_until = excluded.locked_until
                """,
                (payload.mobile, failure_count, window_started_at, locked_until),
            )
            conn.commit()
            if locked_until:
                raise HTTPException(status_code=429, detail="Too many sign-in attempts. Try again later.")
            raise HTTPException(status_code=401, detail="Invalid mobile number or password.")

        conn.execute("DELETE FROM login_attempts WHERE mobile = ?", (payload.mobile,))
        if needs_upgrade:
            conn.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (hash_password(payload.password), user["id"]),
            )
        conn.commit()
        public_user = _public_user(user)
    finally:
        conn.close()

    _set_session(response, user["id"])
    return {"status": "success", "user": public_user}


@router.get("/me")
def get_session_user(request: Request):
    user = get_optional_current_user(request)
    return {"user": user}


@router.patch("/me")
def update_session_user(payload: ProfileUpdatePayload, user=Depends(get_current_user)):
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE users SET name = ?, has_pmjay = ?, pmjay_card_number = ? WHERE id = ?",
            (payload.name.strip(), 1 if payload.has_pmjay else 0, payload.pmjay_card_number, user["id"]),
        )
        conn.commit()
        updated = conn.execute(
            "SELECT id, name, mobile, has_pmjay, pmjay_card_number FROM users WHERE id = ?",
            (user["id"],),
        ).fetchone()
        return {"user": _public_user(updated)}
    finally:
        conn.close()


@router.post("/logout")
def logout_user(request: Request, response: Response):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        conn = get_connection()
        try:
            conn.execute("DELETE FROM user_sessions WHERE token_hash = ?", (hash_session_token(token),))
            conn.commit()
        finally:
            conn.close()
    response.delete_cookie(
        SESSION_COOKIE,
        path="/",
        httponly=True,
        secure=os.getenv("APP_ENV", "development").lower() == "production",
        samesite="lax",
    )
    return {"status": "success"}
