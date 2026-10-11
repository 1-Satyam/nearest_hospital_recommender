import sqlite3
import os
import hashlib
import hmac
import secrets
from pathlib import Path

DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "app.db"))

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    conn.execute("PRAGMA synchronous = FULL")
    return conn

def init_db():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = get_connection()
    conn.execute("PRAGMA journal_mode = WAL")
    cur = conn.cursor()
    cur.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mobile TEXT UNIQUE NOT NULL,
        email TEXT,
        password_hash TEXT NOT NULL,
        has_pmjay BOOLEAN DEFAULT 0,
        pmjay_card_number TEXT,
        created_at TEXT NOT NULL
    );
    ''')
    cur.execute('''
    CREATE TABLE IF NOT EXISTS user_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    ''')
    cur.execute('''
    CREATE TABLE IF NOT EXISTS login_attempts (
        mobile TEXT PRIMARY KEY,
        failure_count INTEGER NOT NULL,
        window_started_at TEXT NOT NULL,
        locked_until TEXT
    );
    ''')
    cur.execute('''
    CREATE TABLE IF NOT EXISTS desk_staff (
        staff_id TEXT PRIMARY KEY,
        hospital_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        active BOOLEAN NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
    );
    ''')
    cur.execute('''
    CREATE TABLE IF NOT EXISTS bed_request_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL REFERENCES bed_requests(id) ON DELETE CASCADE,
        from_status TEXT,
        to_status TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        actor_id TEXT,
        created_at TEXT NOT NULL
    );
    ''')
    cur.execute('''
    CREATE TABLE IF NOT EXISTS bed_requests (
        id TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        hospital_id TEXT NOT NULL,
        flow_type TEXT NOT NULL,
        specialty TEXT NOT NULL,
        bed_type TEXT NOT NULL,
        bed_unit_id TEXT,
        doctor_incharge TEXT,
        desk_location TEXT,
        patient_count INTEGER DEFAULT 1,
        patient_name TEXT NOT NULL,
        contact_mobile TEXT NOT NULL,
        age INTEGER,
        gender TEXT,
        pmjay_card_number TEXT,
        referral_notes TEXT,
        otp_code TEXT NOT NULL,
        otp_expires_at TEXT NOT NULL,
        otp_attempts INTEGER NOT NULL DEFAULT 0,
        hold_expires_at TEXT,
        status TEXT NOT NULL,
        hospital_desk_contact TEXT,
        created_at TEXT NOT NULL
    );
    ''')
    conn.commit()
    
    # Safe migration check
    cur.execute("PRAGMA table_info(bed_requests)")
    existing_cols = [r[1] for r in cur.fetchall()]
    cols_to_add = {
        "user_id": "INTEGER REFERENCES users(id)", "bed_unit_id": "TEXT", "doctor_incharge": "TEXT", "desk_location": "TEXT",
        "age": "INTEGER", "gender": "TEXT", "pmjay_card_number": "TEXT", "referral_notes": "TEXT",
        "otp_attempts": "INTEGER NOT NULL DEFAULT 0"
    }
    for col, ctype in cols_to_add.items():
        if col not in existing_cols:
            cur.execute(f"ALTER TABLE bed_requests ADD COLUMN {col} {ctype}")
    cur.execute(
        """
        SELECT id, otp_code FROM bed_requests
        WHERE length(otp_code) = 6 AND otp_code GLOB '[0-9][0-9][0-9][0-9][0-9][0-9]'
        """
    )
    for request_id, otp_code in cur.fetchall():
        hashed_otp = hashlib.sha256(f"{request_id}:{otp_code}".encode("utf-8")).hexdigest()
        cur.execute("UPDATE bed_requests SET otp_code = ? WHERE id = ?", (hashed_otp, request_id))
    cur.execute("CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_bed_requests_user ON bed_requests(user_id, created_at)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_request_events_request ON bed_request_events(request_id, created_at)")
    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_active_hospital_bed
        ON bed_requests(hospital_id, bed_unit_id)
        WHERE bed_unit_id IS NOT NULL AND status IN ('HELD', 'ADMITTED')
    """)
    conn.commit()
    conn.close()

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"

def verify_password(password: str, stored_hash: str) -> tuple[bool, bool]:
    if stored_hash.startswith("scrypt$"):
        _, salt_hex, digest_hex = stored_hash.split("$", 2)
        digest = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
        return hmac.compare_digest(digest.hex(), digest_hex), False

    legacy = hashlib.sha256((password + "bbsr_salt_2026").encode("utf-8")).hexdigest()
    return hmac.compare_digest(legacy, stored_hash), True

def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
