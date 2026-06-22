"""KHALABA backend full API tests."""
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
    assert "temp_token" in body and "otp_code" in body and body.get("demo") is True
    r2 = s.post(f"{API}/auth/verify-otp",
                json={"temp_token": body["temp_token"], "otp_code": body["otp_code"]},
                timeout=30)
    assert r2.status_code == 200, r2.text
    user = r2.json()
    return s, user


@pytest.fixture(scope="module")
def admin_session():
    s, u = _login(ADMIN)
    assert u["role"] == "admin"
    return s, u


@pytest.fixture(scope="module")
def soignant_session():
    s, u = _login(SOIGNANT)
    assert u["role"] == "soignant"
    return s, u


@pytest.fixture(scope="module")
def patient_session():
    s, u = _login(PATIENT)
    assert u["role"] == "patient"
    return s, u


# ------------- Health -------------
def test_health():
    r = requests.get(f"{API}/", timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert body["message"] == "KHALABA API"
    assert body["version"] == "1.0.0"


# ------------- Auth -------------
def test_login_invalid_credentials():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@khalaba.health", "password": "wrong"}, timeout=20)
    assert r.status_code == 401


def test_admin_full_flow(admin_session):
    s, u = admin_session
    r = s.get(f"{API}/auth/me", timeout=20)
    assert r.status_code == 200
    me = r.json()
    assert me["email"] == ADMIN["email"]
    assert me["role"] == "admin"


def test_soignant_flow(soignant_session):
    s, u = soignant_session
    assert u["profession"] == "Sage-femme"
    assert u.get("zone_id"), "Soignant must have zone_id"
    r = s.get(f"{API}/auth/me", timeout=20)
    assert r.status_code == 200


def test_patient_flow(patient_session):
    s, u = patient_session
    r = s.get(f"{API}/auth/me", timeout=20)
    assert r.status_code == 200
    assert r.json()["role"] == "patient"


def test_verify_otp_bad_token():
    r = requests.post(f"{API}/auth/verify-otp", json={"temp_token": "bad", "otp_code": "000000"}, timeout=20)
    assert r.status_code == 401


# ------------- Zones & Structures -------------
def test_list_zones_seeded():
    r = requests.get(f"{API}/zones", timeout=20)
    assert r.status_code == 200
    zones = r.json()
    assert len(zones) >= 5
    names = [z["name"] for z in zones]
    for expected in ["N'Djamena Centre", "Moundou", "Sarh", "Abéché"]:
        assert expected in names, f"Missing zone {expected}"


def test_list_structures_seeded():
    r = requests.get(f"{API}/structures", timeout=20)
    assert r.status_code == 200
    structs = r.json()
    assert len(structs) >= 10


def test_create_zone_admin_only(admin_session, soignant_session):
    s_adm, _ = admin_session
    s_soi, _ = soignant_session
    payload = {"name": "TEST_Zone", "region": "Test", "country": "Tchad"}
    # forbidden for soignant
    r_forbid = s_soi.post(f"{API}/zones", json=payload, timeout=20)
    assert r_forbid.status_code == 403
    # admin ok
    r_ok = s_adm.post(f"{API}/zones", json=payload, timeout=20)
    assert r_ok.status_code == 200
    assert r_ok.json()["name"] == "TEST_Zone"


# ------------- Patient CRUD -------------
@pytest.fixture(scope="module")
def created_patient(soignant_session):
    s, u = soignant_session
    payload = {
        "full_name": "TEST_Mère Test",
        "dob": "1995-06-15",
        "phone": "+235 90 00 00 00",
        "address": "TEST Address",
        "zone_id": u["zone_id"],
        "structure_id": u.get("structure_id"),
        "blood_group": "A+",
        "emergency_contact": "+235 91 00 00 00",
    }
    r = s.post(f"{API}/patients", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["full_name"] == payload["full_name"]
    assert p["zone_id"] == u["zone_id"]
    assert "id" in p
    return p


def test_list_patients_zone_scoped(soignant_session, created_patient):
    s, u = soignant_session
    r = s.get(f"{API}/patients", timeout=20)
    assert r.status_code == 200
    patients = r.json()
    ids = [p["id"] for p in patients]
    assert created_patient["id"] in ids
    # all belong to zone
    for p in patients:
        assert p["zone_id"] == u["zone_id"]


def test_get_patient_with_relations(soignant_session, created_patient):
    s, _ = soignant_session
    r = s.get(f"{API}/patients/{created_patient['id']}", timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert "pregnancies" in body
    assert "children" in body


# ------------- Pregnancy + CPN + alerts -------------
@pytest.fixture(scope="module")
def created_pregnancy(soignant_session, created_patient):
    s, _ = soignant_session
    payload = {"patient_id": created_patient["id"], "lmp_date": "2025-06-01", "edd": "2026-03-08", "parity": 1, "gravidity": 2}
    r = s.post(f"{API}/pregnancies", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def test_get_pregnancy_with_visits(soignant_session, created_pregnancy):
    s, _ = soignant_session
    r = s.get(f"{API}/pregnancies/{created_pregnancy['id']}", timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert "cpn_visits" in body
    assert "postnatal_visits" in body


def test_create_cpn_with_alerts(soignant_session, created_pregnancy):
    s, _ = soignant_session
    payload = {
        "pregnancy_id": created_pregnancy["id"],
        "visit_number": 1,
        "visit_date": "2025-07-01",
        "weight_kg": 65.0,
        "bp_systolic": 145, "bp_diastolic": 95,
        "hemoglobin": 6.5,
        "proteinuria": "++",
        "complications": ["pre-eclampsie"],
    }
    r = s.post(f"{API}/cpn-visits", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "alerts" in body
    alerts = body["alerts"]
    assert "Hypertension" in alerts
    assert "Anémie sévère" in alerts
    assert "Protéinurie élevée" in alerts


def test_create_postnatal_alerts(soignant_session, created_pregnancy):
    s, _ = soignant_session
    payload = {"pregnancy_id": created_pregnancy["id"], "stage": "6h", "visit_date": "2026-03-11", "bleeding": "abondant", "maternal_temp": 38.5}
    r = s.post(f"{API}/postnatal-visits", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "Saignement post-partum" in body["alerts"]
    assert "Fièvre maternelle" in body["alerts"]


# ------------- Children + Vaccination -------------
@pytest.fixture(scope="module")
def created_child(soignant_session, created_pregnancy):
    s, _ = soignant_session
    payload = {
        "pregnancy_id": created_pregnancy["id"],
        "name": "TEST_Bebe",
        "sex": "F",
        "dob": "2026-03-10",
        "birth_date": "2026-03-10",
        "weight_g": 3100,
    }
    r = s.post(f"{API}/children", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def test_vaccination_flow(soignant_session, created_child):
    s, _ = soignant_session
    vp = {"child_id": created_child["id"], "vaccine_name": "BCG", "dose_number": 1, "date_given": "2026-03-11"}
    r = s.post(f"{API}/vaccinations", json=vp, timeout=20)
    assert r.status_code == 200
    # list
    r2 = s.get(f"{API}/vaccinations", params={"child_id": created_child["id"]}, timeout=20)
    assert r2.status_code == 200
    assert len(r2.json()) >= 1
    # child with vaccinations
    r3 = s.get(f"{API}/children/{created_child['id']}", timeout=20)
    assert r3.status_code == 200
    assert "vaccinations" in r3.json()
    assert len(r3.json()["vaccinations"]) >= 1


# ------------- MPDSR -------------
def test_mpdsr_create_and_list(soignant_session):
    s, _ = soignant_session
    # Clear any leftover pending audit from previous iteration tests (MSP blocking workflow)
    pending = s.get(f"{API}/auth/pending-audit", timeout=15).json().get("pending")
    if pending:
        s.post(f"{API}/mpdsr/{pending['id']}/complete-audit", json={
            "delay1_recours": True, "delay2_acces": False, "delay3_prise_charge": False,
            "preventable": False, "preventive_actions": "test cleanup",
        }, timeout=15)
    payload = {
        "death_type": "maternelle",
        "death_date": "2026-01-15",
        "place_of_death": "TEST_Hospital",
        "medical_cause": "hemorragie post-partum",
        "contributing_factors": ["retard"],
        "notes": "test",
    }
    r = s.post(f"{API}/mpdsr", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    # New MSP-enforced response wraps the death + must_complete_audit flag
    if "death" in body:
        assert body["must_complete_audit"] is True
    r2 = s.get(f"{API}/mpdsr", timeout=20)
    assert r2.status_code == 200
    assert isinstance(r2.json(), list)


# ------------- Analytics admin only -------------
def test_analytics_admin(admin_session):
    s, _ = admin_session
    r = s.get(f"{API}/analytics/overview", timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "totals" in body and "cpn4_coverage_percent" in body
    assert "by_zone" in body and isinstance(body["by_zone"], list)
    assert "top_complications" in body


def test_analytics_forbidden_for_soignant(soignant_session):
    s, _ = soignant_session
    r = s.get(f"{API}/analytics/overview", timeout=20)
    assert r.status_code == 403


def test_analytics_forbidden_for_patient(patient_session):
    s, _ = patient_session
    r = s.get(f"{API}/analytics/overview", timeout=20)
    assert r.status_code == 403


# ------------- Register flow -------------
def test_register_soignant_then_login():
    suffix = str(int(time.time()))
    email = f"test_soignant_{suffix}@khalaba.health"
    # Need a zone
    zones = requests.get(f"{API}/zones", timeout=20).json()
    z = zones[0]
    payload = {
        "email": email,
        "password": "testpass123",
        "name": "TEST Soignant",
        "role": "soignant",
        "zone_id": z["id"],
        "profession": "Sage-femme",
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    assert r.json()["email"] == email
    # duplicate
    r2 = requests.post(f"{API}/auth/register", json=payload, timeout=20)
    assert r2.status_code == 400


# ------------- Logout -------------
def test_logout(admin_session):
    s, _ = admin_session
    # use a fresh session so we don't break module-scoped one
    s2, _ = _login(ADMIN)
    r = s2.post(f"{API}/auth/logout", timeout=20)
    assert r.status_code == 200
    r2 = s2.get(f"{API}/auth/me", timeout=20)
    # after clearing cookies, should be 401
    assert r2.status_code == 401
