"""KHALABA v2 backend tests for the new modules.

Covers: zones, complications, postnatal, newborns, death-audits,
direct-channel, midwife sectorisation (zone_id), khalaba_id, new CPN
fields (hepatitis_b, deworming), new KPIs.
"""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@khalaba.health", "Khalaba2026!")
GYNO = ("gyneco@khalaba.health", "Khalaba2026!")
MIDWIFE = ("sagefemme@khalaba.health", "Khalaba2026!")
PATIENT = ("patiente@khalaba.health", "Khalaba2026!")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login failed {email}: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data["user"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def admin_token():
    t, _ = _login(*ADMIN)
    return t


@pytest.fixture(scope="session")
def gyno_token():
    t, _ = _login(*GYNO)
    return t


@pytest.fixture(scope="session")
def midwife():
    t, u = _login(*MIDWIFE)
    return {"token": t, "user": u}


# -------------------- Zones --------------------
class TestZones:
    def test_list_zones_seeded(self, admin_token):
        r = requests.get(f"{API}/zones", headers=H(admin_token), timeout=10)
        assert r.status_code == 200, r.text
        zones = r.json()
        assert isinstance(zones, list)
        assert len(zones) >= 3, f"Expected >=3 zones, got {len(zones)}"
        # check structure
        for z in zones:
            assert "id" in z and "name" in z

    def test_midwife_cannot_create_zone(self, midwife):
        r = requests.post(
            f"{API}/zones",
            headers=H(midwife["token"]),
            json={"name": "TEST Zone", "country": "TD"},
            timeout=10,
        )
        assert r.status_code == 403, f"Expected 403 got {r.status_code}: {r.text}"


# -------------------- Patient list: khalaba_id + sectorisation --------------------
class TestPatientsV2:
    def test_patients_have_khalaba_id(self, admin_token):
        r = requests.get(f"{API}/patients", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        patients = r.json()
        assert len(patients) >= 1
        with_id = [p for p in patients if p.get("khalaba_id")]
        assert len(with_id) > 0, "No patient has khalaba_id"
        # format KH-TD-XXXXXXXX
        for p in with_id[:3]:
            kid = p["khalaba_id"]
            assert kid.startswith("KH-TD-"), f"Bad khalaba_id format: {kid}"
            assert len(kid) >= 10

    def test_midwife_sectorisation_by_zone(self, midwife, admin_token):
        r = requests.get(f"{API}/patients", headers=H(midwife["token"]), timeout=15)
        assert r.status_code == 200
        midwife_patients = r.json()
        assert len(midwife_patients) > 0
        # all midwife patients must share the same zone_id
        zones = {p.get("zone_id") for p in midwife_patients}
        assert len(zones) == 1, f"Midwife patients should all be in same zone, got {zones}"
        midwife_zone = zones.pop()
        assert midwife_zone, "midwife patients have no zone_id"
        # admin sees patients in OTHER zones too
        r_all = requests.get(f"{API}/patients", headers=H(admin_token), timeout=15)
        other_zone_patients = [p for p in r_all.json() if p.get("zone_id") and p["zone_id"] != midwife_zone]
        assert len(other_zone_patients) > 0, "Admin should see patients in other zones"
        # midwife list must not contain those
        other_ids = {p["id"] for p in other_zone_patients}
        midwife_ids = {p["id"] for p in midwife_patients}
        assert midwife_ids.isdisjoint(other_ids), "Midwife sees patients from another zone"

    def test_midwife_does_not_see_other_zone(self, midwife, admin_token):
        # admin sees everyone
        r_all = requests.get(f"{API}/patients", headers=H(admin_token), timeout=15)
        assert r_all.status_code == 200
        all_zones = {p.get("zone_id") for p in r_all.json() if p.get("zone_id")}
        assert len(all_zones) >= 2, f"Expected >=2 zones across patients, got {all_zones}"
        # midwife list strictly smaller
        r_m = requests.get(f"{API}/patients", headers=H(midwife["token"]), timeout=15)
        assert len(r_m.json()) < len(r_all.json())


# -------------------- Complications --------------------
class TestComplications:
    def _ensure_pregnancy(self, token, user):
        # find an existing patient in midwife scope
        r = requests.get(f"{API}/patients", headers=H(token), timeout=10)
        patients = r.json()
        assert patients
        pid = patients[0]["id"]
        # find or create pregnancy
        rp = requests.get(f"{API}/pregnancies", headers=H(token), params={"patient_id": pid}, timeout=10)
        assert rp.status_code == 200
        pregs = rp.json()
        if pregs:
            return pid, pregs[0]["id"]
        lmp = (date.today() - timedelta(weeks=12)).isoformat()
        rc = requests.post(f"{API}/pregnancies", headers=H(token), json={"patient_id": pid, "lmp_date": lmp}, timeout=10)
        assert rc.status_code == 200, rc.text
        return pid, rc.json()["id"]

    def test_create_and_list_complication(self, midwife):
        pid, preg_id = self._ensure_pregnancy(midwife["token"], midwife["user"])
        payload = {
            "pregnancy_id": preg_id,
            "patient_id": pid,
            "name": "TEST_HTA_gravidique",
            "severity": "moderate",
            "notes": "auto test",
        }
        r = requests.post(f"{API}/complications", headers=H(midwife["token"]), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        comp = r.json()
        assert comp["name"] == payload["name"]
        assert comp["severity"] == "moderate"
        comp_id = comp["id"]

        # GET list filtered
        r2 = requests.get(f"{API}/complications", headers=H(midwife["token"]), params={"pregnancy_id": preg_id}, timeout=10)
        assert r2.status_code == 200
        items = r2.json()
        assert any(c["id"] == comp_id for c in items)


# -------------------- Postnatal + Newborn --------------------
class TestPostnatalNewborn:
    @pytest.fixture(scope="class")
    def fresh_pregnancy(self, midwife):
        # create new patient + pregnancy for clean delivery test
        payload = {
            "first_name": "TESTPN",
            "last_name": f"Mom{uuid.uuid4().hex[:6]}",
            "date_of_birth": "1995-01-01",
            "phone": "+23566555111",
            "facility_id": midwife["user"]["facility_id"],
            "zone_id": midwife["user"].get("zone_id"),
            "parity": 1,
        }
        rp = requests.post(f"{API}/patients", headers=H(midwife["token"]), json=payload, timeout=10)
        assert rp.status_code == 200, rp.text
        pid = rp.json()["id"]
        lmp = (date.today() - timedelta(weeks=40)).isoformat()
        rpr = requests.post(f"{API}/pregnancies", headers=H(midwife["token"]), json={"patient_id": pid, "lmp_date": lmp}, timeout=10)
        assert rpr.status_code == 200, rpr.text
        return {"patient_id": pid, "pregnancy_id": rpr.json()["id"]}

    def test_create_newborn_low_birth_weight(self, midwife, fresh_pregnancy):
        payload = {
            "pregnancy_id": fresh_pregnancy["pregnancy_id"],
            "birth_date": date.today().isoformat(),
            "gender": "F",
            "birth_weight_g": 2200,  # LBW
            "apgar_1": 8,
            "apgar_5": 9,
        }
        r = requests.post(f"{API}/newborns", headers=H(midwife["token"]), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        nb = r.json()
        assert nb["is_low_birth_weight"] is True, f"is_low_birth_weight not auto-set: {nb}"

        # pregnancy must be flipped to delivered (no GET-by-id, list filter)
        rp = requests.get(f"{API}/pregnancies", headers=H(midwife["token"]), params={"patient_id": fresh_pregnancy["patient_id"]}, timeout=10)
        assert rp.status_code == 200
        target = next((p for p in rp.json() if p["id"] == fresh_pregnancy["pregnancy_id"]), None)
        assert target is not None, "pregnancy not found in list"
        assert target["status"] == "delivered", f"status={target['status']}"

        # alert LBW should exist
        ra = requests.get(f"{API}/alerts", headers=H(midwife["token"]), timeout=10)
        assert ra.status_code == 200
        joined = " ".join((a.get("message") or "") for a in ra.json()).lower()
        assert "poids" in joined or "lbw" in joined or "2200" in joined or "faible" in joined, "No LBW alert detected"

    def test_postnatal_visit_with_alerts(self, midwife, fresh_pregnancy):
        payload = {
            "pregnancy_id": fresh_pregnancy["pregnancy_id"],
            "step": 1,  # 1=6h
            "visit_date": date.today().isoformat(),
            "maternal_bleeding": "heavy",  # hemorragie alert
            "uterine_tonus": "soft",  # atonie alert
            "newborn_jaundice": True,  # ictere alert
        }
        r = requests.post(f"{API}/postnatal", headers=H(midwife["token"]), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        pn = r.json()
        alerts = " ".join(pn.get("alerts") or []).lower()
        assert "hemorr" in alerts or "hémorr" in alerts or "saignement" in alerts, f"No hemorragie alert: {pn.get('alerts')}"
        assert "atonie" in alerts or "uter" in alerts, f"No atonie alert: {pn.get('alerts')}"
        assert "icter" in alerts or "jaun" in alerts, f"No jaundice alert: {pn.get('alerts')}"

        # list ordered by step
        r2 = requests.get(f"{API}/postnatal", headers=H(midwife["token"]), params={"pregnancy_id": fresh_pregnancy["pregnancy_id"]}, timeout=10)
        assert r2.status_code == 200
        lst = r2.json()
        assert len(lst) >= 1


# -------------------- Death audit (MPDSR) --------------------
class TestDeathAudit:
    def test_create_audit_creates_alert(self, gyno_token, midwife):
        # pick a patient in midwife scope (gyno can see all in TD likely)
        rp = requests.get(f"{API}/patients", headers=H(gyno_token), timeout=15)
        assert rp.status_code == 200
        patient = rp.json()[0]
        payload = {
            "patient_id": patient["id"],
            "death_type": "neonatal",
            "death_date": date.today().isoformat(),
            "primary_cause": "TEST Asphyxie neonatale",
            "contributing_factors": "delay1",
        }
        r = requests.post(f"{API}/death-audits", headers=H(gyno_token), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        audit = r.json()
        assert audit["status"] == "pending_audit"

        ra = requests.get(f"{API}/alerts", headers=H(gyno_token), timeout=10)
        joined = " ".join((a.get("message") or "").lower() for a in ra.json())
        assert "mpdsr" in joined or "audit" in joined or "déc" in joined or "dec" in joined

        # PATCH update (gyno allowed)
        rp2 = requests.patch(
            f"{API}/death-audits/{audit['id']}",
            headers=H(gyno_token),
            json={"audit_recommendations": "TEST reco", "status": "audited"},
            timeout=10,
        )
        assert rp2.status_code == 200, rp2.text
        assert rp2.json()["status"] == "audited"
        TestDeathAudit._audit_id = audit["id"]

    def test_midwife_cannot_patch_audit(self, midwife):
        # use any existing pending audit (seeded one on Zara)
        r = requests.get(f"{API}/death-audits", headers=H(midwife["token"]), timeout=10)
        # midwife may or may not be allowed to GET; if 403, skip
        if r.status_code != 200:
            pytest.skip(f"midwife cannot GET audits: {r.status_code}")
        audits = r.json()
        if not audits:
            pytest.skip("no audit visible to midwife")
        aid = audits[0]["id"]
        rp = requests.patch(f"{API}/death-audits/{aid}", headers=H(midwife["token"]), json={"audit_recommendations": "x"}, timeout=10)
        assert rp.status_code == 403, f"midwife should not patch audits, got {rp.status_code}"


# -------------------- Direct channel --------------------
class TestDirectChannel:
    def test_log_and_list(self, midwife):
        rp = requests.get(f"{API}/patients", headers=H(midwife["token"]), timeout=10)
        patient_id = rp.json()[0]["id"]
        payload = {"patient_id": patient_id, "channel": "call", "direction": "pro_to_patient", "purpose": "advice", "notes": "TEST direct channel"}
        r = requests.post(f"{API}/direct-channel", headers=H(midwife["token"]), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        log = r.json()
        assert log["channel"] == "call"

        r2 = requests.get(f"{API}/direct-channel", headers=H(midwife["token"]), params={"patient_id": patient_id}, timeout=10)
        assert r2.status_code == 200
        assert any(x["id"] == log["id"] for x in r2.json())


# -------------------- CPN new fields --------------------
class TestCpnV2:
    def test_cpn_hepatitis_b_positive_alert(self, midwife):
        # create patient + pregnancy
        rp = requests.post(
            f"{API}/patients",
            headers=H(midwife["token"]),
            json={
                "first_name": "TESTHepB",
                "last_name": f"M{uuid.uuid4().hex[:6]}",
                "date_of_birth": "1994-01-01",
                "phone": "+23566700123",
                "facility_id": midwife["user"]["facility_id"],
                "zone_id": midwife["user"].get("zone_id"),
                "parity": 0,
            },
            timeout=10,
        )
        assert rp.status_code == 200, rp.text
        pid = rp.json()["id"]
        lmp = (date.today() - timedelta(weeks=18)).isoformat()
        rpr = requests.post(f"{API}/pregnancies", headers=H(midwife["token"]), json={"patient_id": pid, "lmp_date": lmp}, timeout=10)
        preg_id = rpr.json()["id"]
        rc = requests.post(
            f"{API}/cpn",
            headers=H(midwife["token"]),
            json={
                "pregnancy_id": preg_id,
                "contact_number": 1,
                "contact_date": date.today().isoformat(),
                "weight_kg": 60.0,
                "bp_systolic": 110,
                "bp_diastolic": 70,
                "hemoglobin": 6.5,  # severe anemia trigger
                "hepatitis_b_status": "positive",
                "deworming_given": True,
                "decision": "reference",
            },
            timeout=10,
        )
        assert rc.status_code == 200, rc.text
        cpn = rc.json()
        joined = " ".join(cpn.get("alerts") or []).lower()
        assert "hep" in joined or "hépat" in joined, f"No HepB alert: {cpn.get('alerts')}"
        assert "anem" in joined or "aném" in joined, f"No anemia alert: {cpn.get('alerts')}"


# -------------------- KPIs v2 --------------------
class TestKpisV2:
    def test_kpis_neonatal_deaths_and_postnatal(self, admin_token):
        r = requests.get(f"{API}/dashboard/kpis", headers=H(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("neonatal_deaths", 0) >= 1, f"neonatal_deaths={d.get('neonatal_deaths')}"
        assert "postnatal_mother_coverage" in d
        assert isinstance(d["postnatal_mother_coverage"], (int, float))
