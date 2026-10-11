import argparse
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from db.database import get_connection, hash_session_token


def main():
    parser = argparse.ArgumentParser(description="Provision or revoke a hospital-scoped desk staff token.")
    parser.add_argument("--staff-id", required=True, help="Unique staff identifier used in the audit history.")
    parser.add_argument("--hospital-id", help="Hospital identifier to scope this staff member to.")
    parser.add_argument("--revoke", action="store_true", help="Revoke the staff member's current token.")
    args = parser.parse_args()

    staff_id = args.staff_id.strip()
    if not staff_id or len(staff_id) > 100:
        parser.error("--staff-id must contain 1 to 100 characters.")
    if args.revoke and args.hospital_id:
        parser.error("--hospital-id cannot be combined with --revoke.")
    if not args.revoke and not args.hospital_id:
        parser.error("--hospital-id is required when provisioning or rotating a token.")
    if args.hospital_id and (not args.hospital_id.strip() or len(args.hospital_id.strip()) > 64):
        parser.error("--hospital-id must contain 1 to 64 characters.")

    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT staff_id FROM desk_staff WHERE staff_id = ?",
            (staff_id,),
        ).fetchone()
        if args.revoke:
            if not existing:
                parser.error(f"No staff credential exists for {staff_id}.")
            conn.execute("UPDATE desk_staff SET active = 0 WHERE staff_id = ?", (staff_id,))
            conn.commit()
            print(f"Revoked staff credential for {staff_id}.")
            return

        token = secrets.token_urlsafe(32)
        conn.execute(
            """
            INSERT INTO desk_staff (staff_id, hospital_id, token_hash, active, created_at)
            VALUES (?, ?, ?, 1, ?)
            ON CONFLICT(staff_id) DO UPDATE SET
                hospital_id = excluded.hospital_id,
                token_hash = excluded.token_hash,
                active = 1,
                created_at = excluded.created_at
            """,
            (
                staff_id,
                args.hospital_id.strip(),
                hash_session_token(token),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
        print(f"Staff ID: {staff_id}")
        print(f"Hospital ID: {args.hospital_id.strip()}")
        print("Copy this staff token now; it cannot be retrieved later:")
        print(token)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
