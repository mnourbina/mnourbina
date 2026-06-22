"""KHALABA iteration 5 — Admin KPIs (Brique 5, UNFPA-aligned)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@khalaba.health", "password": "khalaba2026"}
SOIGNANT = {"email": "sagefemme@khalaba.health", "password": "khalaba2026"}
PATIENT = {"email": "maman@khalaba.health", "password": "khalaba2026"}

EXPECTED_KPI_CODES = {"cpn4_rate", "assisted_birth_rate", "anemia_rate", "death_audit_rate"}


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


class TestAdminKpis:
    def test_admin_kpis_basic(self, adm):
        s, _ = adm
        r = s.get(f"{API}/admin/kpis", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Top-level shape
        assert "kpis" in data and isinstance(data["kpis"], list)
        assert "totals" in data and "scope" in data
        assert len(data["kpis"]) == 4
        codes = {k["code"] for k in data["kpis"]}
        assert codes == EXPECTED_KPI_CODES

    def test_admin_kpis_targets_and_direction(self, adm):
        s, _ = adm
        r = s.get(f"{API}/admin/kpis", timeout=15)
        assert r.status_code == 200, r.text
        kpis = {k["code"]: k for k in r.json()["kpis"]}
        # CPN4 / assisted_birth / death_audit are higher-is-better
        for code in ("cpn4_rate", "assisted_birth_rate", "death_audit_rate"):
            assert kpis[code]["target_direction"] == "higher", code
        # Anemia is lower-is-better
        assert kpis["anemia_rate"]["target_direction"] == "lower"
        # Each KPI has required fields
        for k in kpis.values():
            for field in ("label", "description", "value", "unit", "numerator",
                          "denominator", "target", "on_track"):
                assert field in k, f"missing {field} in {k['code']}"
            assert k["unit"] == "%"
            assert isinstance(k["value"], (int, float))
            assert isinstance(k["on_track"], bool)

    def test_admin_kpis_unfpa_targets(self, adm):
        s, _ = adm
        kpis = {k["code"]: k for k in s.get(f"{API}/admin/kpis", timeout=15).json()["kpis"]}
        assert kpis["cpn4_rate"]["target"] == 75.0
        assert kpis["assisted_birth_rate"]["target"] == 85.0
        assert kpis["anemia_rate"]["target"] == 20.0
        assert kpis["death_audit_rate"]["target"] == 95.0

    def test_admin_kpis_zone_filter(self, adm):
        s, _ = adm
        # fetch any zone
        zones = s.get(f"{API}/zones", timeout=15).json()
        assert isinstance(zones, list) and zones
        zid = zones[0]["id"]
        r = s.get(f"{API}/admin/kpis", params={"zone_id": zid}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["scope"]["zone_id"] == zid

    def test_admin_kpis_date_range(self, adm):
        s, _ = adm
        r = s.get(f"{API}/admin/kpis",
                  params={"date_from": "2025-01-01", "date_to": "2026-12-31"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["scope"]["date_from"] == "2025-01-01"
        assert data["scope"]["date_to"] == "2026-12-31"

    def test_admin_kpis_forbidden_for_soignant(self, soig):
        s, _ = soig
        r = s.get(f"{API}/admin/kpis", timeout=15)
        assert r.status_code == 403, r.text

    def test_admin_kpis_forbidden_for_patient(self, pat):
        s, _ = pat
        r = s.get(f"{API}/admin/kpis", timeout=15)
        assert r.status_code == 403, r.text
