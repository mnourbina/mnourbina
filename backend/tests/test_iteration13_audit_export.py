"""KHALABA Brique 13 — Audit log CSV export + patient geolocation fields."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@khalaba.health", "password": "khalaba2026"}
SOIGNANT = {"email": "sagefemme@khalaba.health", "password": "khalaba2026"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    b = r.json()
    r2 = s.post(f"{API}/auth/verify-otp",
                json={"temp_token": b["temp_token"], "otp_code": b["otp_code"]}, timeout=30)
    assert r2.status_code == 200, r2.text
    return s, r2.json()


@pytest.fixture(scope="module")
def adm():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def soig():
    return _login(SOIGNANT)


class TestAuditLogsCsvExport:
    def test_csv_export_admin(self, adm):
        s, _ = adm
        r = s.get(f"{API}/audit-logs/export.csv", timeout=20)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        # header line + at least 1 row
        lines = r.text.strip().split("\n")
        assert lines[0] == "created_at,user_email,user_role,action,entity,entity_id"
        assert len(lines) >= 2

    def test_csv_export_filter_by_action(self, adm):
        s, _ = adm
        r = s.get(f"{API}/audit-logs/export.csv",
                  params={"action": "CREATE", "entity": "Region"}, timeout=20)
        assert r.status_code == 200
        for line in r.text.strip().split("\n")[1:]:  # skip header
            cols = line.split(",")
            # action is col 3, entity is col 4
            assert cols[3] == "CREATE"
            assert cols[4] == "Region"

    def test_csv_export_forbidden_for_soignant(self, soig):
        s, _ = soig
        r = s.get(f"{API}/audit-logs/export.csv", timeout=15)
        assert r.status_code == 403

    def test_csv_export_emits_meta_audit_log(self, adm):
        s, _ = adm
        before = s.get(f"{API}/audit-logs",
                       params={"action": "EXPORT_AUDIT_LOGS", "limit": 100}, timeout=15).json()
        s.get(f"{API}/audit-logs/export.csv", timeout=20)
        after = s.get(f"{API}/audit-logs",
                      params={"action": "EXPORT_AUDIT_LOGS", "limit": 100}, timeout=15).json()
        assert len(after) > len(before)


class TestPatientGeolocation:
    def test_create_patient_with_lat_lng(self, adm):
        s, _ = adm
        zone = s.get(f"{API}/zones", timeout=15).json()[0]
        payload = {
            "full_name": f"Geo_{uuid.uuid4().hex[:6]}",
            "dob": "1995-05-05",
            "zone_id": zone["id"],
            "latitude": 12.1348,
            "longitude": 15.0557,  # N'Djamena coords (approx)
            "address": "Quartier Chagoua",
        }
        r = s.post(f"{API}/patients", json=payload, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["latitude"] == pytest.approx(12.1348)
        assert body["longitude"] == pytest.approx(15.0557)
