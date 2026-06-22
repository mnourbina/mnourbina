"""KHALABA iteration 2 tests: patient timeline + appointments CRUD/status."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dev-build-127.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@khalaba.health", "password": "khalaba2026"}
SOIGNANT = {"email": "sagefemme@khalaba.health", "password": "khalaba2026"}
PATIENT = {"email": "maman@khalaba.health", "password": "khalaba2026"}


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


# ---------- Patient timeline ----------
class TestPatientTimeline:
    def test_timeline_as_patient_returns_structure(self, patient_session):
        s, u = patient_session
        r = s.get(f"{API}/patient/me/timeline", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "patient" in body
        assert "pregnancies" in body and isinstance(body["pregnancies"], list)
        assert "children" in body and isinstance(body["children"], list)
        # patient demo seeded — should not be None
        assert body["patient"] is not None
        assert body["patient"].get("user_id") == u["id"]
        # nested fields when pregnancies exist
        for preg in body["pregnancies"]:
            assert "cpn_visits" in preg and isinstance(preg["cpn_visits"], list)
            assert "postnatal_visits" in preg and isinstance(preg["postnatal_visits"], list)
        for c in body["children"]:
            assert "vaccinations" in c and isinstance(c["vaccinations"], list)

    def test_timeline_forbidden_for_soignant(self, soignant_session):
        s, _ = soignant_session
        r = s.get(f"{API}/patient/me/timeline", timeout=20)
        assert r.status_code == 403

    def test_timeline_forbidden_for_admin(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/patient/me/timeline", timeout=20)
        assert r.status_code == 403


# ---------- Appointments ----------
class TestAppointments:
    @pytest.fixture(scope="class")
    def patient_in_zone(self, soignant_session):
        s, u = soignant_session
        # try to find an existing patient in zone; else create one
        r = s.get(f"{API}/patients", timeout=20)
        assert r.status_code == 200
        patients = r.json()
        if patients:
            return patients[0]
        payload = {
            "full_name": "TEST_AppPatient",
            "phone": "+235 70 00 00 00",
            "zone_id": u["zone_id"],
        }
        r2 = s.post(f"{API}/patients", json=payload, timeout=20)
        assert r2.status_code == 200
        return r2.json()

    def test_create_appointment_as_soignant(self, soignant_session, patient_in_zone, request):
        s, _ = soignant_session
        payload = {
            "patient_id": patient_in_zone["id"],
            "scheduled_at": "2026-02-15T10:30:00Z",
            "type": "CPN",
            "notes": "TEST_appointment",
        }
        r = s.post(f"{API}/appointments", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["patient_id"] == patient_in_zone["id"]
        assert body["status"] == "scheduled"
        assert body["type"] == "CPN"
        assert "id" in body
        request.config.cache.set("appt_id", body["id"])

    def test_list_appointments_as_soignant(self, soignant_session, request):
        s, _ = soignant_session
        r = s.get(f"{API}/appointments", timeout=20)
        assert r.status_code == 200
        appts = r.json()
        assert isinstance(appts, list)
        appt_id = request.config.cache.get("appt_id", None)
        ids = [a["id"] for a in appts]
        assert appt_id in ids

    def test_patch_appointment_status_done(self, soignant_session, request):
        s, _ = soignant_session
        appt_id = request.config.cache.get("appt_id", None)
        r = s.patch(f"{API}/appointments/{appt_id}",
                    json={"status": "done"}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "done"
        assert body["id"] == appt_id

    def test_patch_appointment_status_missed(self, soignant_session, request):
        s, _ = soignant_session
        appt_id = request.config.cache.get("appt_id", None)
        r = s.patch(f"{API}/appointments/{appt_id}",
                    json={"status": "missed"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["status"] == "missed"

    def test_patch_appointment_404(self, soignant_session):
        s, _ = soignant_session
        r = s.patch(f"{API}/appointments/does-not-exist-xyz",
                    json={"status": "done"}, timeout=20)
        assert r.status_code == 404

    def test_patch_appointment_forbidden_for_patient(self, patient_session, request):
        s, _ = patient_session
        appt_id = request.config.cache.get("appt_id", None)
        r = s.patch(f"{API}/appointments/{appt_id}",
                    json={"status": "done"}, timeout=20)
        assert r.status_code == 403

    def test_create_appointment_for_patient_visible_to_her(self, soignant_session, patient_session):
        s_soi, _ = soignant_session
        s_pat, u_pat = patient_session
        # find patient row for the maman user
        r_me = s_pat.get(f"{API}/patients", timeout=20)
        assert r_me.status_code == 200
        my_patients = r_me.json()
        if not my_patients:
            pytest.skip("Patient has no patient record")
        my_pid = my_patients[0]["id"]
        payload = {
            "patient_id": my_pid,
            "scheduled_at": "2026-03-20T09:00:00Z",
            "type": "vaccination",
            "notes": "TEST_for_patient",
        }
        r = s_soi.post(f"{API}/appointments", json=payload, timeout=20)
        assert r.status_code == 200
        new_id = r.json()["id"]
        # Now list as patient — should appear
        r2 = s_pat.get(f"{API}/appointments", timeout=20)
        assert r2.status_code == 200
        ids = [a["id"] for a in r2.json()]
        assert new_id in ids
