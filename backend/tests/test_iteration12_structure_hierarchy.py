"""KHALABA Brique 12 — Structures formal district_id / region_id denormalization."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@khalaba.health", "password": "khalaba2026"}


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


class TestStructureHierarchy:
    def test_seed_structures_have_district_and_region(self, adm):
        """Migration must have populated district_id and region_id on every structure."""
        s, _ = adm
        structures = s.get(f"{API}/structures", timeout=15).json()
        assert structures
        for st in structures:
            assert st.get("district_id"), f"struct {st['id']} missing district_id"
            assert st.get("district_id") == st.get("zone_id"), "district_id must mirror zone_id"
            assert st.get("region_id"), f"struct {st['id']} missing region_id"

    def test_create_structure_with_zone_id_sets_district_and_region(self, adm):
        s, _ = adm
        zone = s.get(f"{API}/zones", timeout=15).json()[0]
        payload = {"name": f"Test_{uuid.uuid4().hex[:6]}", "zone_id": zone["id"], "type": "hopital"}
        r = s.post(f"{API}/structures", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["zone_id"] == zone["id"]
        assert body["district_id"] == zone["id"]
        assert body["region_id"] == zone.get("region_id")

    def test_create_structure_with_district_id_alias(self, adm):
        s, _ = adm
        zone = s.get(f"{API}/zones", timeout=15).json()[0]
        # Use district_id only; zone_id derived server-side from district_id
        payload = {"name": f"DTest_{uuid.uuid4().hex[:6]}",
                   "zone_id": zone["id"],  # required by model
                   "district_id": zone["id"], "type": "centre_sante"}
        r = s.post(f"{API}/structures", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["district_id"] == zone["id"]
        assert body["zone_id"] == zone["id"]

    def test_list_structures_by_region_id(self, adm):
        s, _ = adm
        zone = s.get(f"{API}/zones", timeout=15).json()[0]
        rid = zone.get("region_id")
        assert rid, "test prerequisite: zone must have region_id"
        r = s.get(f"{API}/structures", params={"region_id": rid}, timeout=15)
        assert r.status_code == 200
        for st in r.json():
            assert st["region_id"] == rid

    def test_list_structures_by_district_id(self, adm):
        s, _ = adm
        zone = s.get(f"{API}/zones", timeout=15).json()[0]
        r = s.get(f"{API}/structures", params={"district_id": zone["id"]}, timeout=15)
        assert r.status_code == 200
        assert all(st["zone_id"] == zone["id"] for st in r.json())

    def test_patch_structure_moves_district_updates_region(self, adm):
        s, _ = adm
        # Create structure in zone[0]
        zones = s.get(f"{API}/zones", timeout=15).json()
        z0, z1 = zones[0], zones[1] if len(zones) > 1 else zones[0]
        if z0["id"] == z1["id"] or z0.get("region_id") == z1.get("region_id"):
            pytest.skip("Need 2 zones in different regions for this test")
        struct = s.post(f"{API}/structures",
                        json={"name": f"Move_{uuid.uuid4().hex[:6]}", "zone_id": z0["id"], "type": "hopital"},
                        timeout=15).json()
        # Move it to z1
        r = s.patch(f"{API}/structures/{struct['id']}", json={"district_id": z1["id"]}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["district_id"] == z1["id"]
        assert body["zone_id"] == z1["id"]
        assert body["region_id"] == z1["region_id"]
