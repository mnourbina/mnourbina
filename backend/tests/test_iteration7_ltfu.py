"""KHALABA Brique 7 — LTFU (Perdues de vue) automatic detection."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@khalaba.health", "password": "khalaba2026"}
SOIGNANT = {"email": "sagefemme@khalaba.health", "password": "khalaba2026"}
PATIENT = {"email": "maman@khalaba.health", "password": "khalaba2026"}


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


@pytest.fixture(scope="module")
def pat():
    return _login(PATIENT)


class TestLTFU:
    def test_check_ltfu_admin_ok(self, adm):
        s, _ = adm
        r = s.post(f"{API}/admin/check-ltfu", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("scanned_at", "threshold_days", "flagged_count", "newly_flagged", "flagged"):
            assert k in data
        assert data["threshold_days"] == 14
        assert isinstance(data["flagged"], list)

    def test_check_ltfu_idempotent(self, adm):
        """Second consecutive scan should produce 0 newly_flagged."""
        s, _ = adm
        s.post(f"{API}/admin/check-ltfu", timeout=30)  # first
        r = s.post(f"{API}/admin/check-ltfu", timeout=30)  # second
        assert r.status_code == 200
        assert r.json()["newly_flagged"] == []

    def test_ltfu_list_admin(self, adm):
        s, _ = adm
        # Ensure at least one scan has run
        s.post(f"{API}/admin/check-ltfu", timeout=30)
        r = s.get(f"{API}/admin/ltfu", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            row = data[0]
            for k in ("alert_id", "pregnancy_id", "patient", "message",
                      "days_late", "weeks_late", "expected_cpn_label", "created_at"):
                assert k in row, f"missing {k}"

    def test_ltfu_list_soignant_ok(self, soig):
        s, _ = soig
        r = s.get(f"{API}/admin/ltfu", timeout=15)
        assert r.status_code == 200

    def test_ltfu_list_patient_forbidden(self, pat):
        s, _ = pat
        r = s.get(f"{API}/admin/ltfu", timeout=15)
        assert r.status_code == 403

    def test_check_ltfu_forbidden_for_soignant(self, soig):
        s, _ = soig
        r = s.post(f"{API}/admin/check-ltfu", timeout=15)
        assert r.status_code == 403

    def test_mark_found_resolves_alert_and_updates_status(self, adm):
        s, _ = adm
        # Ensure scan ran
        s.post(f"{API}/admin/check-ltfu", timeout=30)
        ltfu = s.get(f"{API}/admin/ltfu", timeout=15).json()
        if not ltfu:
            pytest.skip("No LTFU cases available to test mark-found flow")
        pid = ltfu[0]["pregnancy_id"]
        # Mark found
        r = s.post(f"{API}/pregnancies/{pid}/found",
                   json={"notes": "test"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "en_cours"
        # The PERDUE_DE_VUE alert for that pregnancy must be marked read/resolved
        alerts = s.get(f"{API}/alerts",
                       params={"pregnancy_id": pid, "type": "PERDUE_DE_VUE"},
                       timeout=15).json()
        # All must be resolved (is_read True)
        for a in alerts:
            assert a["is_read"] is True, "PERDUE_DE_VUE alert was not resolved after mark-found"
            assert a.get("resolved_at"), "resolved_at must be set"

    def test_alerts_type_filter(self, adm):
        s, _ = adm
        r = s.get(f"{API}/alerts", params={"type": "PERDUE_DE_VUE"}, timeout=15)
        assert r.status_code == 200
        for a in r.json():
            assert a["type"] == "PERDUE_DE_VUE"
