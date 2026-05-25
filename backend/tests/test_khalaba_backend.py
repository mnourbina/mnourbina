"""KHALABA backend regression tests.

Covers: auth, RBAC, facilities, patients, pregnancies, CPN,
vaccines, alerts, dashboard KPIs, admin exports.
"""
import os
import io
import csv
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://maternal-africa.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@khalaba.health", "Khalaba2026!")
GYNO = ("gyneco@khalaba.health", "Khalaba2026!")
MIDWIFE = ("sagefemme@khalaba.health", "Khalaba2026!")
PATIENT = ("patiente@khalaba.health", "Khalaba2026!")


# -------------------- fixtures --------------------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data["user"]


@pytest.fixture(scope="session")
def admin_token():
    t, _ = _login(*ADMIN)
    return t


@pytest.fixture(scope="session")
def midwife_token():
    t, _ = _login(*MIDWIFE)
    return t


@pytest.fixture(scope="session")
def midwife_user():
    _, u = _login(*MIDWIFE)
    return u


@pytest.fixture(scope="session")
def patient_token():
    t, _ = _login(*PATIENT)
    return t


@pytest.fixture(scope="session")
def patient_user():
    _, u = _login(*PATIENT)
    return u


def H(token):
    return {"Authorization": f"Bearer {token}"}


# -------------------- Auth --------------------
class TestAuth:
    def test_login_admin(self):
        t, u = _login(*ADMIN)
        assert u["role"] == "admin"
        assert u["email"] == ADMIN[0]
        assert isinstance(t, str) and len(t) > 20

    def test_login_bad_credentials(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN[0], "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_login_unknown_user(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nope@x.y", "password": "x"}, timeout=10)
        assert r.status_code == 401

    def test_me_with_token(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401


# -------------------- Facilities --------------------
class TestFacilities:
    def test_list_facilities_seeded(self, admin_token):
        r = requests.get(f"{API}/facilities", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 3
        assert all(f["country"] == "TD" for f in data)


# -------------------- Patients --------------------
class TestPatients:
    def test_midwife_lists_patients_of_facility(self, midwife_token, midwife_user):
        r = requests.get(f"{API}/patients", headers=H(midwife_token), timeout=15)
        assert r.status_code == 200
        patients = r.json()
        assert len(patients) > 0
        # restricted to midwife's facility
        for p in patients:
            assert p["facility_id"] == midwife_user["facility_id"]

    def test_search_aisha(self, midwife_token):
        r = requests.get(f"{API}/patients", headers=H(midwife_token), params={"q": "Aisha"}, timeout=10)
        assert r.status_code == 200
        names = [p["first_name"] for p in r.json()]
        assert any("Aisha" in n for n in names)

    def test_patient_cannot_list_patients(self, patient_token):
        r = requests.get(f"{API}/patients", headers=H(patient_token), timeout=10)
        assert r.status_code == 403

    def test_create_patient_as_midwife(self, midwife_token, midwife_user):
        payload = {
            "first_name": "TESTUser",
            "last_name": f"Auto{uuid.uuid4().hex[:6]}",
            "date_of_birth": "1995-01-01",
            "phone": "+23566111222",
            "facility_id": midwife_user["facility_id"],
            "parity": 1,
        }
        r = requests.post(f"{API}/patients", headers=H(midwife_token), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["first_name"] == "TESTUser"
        assert data["age"] >= 30
        # verify persistence
        r2 = requests.get(f"{API}/patients/{data['id']}", headers=H(midwife_token), timeout=10)
        assert r2.status_code == 200
        assert r2.json()["last_name"] == payload["last_name"]


# -------------------- Pregnancies + CPN + Vaccines --------------------
class TestPregnancyFlow:
    @pytest.fixture(scope="class")
    def created_patient_id(self, midwife_token, midwife_user):
        payload = {
            "first_name": "TESTPreg",
            "last_name": f"Mom{uuid.uuid4().hex[:6]}",
            "date_of_birth": "1996-05-05",
            "phone": "+23566999000",
            "facility_id": midwife_user["facility_id"],
            "parity": 0,
        }
        r = requests.post(f"{API}/patients", headers=H(midwife_token), json=payload, timeout=10)
        assert r.status_code == 200
        return r.json()["id"]

    def test_create_pregnancy_auto_edd(self, midwife_token, created_patient_id):
        lmp = (date.today() - timedelta(weeks=20)).isoformat()
        r = requests.post(
            f"{API}/pregnancies",
            headers=H(midwife_token),
            json={"patient_id": created_patient_id, "lmp_date": lmp},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        # EDD = LMP + 280 days
        expected_edd = (date.fromisoformat(lmp) + timedelta(days=280)).isoformat()
        assert d["expected_delivery_date"] == expected_edd
        assert d["gestational_age_weeks"] == 20
        assert d["status"] == "active"
        # Mother VAT doses should be created
        rv = requests.get(f"{API}/vaccines", headers=H(midwife_token), params={"patient_id": created_patient_id}, timeout=10)
        assert rv.status_code == 200
        codes = {v["vaccine_code"] for v in rv.json()}
        assert {"VAT1", "VAT2", "VAT3"}.issubset(codes)
        # Save pregnancy id for next test
        TestPregnancyFlow._preg_id = d["id"]

    def test_create_cpn_with_hta_alert(self, midwife_token):
        preg_id = TestPregnancyFlow._preg_id
        r = requests.post(
            f"{API}/cpn",
            headers=H(midwife_token),
            json={
                "pregnancy_id": preg_id,
                "contact_number": 1,
                "contact_date": date.today().isoformat(),
                "weight_kg": 65.0,
                "bp_systolic": 150,  # HTA trigger
                "bp_diastolic": 95,
                "hemoglobin": 12.0,
                "decision": "reference",
            },
            timeout=10,
        )
        assert r.status_code == 200, r.text
        cpn = r.json()
        joined = " ".join(cpn["alerts"])
        assert "HTA" in joined

    def test_list_cpn(self, midwife_token):
        r = requests.get(f"{API}/cpn", headers=H(midwife_token), params={"pregnancy_id": TestPregnancyFlow._preg_id}, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert data[0]["contact_number"] == 1

    def test_administer_vaccine(self, midwife_token, created_patient_id):
        rv = requests.get(f"{API}/vaccines", headers=H(midwife_token), params={"patient_id": created_patient_id}, timeout=10)
        dose = rv.json()[0]
        ra = requests.post(
            f"{API}/vaccines/{dose['id']}/administer",
            headers=H(midwife_token),
            json={"administered_date": date.today().isoformat()},
            timeout=10,
        )
        assert ra.status_code == 200
        assert ra.json()["status"] == "administered"


# -------------------- Alerts --------------------
class TestAlerts:
    def test_alerts_list(self, midwife_token):
        r = requests.get(f"{API}/alerts", headers=H(midwife_token), timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # at least the alert we just created
        assert any("HTA" in (a.get("message") or "") for a in data)


# -------------------- Dashboard --------------------
class TestDashboard:
    def test_kpis_19_fields(self, admin_token):
        r = requests.get(f"{API}/dashboard/kpis", headers=H(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        required = [
            "new_pregnancies", "active_pregnancies", "cpn1_rate", "cpn4_rate", "cpn8_rate",
            "cpn1_early_rate", "at_risk_rate", "institutional_deliveries", "cesarean_rate",
            "obstetric_referrals", "postnatal_mother_coverage", "postnatal_newborn_coverage",
            "maternal_vat_coverage", "child_bcg_coverage", "child_penta3_coverage",
            "maternal_deaths", "neonatal_deaths", "low_birth_weight_rate",
            "complete_records_rate", "lost_to_followup_rate", "total_patients",
        ]
        for k in required:
            assert k in d, f"missing field {k}"
            assert isinstance(d[k], (int, float))
        assert d["total_patients"] >= 12

    def test_patient_cannot_access_kpis(self, patient_token):
        r = requests.get(f"{API}/dashboard/kpis", headers=H(patient_token), timeout=10)
        assert r.status_code == 403

    def test_coverage_trend_6_months(self, admin_token):
        r = requests.get(f"{API}/dashboard/coverage-trend", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 6
        assert all("cpn1" in m and "cpn4" in m for m in data)

    def test_vaccine_coverage(self, admin_token):
        r = requests.get(f"{API}/dashboard/vaccine-coverage", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert all("code" in d and "rate" in d for d in data)


# -------------------- Admin RBAC + Exports --------------------
class TestAdmin:
    def test_admin_users_list(self, admin_token):
        r = requests.get(f"{API}/admin/users", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        users = r.json()
        emails = [u["email"] for u in users]
        assert ADMIN[0] in emails
        assert MIDWIFE[0] in emails

    def test_midwife_cannot_admin_users(self, midwife_token):
        r = requests.get(f"{API}/admin/users", headers=H(midwife_token), timeout=10)
        assert r.status_code == 403

    def test_admin_can_create_user(self, admin_token):
        new_email = f"test_{uuid.uuid4().hex[:8]}@khalaba.health"
        r = requests.post(
            f"{API}/admin/users",
            headers=H(admin_token),
            json={"email": new_email, "password": "TempPass123!", "name": "TEST user", "role": "midwife"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert r.json()["email"] == new_email

    def test_export_patients_csv(self, admin_token):
        r = requests.get(f"{API}/admin/export/patients.csv", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/csv")
        rows = list(csv.reader(io.StringIO(r.text)))
        assert rows[0][0] == "id"
        assert len(rows) > 1  # header + data

    def test_export_pregnancies_csv(self, admin_token):
        r = requests.get(f"{API}/admin/export/pregnancies.csv", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/csv")
        rows = list(csv.reader(io.StringIO(r.text)))
        assert "patient_id" in rows[0]

    def test_export_cpn_csv(self, admin_token):
        r = requests.get(f"{API}/admin/export/cpn.csv", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/csv")
        rows = list(csv.reader(io.StringIO(r.text)))
        assert "pregnancy_id" in rows[0]

    def test_midwife_cannot_export(self, midwife_token):
        r = requests.get(f"{API}/admin/export/patients.csv", headers=H(midwife_token), timeout=10)
        assert r.status_code == 403
