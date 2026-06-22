"""KHALABA iteration 4 — Pregnancies list/PATCH/found + DHIS2 NEG/POS normalisation."""
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
def soig():
    return _login(SOIGNANT)


@pytest.fixture(scope="module")
def adm():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def pat():
    return _login(PATIENT)


# ---------- GET /api/pregnancies (list with nested) ----------
class TestPregnanciesList:
    def test_soignant_list_pregnancies(self, soig):
        s, u = soig
        r = s.get(f"{API}/pregnancies", timeout=15)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert isinstance(data, list)
        if data:
            row = data[0]
            assert "patient" in row, "list row must include nested patient"
            assert "last_cpn" in row, "list row must include last_cpn (may be None)"
            if row["patient"]:
                assert "full_name" in row["patient"]
                assert "zone_id" in row["patient"]

    def test_admin_list_all_pregnancies(self, adm):
        s, _ = adm
        r = s.get(f"{API}/pregnancies", timeout=15)
        assert r.status_code == 200, r.text

    def test_patient_forbidden(self, pat):
        s, _ = pat
        r = s.get(f"{API}/pregnancies", timeout=15)
        assert r.status_code == 403


# ---------- PATCH /api/pregnancies/{id} ----------
class TestPregnancyPatch:
    def test_patch_status_perdue_vue(self, soig):
        s, u = soig
        # create a pregnancy
        plist = s.get(f"{API}/patients", timeout=15).json()
        assert plist, "Need at least one patient in zone"
        pr = s.post(f"{API}/pregnancies", json={
            "patient_id": plist[0]["id"], "lmp_date": "2025-06-01",
        }, timeout=15)
        assert pr.status_code == 200
        pid = pr.json()["id"]
        r = s.patch(f"{API}/pregnancies/{pid}", json={"status": "perdue_vue"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "perdue_vue"

    def test_patch_404(self, soig):
        s, _ = soig
        r = s.patch(f"{API}/pregnancies/does-not-exist", json={"status": "perdue_vue"}, timeout=15)
        assert r.status_code == 404

    def test_patch_forbidden_patient(self, pat):
        s, _ = pat
        r = s.patch(f"{API}/pregnancies/whatever", json={"status": "perdue_vue"}, timeout=15)
        assert r.status_code == 403


# ---------- POST /api/pregnancies/{id}/found ----------
class TestPregnancyFound:
    def test_found_resets_status(self, soig):
        s, u = soig
        plist = s.get(f"{API}/patients", timeout=15).json()
        pr = s.post(f"{API}/pregnancies", json={
            "patient_id": plist[0]["id"], "lmp_date": "2025-06-01",
        }, timeout=15).json()
        s.patch(f"{API}/pregnancies/{pr['id']}", json={"status": "perdue_vue"}, timeout=15)
        r = s.post(f"{API}/pregnancies/{pr['id']}/found", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "en_cours"
        assert body.get("found_at")

    def test_found_404(self, soig):
        s, _ = soig
        r = s.post(f"{API}/pregnancies/nope/found", timeout=15)
        assert r.status_code == 404


# ---------- DHIS2 NEG/POS normalisation ----------
class TestDhis2NegPosNormalisation:
    def test_neg_pos_counted(self, soig, adm):
        s_soi, u = soig
        s_adm, _ = adm
        plist = s_soi.get(f"{API}/patients", timeout=15).json()
        pr = s_soi.post(f"{API}/pregnancies", json={
            "patient_id": plist[0]["id"], "lmp_date": "2025-08-01",
        }, timeout=15).json()
        # baseline
        b = s_adm.get(f"{API}/analytics/dhis2-indicators", params={"period": "202602"}, timeout=20).json()
        base = {i["code"]: i["value"] for i in b["indicators"]}
        # CPN with NEW canonical values
        r = s_soi.post(f"{API}/cpn-visits", json={
            "pregnancy_id": pr["id"], "visit_number": 1,
            "visit_date": "2026-02-12",
            "hiv_status": "POS", "syphilis_status": "NEG",
        }, timeout=15)
        assert r.status_code == 200, r.text
        a = s_adm.get(f"{API}/analytics/dhis2-indicators", params={"period": "202602"}, timeout=20).json()
        after = {i["code"]: i["value"] for i in a["indicators"]}
        assert after["DE_VIH_TESTED"] == base["DE_VIH_TESTED"] + 1
        assert after["DE_VIH_POS"] == base["DE_VIH_POS"] + 1
        assert after["DE_SYPH_TESTED"] == base["DE_SYPH_TESTED"] + 1
