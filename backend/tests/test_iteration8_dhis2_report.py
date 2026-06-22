"""KHALABA Brique 8 — DHIS2 DataValueSet JSON export for district monthly report."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@khalaba.health", "password": "khalaba2026"}
SOIGNANT = {"email": "sagefemme@khalaba.health", "password": "khalaba2026"}

EXPECTED_DATA_ELEMENTS = {
    "ANC1", "ANC1_VISIT", "ANC4_VISIT", "DEL_FACILITY",
    "ANEMIA_SCR", "ANEMIA_CASE", "HIV_TEST", "HIV_POS",
    "MAT_DEATH", "NEO_DEATH",
}


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


class TestDhis2Report:
    def test_dhis2_report_shape(self, adm):
        s, _ = adm
        r = s.get(f"{API}/reports/dhis2", params={"month": 6, "year": 2026}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # DHIS2 spec fields
        for k in ("dataSet", "completeDate", "period", "orgUnit", "attributeOptionCombo", "dataValues"):
            assert k in data, f"missing field {k}"
        assert data["dataSet"] == "MATERNAL_HEALTH_MONTHLY"
        assert data["period"] == "202606"
        assert data["attributeOptionCombo"] == "DEFAULT"

    def test_dhis2_report_data_values(self, adm):
        s, _ = adm
        r = s.get(f"{API}/reports/dhis2", params={"month": 6, "year": 2026}, timeout=15)
        data = r.json()
        elements = {dv["dataElement"] for dv in data["dataValues"]}
        assert elements == EXPECTED_DATA_ELEMENTS
        # All values must be DHIS2-compliant strings
        for dv in data["dataValues"]:
            assert dv["categoryOptionCombo"] == "DEFAULT"
            assert isinstance(dv["value"], str)
            assert int(dv["value"]) >= 0  # numeric content

    def test_dhis2_report_zone_filter(self, adm):
        s, _ = adm
        zones = s.get(f"{API}/zones", timeout=15).json()
        zid = zones[0]["id"]
        r = s.get(f"{API}/reports/dhis2",
                  params={"month": 6, "year": 2026, "zone_id": zid}, timeout=15)
        assert r.status_code == 200
        assert r.json()["orgUnit"] == zid

    def test_dhis2_report_forbidden_for_soignant(self, soig):
        s, _ = soig
        r = s.get(f"{API}/reports/dhis2", params={"month": 6, "year": 2026}, timeout=15)
        assert r.status_code == 403

    def test_dhis2_report_invalid_month(self, adm):
        s, _ = adm
        r = s.get(f"{API}/reports/dhis2", params={"month": 13, "year": 2026}, timeout=15)
        assert r.status_code == 400

    def test_dhis2_report_creates_audit_log(self, adm):
        s, _ = adm
        before = s.get(f"{API}/audit-logs", params={"limit": 50}, timeout=15).json()
        before_count = sum(1 for a in before if a.get("action") == "EXPORT_DHIS2_REPORT")
        s.get(f"{API}/reports/dhis2", params={"month": 6, "year": 2026}, timeout=15)
        after = s.get(f"{API}/audit-logs", params={"limit": 50}, timeout=15).json()
        after_count = sum(1 for a in after if a.get("action") == "EXPORT_DHIS2_REPORT")
        assert after_count > before_count, "EXPORT_DHIS2_REPORT audit log not created"
