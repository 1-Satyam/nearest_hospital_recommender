import unittest
import sys
import os
import uuid
import tempfile
import hashlib
import subprocess
from unittest.mock import patch
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

_test_database_directory = tempfile.TemporaryDirectory(prefix="arogyasetu-tests-")
os.environ["DATABASE_PATH"] = os.path.join(_test_database_directory.name, "test.db")
os.environ["APP_ENV"] = "development"

from fastapi.testclient import TestClient
from main import app
from db.database import get_connection, init_db
from db.database import hash_session_token

class TestHospitalAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        mobile = str(1000000000 + (uuid.uuid4().int % 9000000000))
        response = self.client.post("/api/auth/register", json={
            "name": "Test Patient",
            "mobile": mobile,
            "password": "test-password-123"
        })
        self.assertEqual(response.status_code, 200, response.text)
        self.user = response.json()["user"]

    def create_desk_staff(self, hospital_id, staff_id=None):
        staff_id = staff_id or f"staff-{uuid.uuid4().hex[:8]}"
        token = uuid.uuid4().hex + uuid.uuid4().hex
        conn = get_connection()
        conn.execute(
            """
            INSERT INTO desk_staff (staff_id, hospital_id, token_hash, active, created_at)
            VALUES (?, ?, ?, 1, ?)
            """,
            (staff_id, hospital_id, hash_session_token(token), datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        conn.close()
        return staff_id, {"X-Hospital-Staff-Token": token}

    def test_health_check(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "healthy")

    def test_request_endpoints_require_sign_in_and_hide_other_users_requests(self):
        anonymous = TestClient(app)
        payload = {
            "hospital_id": "BBSR001",
            "flow_type": "GENERAL_WARD",
            "specialty": "Cardiology",
            "bed_type": "Standard",
            "bed_unit_id": "CARD-GEN-F-01",
            "patient_name": "Test Patient",
            "contact_mobile": "9876543210",
        }
        self.assertEqual(anonymous.post("/api/requests/hold", json=payload).status_code, 401)

        created = self.client.post("/api/requests/hold", json=payload)
        request_id = created.json()["request_id"]
        other_user = TestClient(app)
        mobile = str(1000000000 + (uuid.uuid4().int % 9000000000))
        self.assertEqual(other_user.post("/api/auth/register", json={
            "name": "Other Patient",
            "mobile": mobile,
            "password": "test-password-123",
        }).status_code, 200)
        self.assertEqual(other_user.get(f"/api/requests/{request_id}").status_code, 404)

    def test_session_is_server_validated_and_logout_revokes_it(self):
        self.assertEqual(self.client.get("/api/auth/me").json()["user"]["id"], self.user["id"])
        updated = self.client.patch("/api/auth/me", json={
            "name": "Updated Test Patient",
            "has_pmjay": True,
            "pmjay_card_number": "TEST-CARD-123",
        })
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["user"]["name"], "Updated Test Patient")
        login = self.client.post("/api/auth/login", json={
            "mobile": self.user["mobile"],
            "password": "test-password-123",
        })
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["user"]["pmjay_card_number"], "TEST-CARD-123")
        response = self.client.post("/api/auth/logout")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(self.client.get("/api/auth/me").json()["user"])

    def test_legacy_password_hash_is_upgraded_after_valid_login(self):
        mobile = str(1000000000 + (uuid.uuid4().int % 9000000000))
        password = "legacy-password-123"
        legacy_hash = hashlib.sha256((password + "bbsr_salt_2026").encode("utf-8")).hexdigest()
        conn = get_connection()
        cursor = conn.execute(
            """
            INSERT INTO users (name, mobile, password_hash, created_at)
            VALUES (?, ?, ?, ?)
            """,
            ("Legacy User", mobile, legacy_hash, datetime.now(timezone.utc).isoformat()),
        )
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()

        response = self.client.post("/api/auth/login", json={"mobile": mobile, "password": password})
        self.assertEqual(response.status_code, 200)
        conn = get_connection()
        upgraded_hash = conn.execute(
            "SELECT password_hash FROM users WHERE id = ?", (user_id,)
        ).fetchone()["password_hash"]
        conn.close()
        self.assertTrue(upgraded_hash.startswith("scrypt$"))

    def test_sign_in_attempts_are_rate_limited(self):
        for attempt in range(5):
            response = self.client.post("/api/auth/login", json={
                "mobile": self.user["mobile"],
                "password": "incorrect-password",
            })
            self.assertEqual(response.status_code, 429 if attempt == 4 else 401)
        limited = self.client.post("/api/auth/login", json={
            "mobile": self.user["mobile"],
            "password": "test-password-123",
        })
        self.assertEqual(limited.status_code, 429)

    def test_otp_hash_and_attempt_limit(self):
        created = self.client.post("/api/requests/hold", json={
            "hospital_id": "BBSR001",
            "flow_type": "GENERAL_WARD",
            "specialty": "Cardiology",
            "bed_type": "Standard",
            "bed_unit_id": f"CARD-GEN-F-{uuid.uuid4().hex[:4]}",
            "patient_name": "Test Patient",
            "contact_mobile": "9876543210",
        }).json()
        conn = get_connection()
        conn.execute(
            "UPDATE bed_requests SET otp_code = ? WHERE id = ?",
            (created["dev_otp"], created["request_id"]),
        )
        conn.commit()
        conn.close()
        init_db()

        conn = get_connection()
        stored_otp = conn.execute(
            "SELECT otp_code FROM bed_requests WHERE id = ?", (created["request_id"],)
        ).fetchone()["otp_code"]
        conn.close()
        self.assertNotEqual(stored_otp, created["dev_otp"])
        wrong_otp = f"{(int(created['dev_otp']) + 1) % 1000000:06d}"
        for _ in range(5):
            wrong_attempt = self.client.post("/api/requests/verify", json={
                "request_id": created["request_id"], "otp_code": wrong_otp
            })
            self.assertEqual(wrong_attempt.status_code, 400)
        limited = self.client.post("/api/requests/verify", json={
            "request_id": created["request_id"], "otp_code": created["dev_otp"]
        })
        self.assertEqual(limited.status_code, 429)

    def test_production_booking_fails_closed_without_sms_provider(self):
        with patch.dict(os.environ, {"APP_ENV": "production"}):
            response = self.client.post("/api/requests/hold", json={
                "hospital_id": "BBSR001",
                "flow_type": "EMERGENCY",
                "specialty": "Emergency",
                "bed_type": "ICU",
                "patient_name": "Test Patient",
                "contact_mobile": "9876543210",
            })
        self.assertEqual(response.status_code, 503)
        self.assertIn("SMS OTP delivery provider", response.json()["detail"])

    def test_active_bed_is_exclusively_held_per_hospital(self):
        payload = {
            "hospital_id": f"TEST-{uuid.uuid4().hex[:8]}",
            "flow_type": "GENERAL_WARD",
            "specialty": "Cardiology",
            "bed_type": "General Ward (Female)",
            "bed_unit_id": "CARD-GEN-F-01",
            "patient_name": "Test Patient",
            "contact_mobile": "9876543210",
        }
        first = self.client.post("/api/requests/hold", json=payload).json()
        second_client = TestClient(app)
        mobile = str(1000000000 + (uuid.uuid4().int % 9000000000))
        self.assertEqual(second_client.post("/api/auth/register", json={
            "name": "Second Patient",
            "mobile": mobile,
            "password": "test-password-123",
        }).status_code, 200)
        second = second_client.post("/api/requests/hold", json=payload).json()
        self.assertEqual(self.client.post("/api/requests/verify", json={
            "request_id": first["request_id"], "otp_code": first["dev_otp"]
        }).status_code, 200)
        conflict = second_client.post("/api/requests/verify", json={
            "request_id": second["request_id"], "otp_code": second["dev_otp"]
        })
        self.assertEqual(conflict.status_code, 409)
        live_units = self.client.get(
            f"/api/requests/units/{payload['hospital_id']}/Cardiology"
        ).json()["units"]
        selected_unit = next(unit for unit in live_units if unit["unit_id"] == payload["bed_unit_id"])
        self.assertEqual(selected_unit["status"], "30_MIN_HOLD")
        other_hospital_units = self.client.get(
            f"/api/requests/units/{payload['hospital_id']}-OTHER/Cardiology"
        ).json()["units"]
        other_hospital_unit = next(
            unit for unit in other_hospital_units if unit["unit_id"] == payload["bed_unit_id"]
        )
        self.assertEqual(other_hospital_unit["status"], "AVAILABLE")

    def test_get_hospitals_top_n(self):
        res = self.client.get("/api/hospitals?top_n=5")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total_displayed"], 10)
        self.assertEqual(sum(1 for h in data["hospitals"] if h["is_in_top_n"]), 5)

    def test_hospital_ward_vacancy_percentage(self):
        res = self.client.get("/api/hospitals?top_n=21")
        self.assertEqual(res.status_code, 200)
        neelachal = next(
            hospital for hospital in res.json()["hospitals"]
            if hospital["hospital_id"] == "BBSR020"
        )
        self.assertEqual(neelachal["general_ward_vacancy_pct"], 19.1)
        self.assertEqual(neelachal["general_ward_reported_at"], "2026-10-10T00:00:00+00:00")

    def test_demo_forecast_is_explicitly_non_operational(self):
        res = self.client.get("/api/hospitals?top_n=1")
        self.assertEqual(res.status_code, 200)
        hospital = res.json()["hospitals"][0]
        self.assertEqual(hospital["forecast_mode"], "synthetic_demo")
        self.assertFalse(hospital["forecast_is_operational"])
        self.assertGreaterEqual(hospital["forecast_available_beds_24h"], 0)
        self.assertGreaterEqual(hospital["forecast_vacancy_pct_24h"], 0)
        self.assertLessEqual(hospital["forecast_vacancy_pct_24h"], 100)

    def test_route_endpoint_and_legacy_alias(self):
        route_data = {
            "coordinates": [[20.2961, 85.8245], [20.2317, 85.7788]],
            "distance_km": 8.2,
            "eta_minutes": 18,
            "google_maps_url": "https://maps.google.com/",
            "provider": "OSRM OpenStreetMap Driving Engine",
        }
        approximate_route = {**route_data, "provider": "Direct Intercept Model"}
        with patch("core.routing.RoutingService.get_route_geometry", return_value=route_data):
            params = "origin_lat=20.2961&origin_lon=85.8245&dest_lat=20.2317&dest_lon=85.7788"
            api_response = self.client.get(f"/api/route?{params}")
            legacy_response = self.client.get(f"/route?{params}")
        with patch("core.routing.RoutingService.get_route_geometry", return_value=approximate_route):
            estimated_response = self.client.get(f"/api/route?{params}")

        self.assertEqual(api_response.status_code, 200)
        self.assertEqual(legacy_response.status_code, 200)
        self.assertEqual(api_response.json()["coordinates"], route_data["coordinates"])
        self.assertTrue(api_response.json()["is_real_road"])
        self.assertFalse(estimated_response.json()["is_real_road"])
        self.assertEqual(legacy_response.json()["status"], "success")

    def test_hold_lifecycle(self):
        hold_res = self.client.post("/api/requests/hold", json={
            "hospital_id": "BBSR001",
            "flow_type": "EMERGENCY",
            "specialty": "Emergency",
            "bed_type": "ICU",
            "patient_name": "Test Patient",
            "contact_mobile": "9876543210"
        })
        self.assertEqual(hold_res.status_code, 200)
        req_id = hold_res.json()["request_id"]
        otp = hold_res.json()["dev_otp"]
        
        # Verify OTP
        verify_res = self.client.post("/api/requests/verify", json={
            "request_id": req_id,
            "otp_code": otp
        })
        self.assertEqual(verify_res.status_code, 200)
        self.assertEqual(verify_res.json()["status"], "HELD")
        self.assertEqual(verify_res.json()["remaining_seconds"], 1800)
        own_requests = self.client.get("/api/requests/mine")
        self.assertEqual(own_requests.status_code, 200)
        self.assertIn(req_id, [item["request_id"] for item in own_requests.json()["requests"]])
        self.assertNotIn("otp_code", own_requests.json()["requests"][0])
        status_res = self.client.get(f"/api/requests/{req_id}")
        self.assertEqual(status_res.status_code, 200)
        self.assertEqual(status_res.json()["status"], "HELD")

        admitted_res = self.client.post(f"/api/requests/{req_id}/checkin")
        self.assertEqual(admitted_res.status_code, 200)
        self.assertEqual(admitted_res.json()["status"], "ADMITTED")
        declined_after_admission = self.client.post(f"/api/requests/{req_id}/cancel")
        self.assertEqual(declined_after_admission.status_code, 409)
        staff_id, staff_headers = self.create_desk_staff("BBSR001")
        unauthorized_release = self.client.post(f"/api/requests/{req_id}/discharge")
        released = self.client.post(
            f"/api/requests/{req_id}/discharge",
            headers=staff_headers,
        )
        events = self.client.get(
            f"/api/requests/{req_id}/events",
            headers=staff_headers,
        )
        self.assertEqual(unauthorized_release.status_code, 401)
        self.assertEqual(released.status_code, 200)
        self.assertEqual(released.json()["status"], "DISCHARGED")
        self.assertEqual(
            [event["to_status"] for event in events.json()["events"]],
            ["OTP_PENDING", "HELD", "ADMITTED", "DISCHARGED"],
        )
        self.assertEqual(events.json()["events"][-1]["actor_id"], staff_id)

    def test_desk_portal_requires_token_and_does_not_return_otp(self):
        unauthorized = self.client.get("/api/requests/portal/active")
        _, staff_headers = self.create_desk_staff("BBSR001")
        authorized = self.client.get(
            "/api/requests/portal/active",
            headers=staff_headers,
        )
        self.assertEqual(unauthorized.status_code, 401)
        self.assertEqual(authorized.status_code, 200)
        self.assertEqual(authorized.json()["staff"]["hospital_id"], "BBSR001")
        self.assertTrue(all("otp_code" not in row for row in authorized.json()["requests"]))

    def test_staff_tokens_are_hospital_scoped_and_revocable(self):
        hospital_id = f"TEST-{uuid.uuid4().hex[:8]}"
        request_data = {
            "hospital_id": hospital_id,
            "flow_type": "GENERAL_WARD",
            "specialty": "Cardiology",
            "bed_type": "General Ward (Female)",
            "bed_unit_id": "CARD-GEN-F-01",
            "patient_name": "Test Patient",
            "contact_mobile": "9876543210",
        }
        created = self.client.post("/api/requests/hold", json=request_data).json()
        self.assertEqual(self.client.post("/api/requests/verify", json={
            "request_id": created["request_id"],
            "otp_code": created["dev_otp"],
        }).status_code, 200)
        self.assertEqual(self.client.post(f"/api/requests/{created['request_id']}/checkin").status_code, 200)

        _, wrong_hospital_headers = self.create_desk_staff("BBSR001")
        forbidden = self.client.post(
            f"/api/requests/{created['request_id']}/discharge",
            headers=wrong_hospital_headers,
        )
        self.assertEqual(forbidden.status_code, 404)

        staff_id, staff_headers = self.create_desk_staff(hospital_id)
        listed = self.client.get("/api/requests/portal/active", headers=staff_headers)
        self.assertEqual(listed.status_code, 200)
        self.assertTrue(all(row["hospital_id"] == hospital_id for row in listed.json()["requests"]))

        conn = get_connection()
        conn.execute("UPDATE desk_staff SET active = 0 WHERE staff_id = ?", (staff_id,))
        conn.commit()
        conn.close()
        revoked = self.client.get("/api/requests/portal/active", headers=staff_headers)
        self.assertEqual(revoked.status_code, 401)

    def test_staff_provisioning_command_rotates_and_revokes_individual_tokens(self):
        staff_id = f"operator-{uuid.uuid4().hex[:8]}"
        script = os.path.abspath(os.path.join(
            os.path.dirname(__file__), "..", "db", "provision_desk_staff.py"
        ))
        first = subprocess.run(
            [
                sys.executable, script,
                "--staff-id", staff_id,
                "--hospital-id", "BBSR001",
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        first_token = first.stdout.strip().splitlines()[-1]
        first_headers = {"X-Hospital-Staff-Token": first_token}
        self.assertEqual(
            self.client.get("/api/requests/portal/active", headers=first_headers).status_code,
            200,
        )

        second = subprocess.run(
            [
                sys.executable, script,
                "--staff-id", staff_id,
                "--hospital-id", "BBSR002",
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        second_token = second.stdout.strip().splitlines()[-1]
        self.assertEqual(
            self.client.get("/api/requests/portal/active", headers=first_headers).status_code,
            401,
        )
        second_headers = {"X-Hospital-Staff-Token": second_token}
        self.assertEqual(
            self.client.get("/api/requests/portal/active", headers=second_headers).json()["staff"]["hospital_id"],
            "BBSR002",
        )

        subprocess.run(
            [
                sys.executable, script,
                "--staff-id", staff_id,
                "--revoke",
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertEqual(
            self.client.get("/api/requests/portal/active", headers=second_headers).status_code,
            401,
        )

    def test_discharge_rejects_unadmitted_booking(self):
        _, staff_headers = self.create_desk_staff("BBSR001")
        response = self.client.post(
            "/api/requests/not-a-request/discharge",
            headers=staff_headers,
        )
        self.assertEqual(response.status_code, 404)

    def test_discharged_bed_is_available_again(self):
        hospital_id = f"TEST-{uuid.uuid4().hex[:8]}"
        unit_id = "CARD-GEN-M-03"
        created = self.client.post("/api/requests/hold", json={
            "hospital_id": hospital_id,
            "flow_type": "GENERAL_WARD",
            "specialty": "Cardiology",
            "bed_type": "General Ward (Male)",
            "bed_unit_id": unit_id,
            "patient_name": "Test Patient",
            "contact_mobile": "9876543210",
        }).json()
        self.assertEqual(self.client.post("/api/requests/verify", json={
            "request_id": created["request_id"],
            "otp_code": created["dev_otp"],
        }).status_code, 200)
        _, staff_headers = self.create_desk_staff(hospital_id)
        admitted = self.client.post(
            f"/api/requests/{created['request_id']}/checkin",
            headers=staff_headers,
        )
        self.assertEqual(admitted.status_code, 200)
        discharged = self.client.post(
            f"/api/requests/{created['request_id']}/discharge",
            headers=staff_headers,
        )
        self.assertEqual(discharged.status_code, 200)
        units = self.client.get(f"/api/requests/units/{hospital_id}/Cardiology").json()["units"]
        released_unit = next(unit for unit in units if unit["unit_id"] == unit_id)
        self.assertEqual(released_unit["status"], "AVAILABLE")

    def test_decline_releases_verified_hold(self):
        create_res = self.client.post("/api/requests/hold", json={
            "hospital_id": "BBSR001",
            "flow_type": "GENERAL_WARD",
            "specialty": "Cardiology",
            "bed_type": "Standard",
            "bed_unit_id": "CARD-GEN-M-01",
            "patient_name": "Test Patient",
            "contact_mobile": "9876543210"
        })
        self.assertEqual(create_res.status_code, 200)
        request_id = create_res.json()["request_id"]
        verify_res = self.client.post("/api/requests/verify", json={
            "request_id": request_id,
            "otp_code": create_res.json()["dev_otp"]
        })
        self.assertEqual(verify_res.status_code, 200)
        cancel_res = self.client.post(f"/api/requests/{request_id}/cancel")
        self.assertEqual(cancel_res.status_code, 200)
        self.assertEqual(cancel_res.json()["status"], "CANCELLED")
        self.assertEqual(self.client.get(f"/api/requests/{request_id}").json()["status"], "CANCELLED")

    def test_expired_hold_cannot_be_marked_admitted(self):
        create_res = self.client.post("/api/requests/hold", json={
            "hospital_id": "BBSR001",
            "flow_type": "EMERGENCY",
            "specialty": "Emergency",
            "bed_type": "ICU",
            "patient_name": "Test Patient",
            "contact_mobile": "9876543210"
        })
        request_id = create_res.json()["request_id"]
        verify_res = self.client.post("/api/requests/verify", json={
            "request_id": request_id,
            "otp_code": create_res.json()["dev_otp"]
        })
        self.assertEqual(verify_res.status_code, 200)

        conn = get_connection()
        conn.execute(
            "UPDATE bed_requests SET hold_expires_at = ? WHERE id = ?",
            ((datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat(), request_id),
        )
        conn.commit()
        conn.close()

        status_res = self.client.get(f"/api/requests/{request_id}")
        self.assertEqual(status_res.status_code, 200)
        self.assertEqual(status_res.json()["status"], "EXPIRED")
        admitted_res = self.client.post(f"/api/requests/{request_id}/checkin")
        self.assertEqual(admitted_res.status_code, 409)

    def test_live_bed_units_reflect_hold_and_booked_states(self):
        hospital_id = f"TEST-{uuid.uuid4().hex[:8]}"
        available_unit = "CARD-GEN-F-02"
        units_res = self.client.get(
            f"/api/requests/units/{hospital_id}/Cardiology"
        )
        self.assertEqual(units_res.status_code, 200)
        units = {unit["unit_id"]: unit for unit in units_res.json()["units"]}
        self.assertEqual(len(units), 14)
        self.assertEqual(units["CARD-GEN-M-03"]["status"], "OCCUPIED")
        self.assertEqual(units[available_unit]["status"], "AVAILABLE")

        create_res = self.client.post("/api/requests/hold", json={
            "hospital_id": hospital_id,
            "flow_type": "GENERAL_WARD",
            "specialty": "Cardiology",
            "bed_type": "General Ward (Female)",
            "bed_unit_id": available_unit,
            "patient_name": "Test Patient",
            "contact_mobile": "9876543210"
        })
        self.assertEqual(create_res.status_code, 200)
        request_id = create_res.json()["request_id"]
        verify_res = self.client.post("/api/requests/verify", json={
            "request_id": request_id,
            "otp_code": create_res.json()["dev_otp"]
        })
        self.assertEqual(verify_res.status_code, 200)

        held_units = self.client.get(
            f"/api/requests/units/{hospital_id}/Cardiology"
        ).json()["units"]
        held_unit = next(unit for unit in held_units if unit["unit_id"] == available_unit)
        self.assertEqual(held_unit["status"], "30_MIN_HOLD")
        self.assertTrue(held_unit["hold_expires_at"])

        self.client.post(f"/api/requests/{request_id}/cancel")
        released_units = self.client.get(
            f"/api/requests/units/{hospital_id}/Cardiology"
        ).json()["units"]
        released_unit = next(unit for unit in released_units if unit["unit_id"] == available_unit)
        self.assertEqual(released_unit["status"], "AVAILABLE")

    def test_chatbot_faq_fallback(self):
        with patch.dict(os.environ, {"ENABLE_EXTERNAL_CHAT": "false"}):
            chat_res = self.client.post("/api/chat", json={"message": "What is the ranking formula?"})
        self.assertEqual(chat_res.status_code, 200)
        self.assertIn("Score = 1000 * Rating", chat_res.json()["response"])

    def test_auth_registration_and_login(self):
        phone = f"9{uuid.uuid4().int % 1000000000:09d}"
        reg_res = self.client.post("/api/auth/register", json={
            "name": "Ananya Sharma",
            "mobile": phone,
            "password": "Password123",
            "has_pmjay": True,
            "pmjay_card_number": "PMJAY-OD-998877"
        })
        self.assertEqual(reg_res.status_code, 200)
        
        login_res = self.client.post("/api/auth/login", json={
            "mobile": phone,
            "password": "Password123"
        })
        self.assertEqual(login_res.status_code, 200)
        self.assertEqual(login_res.json()["user"]["name"], "Ananya Sharma")

if __name__ == "__main__":
    unittest.main()
