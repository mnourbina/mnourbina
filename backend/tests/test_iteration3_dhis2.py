"""KHALABA iteration 3 — DHIS2/MSP indicators tests.

Covers:
- GET /api/analytics/dhis2-indicators (admin only, period -> date range)
- GET /api/analytics/dhis2-export (DHIS2 DataValueSet JSON + audit log)
- GET /api/audit-logs (admin only, lists EXPORT_DHIS2 entries)
- GET /api/analytics/dhis2-indicators/export.csv (semicolon, 9 columns)
- Indicator computation correctness with seeded data
"""
import os
import csv
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@khalaba.health", "password": "khalaba2026"}
SOIGNANT = {"email": "sagefemme@khalaba.health", "password": "khalaba2026"}
PATIENT = {"email": "maman@khalaba.health", "password": "khalaba2026"}

EXPECTED_CODES = [
    "DE_CPN1_TOTAL", "DE_CPN4_TOTAL", "DE_ANEMIA_PREG",
    "DE_VIH_TESTED", "DE_VIH_POS",
    "DE_SYPH_TESTED", "DE_SYPH_POS",
    "DE_MATERNAL_DEATH", "DE_NEONATAL_DEATH", "DE_MPDSR_AUDITED",
]


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    r2 = s.post(f"{API}/auth/verify-otp",
                json={"temp_token": body["temp_token"], "otp_code": body["otp_code"]},
                timeout=30)
    assert r2.status_code == 200, r2.text
    return s, r2.json()


@pytest.fixture(scope="module")
def admin_session():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def soignant_session():
    return _login(SOIGNANT)


@pytest.fixture(scope="module")
def patient_session():
    return _login(PATIENT)


# ----- seed data -----
@pytest.fixture(scope="module")
def seeded_data(soignant_session, admin_session):
    """Create a TEST_ patient + pregnancy + 2 CPN visits + 1 MPDSR in 2026-02."""
    s_soig, u_soig = soignant_session
    s_adm, _ = admin_session

    # Get a zone (soignant's zone)
    z_resp = s_adm.get(f"{API}/zones", timeout=10)
    assert z_resp.status_code == 200
    zones = z_resp.json()
    zone_id = u_soig.get("zone_id") or (zones[0]["id"] if zones else None)
    assert zone_id

    # Create patient
    p = s_soig.post(f"{API}/patients", json={
        "full_name": "TEST_DHIS2 Mère",
        "phone": "+23566001122",
        "zone_id": zone_id,
        "dob": "1995-04-12",
    }, timeout=15)
    assert p.status_code in (200, 201), p.text
    patient_id = p.json()["id"]

    # Create pregnancy
    pr = s_soig.post(f"{API}/pregnancies", json={
        "patient_id": patient_id,
        "lmp_date": "2025-08-01",
    }, timeout=15)
    assert pr.status_code in (200, 201), pr.text
    pregnancy_id = pr.json()["id"]

    # CPN 1 in Feb 2026 with anaemia (Hb=8), hiv negative, syph positive
    v1 = s_soig.post(f"{API}/cpn-visits", json={
        "pregnancy_id": pregnancy_id,
        "visit_date": "2026-02-05",
        "visit_number": 1,
        "hemoglobin": 8.0,
        "hiv_status": "negatif",
        "syphilis_status": "positif",
    }, timeout=15)
    assert v1.status_code in (200, 201), v1.text

    # CPN 4 in Feb 2026, hiv negative
    v2 = s_soig.post(f"{API}/cpn-visits", json={
        "pregnancy_id": pregnancy_id,
        "visit_date": "2026-02-18",
        "visit_number": 4,
        "hemoglobin": 12.0,
        "hiv_status": "negatif",
        "syphilis_status": "negatif",
    }, timeout=15)
    assert v2.status_code in (200, 201), v2.text

    # MPDSR maternal death 2026-02-10 audited 2026-02-25 (15j)
    m = s_soig.post(f"{API}/mpdsr", json={
        "patient_id": patient_id,
        "death_type": "maternelle",
        "death_date": "2026-02-10",
        "place_of_death": "Maternité TEST",
        "medical_cause": "Hémorragie",
        "summary": "TEST_ MPDSR audité",
        "audit_status": "audite_en_comite",
        "audit_date": "2026-02-25",
    }, timeout=15)
    assert m.status_code in (200, 201), m.text

    return {"zone_id": zone_id, "patient_id": patient_id, "pregnancy_id": pregnancy_id}


# ----- dhis2-indicators -----
class TestDhis2Indicators:
    def test_admin_ok_period_yyyymm(self, admin_session, seeded_data):
        s, _ = admin_session
        r = s.get(f"{API}/analytics/dhis2-indicators", params={"period": "202602"}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert set(body.keys()) >= {"filters", "indicators", "zones", "generated_at"}
        # period derives date range
        assert body["filters"]["period"] == "202602"
        assert body["filters"]["date_from"] == "2026-02-01"
        assert body["filters"]["date_to"] == "2026-02-28"
        # 10 indicators with right codes
        codes = [i["code"] for i in body["indicators"]]
        assert codes == EXPECTED_CODES
        for ind in body["indicators"]:
            assert set(ind.keys()) >= {"code", "label", "formula", "category", "value"}
            assert isinstance(ind["value"], int)

    def test_indicator_values_with_seed(self, admin_session, seeded_data):
        s, _ = admin_session
        r = s.get(f"{API}/analytics/dhis2-indicators", params={"period": "202602"}, timeout=20)
        assert r.status_code == 200
        vmap = {i["code"]: i["value"] for i in r.json()["indicators"]}
        assert vmap["DE_CPN1_TOTAL"] >= 1
        assert vmap["DE_ANEMIA_PREG"] >= 1
        assert vmap["DE_VIH_TESTED"] >= 2
        assert vmap["DE_VIH_POS"] == 0
        assert vmap["DE_SYPH_POS"] >= 1
        assert vmap["DE_MATERNAL_DEATH"] >= 1
        assert vmap["DE_MPDSR_AUDITED"] >= 1

    def test_soignant_forbidden(self, soignant_session):
        s, _ = soignant_session
        r = s.get(f"{API}/analytics/dhis2-indicators", params={"period": "202602"}, timeout=15)
        assert r.status_code == 403, r.text

    def test_patient_forbidden(self, patient_session):
        s, _ = patient_session
        r = s.get(f"{API}/analytics/dhis2-indicators", params={"period": "202602"}, timeout=15)
        assert r.status_code == 403, r.text

    def test_zone_filter(self, admin_session, seeded_data):
        s, _ = admin_session
        r = s.get(f"{API}/analytics/dhis2-indicators",
                  params={"period": "202602", "zone_id": seeded_data["zone_id"]},
                  timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["filters"]["zone_id"] == seeded_data["zone_id"]
        assert body["filters"]["zone_label"] and body["filters"]["zone_label"] != "Toutes zones"


# ----- dhis2-export -----
class TestDhis2Export:
    def test_admin_ok_datavalueset_shape(self, admin_session, seeded_data):
        s, _ = admin_session
        r = s.get(f"{API}/analytics/dhis2-export", params={"period": "202602"}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["dataSet"] == "KHALABA_MNCH_MONTHLY"
        assert body["period"] == "202602"
        assert body["orgUnit"] == "NATIONAL"
        assert body["attributeOptionCombo"] == "default"
        assert "completeDate" in body
        assert isinstance(body["dataValues"], list)
        assert len(body["dataValues"]) == 10
        codes = [dv["dataElement"] for dv in body["dataValues"]]
        assert codes == EXPECTED_CODES
        for dv in body["dataValues"]:
            assert "value" in dv

    def test_zone_id_used_as_orgunit(self, admin_session, seeded_data):
        s, _ = admin_session
        r = s.get(f"{API}/analytics/dhis2-export",
                  params={"period": "202602", "zone_id": seeded_data["zone_id"]},
                  timeout=20)
        assert r.status_code == 200
        assert r.json()["orgUnit"] == seeded_data["zone_id"]

    def test_invalid_period_length(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/analytics/dhis2-export", params={"period": "2026"}, timeout=15)
        assert r.status_code == 400

    def test_invalid_period_non_numeric(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/analytics/dhis2-export", params={"period": "20XXMM"}, timeout=15)
        assert r.status_code == 400

    def test_non_admin_forbidden(self, soignant_session, patient_session):
        s1, _ = soignant_session
        r1 = s1.get(f"{API}/analytics/dhis2-export", params={"period": "202602"}, timeout=15)
        assert r1.status_code == 403
        s2, _ = patient_session
        r2 = s2.get(f"{API}/analytics/dhis2-export", params={"period": "202602"}, timeout=15)
        assert r2.status_code == 403


# ----- audit-logs -----
class TestAuditLogs:
    def test_audit_log_written_on_export(self, admin_session):
        s, _ = admin_session
        # Trigger an export
        period = "202603"
        r = s.get(f"{API}/analytics/dhis2-export", params={"period": period}, timeout=20)
        assert r.status_code == 200
        # Fetch logs
        rl = s.get(f"{API}/audit-logs", timeout=15)
        assert rl.status_code == 200, rl.text
        logs = rl.json()
        assert isinstance(logs, list)
        # Find at least one EXPORT_DHIS2 for our period
        matching = [l for l in logs if l.get("action") == "EXPORT_DHIS2" and l.get("entity_id") == period]
        assert matching, f"No EXPORT_DHIS2 audit log found for period {period}"
        entry = matching[0]
        assert set(entry.keys()) >= {"id", "user_id", "user_email", "action", "entity", "entity_id", "zone_id", "values_summary", "created_at"}
        assert entry["entity"] == "Report"
        assert entry["user_email"] == ADMIN["email"]
        assert isinstance(entry["values_summary"], dict)

    def test_audit_logs_non_admin_forbidden(self, soignant_session):
        s, _ = soignant_session
        r = s.get(f"{API}/audit-logs", timeout=15)
        assert r.status_code == 403


# ----- CSV export -----
class TestDhis2Csv:
    def test_csv_admin_ok(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/analytics/dhis2-indicators/export.csv",
                  params={"period": "202602"}, timeout=20)
        assert r.status_code == 200, r.text
        assert "text/csv" in r.headers.get("content-type", "")
        text = r.text
        reader = csv.reader(io.StringIO(text), delimiter=";")
        rows = list(reader)
        assert len(rows) >= 11  # 1 header + 10 indicators
        header = rows[0]
        assert len(header) == 9
        # Each indicator row has 9 columns
        for row in rows[1:11]:
            assert len(row) == 9
        codes_in_csv = [row[0] for row in rows[1:11]]
        assert codes_in_csv == EXPECTED_CODES


# ----- MPDSR audit fields (regression) -----
class TestMpdsrAuditFields:
    def test_create_mpdsr_with_audit(self, soignant_session):
        s, _ = soignant_session
        # Pick any existing patient in zone (use one from list)
        plist = s.get(f"{API}/patients", timeout=15)
        assert plist.status_code == 200
        patients = plist.json()
        if not patients:
            pytest.skip("No patients in soignant zone")
        pid = patients[0]["id"]
        r = s.post(f"{API}/mpdsr", json={
            "patient_id": pid,
            "death_type": "neonatale",
            "death_date": "2026-03-05",
            "place_of_death": "TEST_ Hosp",
            "medical_cause": "Test",
            "summary": "TEST_ audit",
            "audit_status": "en_attente",
            "audit_date": None,
        }, timeout=15)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body["audit_status"] == "en_attente"

    def test_mpdsr_list_includes_audit(self, soignant_session):
        s, _ = soignant_session
        r = s.get(f"{API}/mpdsr", timeout=15)
        assert r.status_code == 200
        for item in r.json():
            # audit_status key should always exist (even default "non_audite")
            assert "audit_status" in item
