"""KHALABA Brique 10/11 — Hierarchy (Regions/Zones/Structures) + Generic Audit + DHIS2 UID resolution."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@khalaba.health", "password": "khalaba2026"}
SOIGNANT = {"email": "sagefemme@khalaba.health", "password": "khalaba2026"}


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


class TestRegions:
    def test_list_regions_seeded(self, adm):
        """Migration must have created regions from the existing zones' region strings."""
        s, _ = adm
        r = s.get(f"{API}/regions", timeout=15)
        assert r.status_code == 200, r.text
        regions = r.json()
        names = {x["name"] for x in regions}
        # at least one of the seeded zone-regions
        assert "N'Djamena" in names

    def test_zones_have_region_id(self, adm):
        """All zones must be back-linked to a region after migration."""
        s, _ = adm
        zones = s.get(f"{API}/zones", timeout=15).json()
        assert zones
        for z in zones:
            assert z.get("region_id"), f"zone {z['id']} missing region_id"

    def test_create_region_admin_only(self, adm, soig):
        s, _ = adm
        payload = {"name": f"TestRegion_{uuid.uuid4().hex[:6]}", "dhis2_org_unit_uid": "UID_TEST_REG"}
        r = s.post(f"{API}/regions", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["id"]
        assert doc["dhis2_org_unit_uid"] == "UID_TEST_REG"
        # Soignant forbidden
        s2, _ = soig
        r2 = s2.post(f"{API}/regions", json=payload, timeout=15)
        assert r2.status_code == 403

    def test_patch_region_dhis2_uid(self, adm):
        s, _ = adm
        payload = {"name": f"TestRegion_{uuid.uuid4().hex[:6]}"}
        rid = s.post(f"{API}/regions", json=payload, timeout=15).json()["id"]
        r = s.patch(f"{API}/regions/{rid}", json={"dhis2_org_unit_uid": "UID_PATCHED"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["dhis2_org_unit_uid"] == "UID_PATCHED"


class TestZonesPatch:
    def test_patch_zone_dhis2_uid(self, adm):
        s, _ = adm
        zone = s.get(f"{API}/zones", timeout=15).json()[0]
        r = s.patch(f"{API}/zones/{zone['id']}",
                    json={"dhis2_org_unit_uid": "ZONE_UID_42"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["dhis2_org_unit_uid"] == "ZONE_UID_42"


class TestStructuresPatch:
    def test_patch_structure_dhis2_uid(self, adm):
        s, _ = adm
        structs = s.get(f"{API}/structures", timeout=15).json()
        assert structs
        sid = structs[0]["id"]
        r = s.patch(f"{API}/structures/{sid}",
                    json={"dhis2_org_unit_uid": "STRUCT_UID_99"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["dhis2_org_unit_uid"] == "STRUCT_UID_99"


class TestDhis2UidResolution:
    def test_dhis2_export_uses_zone_uid(self, adm):
        s, _ = adm
        zone = s.get(f"{API}/zones", timeout=15).json()[0]
        s.patch(f"{API}/zones/{zone['id']}",
                json={"dhis2_org_unit_uid": "RESOLVED_ZONE_UID"}, timeout=15)
        r = s.get(f"{API}/reports/dhis2",
                  params={"month": 6, "year": 2026, "zone_id": zone["id"]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["orgUnit"] == "RESOLVED_ZONE_UID"

    def test_dhis2_export_falls_back_to_region_uid(self, adm):
        s, _ = adm
        # Setup: new region with UID, new zone linked but without its own UID
        rid = s.post(f"{API}/regions",
                     json={"name": f"R_{uuid.uuid4().hex[:6]}", "dhis2_org_unit_uid": "REGION_UID_X"},
                     timeout=15).json()["id"]
        zid = s.post(f"{API}/zones",
                     json={"name": f"Z_{uuid.uuid4().hex[:6]}",
                           "region": "X", "region_id": rid},
                     timeout=15).json()["id"]
        r = s.get(f"{API}/reports/dhis2",
                  params={"month": 6, "year": 2026, "zone_id": zid}, timeout=15)
        assert r.status_code == 200
        assert r.json()["orgUnit"] == "REGION_UID_X"


class TestGenericAudit:
    def test_create_patient_emits_audit_log(self, adm):
        s, _ = adm
        zone = s.get(f"{API}/zones", timeout=15).json()[0]
        before = s.get(f"{API}/audit-logs",
                       params={"action": "CREATE", "entity": "Patient", "limit": 500}, timeout=15).json()
        payload = {
            "full_name": f"Audit Test {uuid.uuid4().hex[:6]}",
            "dob": "1995-05-05",
            "zone_id": zone["id"],
        }
        r = s.post(f"{API}/patients", json=payload, timeout=15)
        assert r.status_code == 200
        after = s.get(f"{API}/audit-logs",
                      params={"action": "CREATE", "entity": "Patient", "limit": 500}, timeout=15).json()
        assert len(after) > len(before)

    def test_audit_logs_filters(self, adm):
        s, _ = adm
        r = s.get(f"{API}/audit-logs",
                  params={"action": "CREATE", "entity": "Region", "limit": 50}, timeout=15)
        assert r.status_code == 200
        for log in r.json():
            assert log["action"] == "CREATE"
            assert log["entity"] == "Region"

    def test_audit_logs_summary(self, adm):
        s, _ = adm
        r = s.get(f"{API}/audit-logs/summary", timeout=15)
        assert r.status_code == 200
        data = r.json()
        for k in ("total", "by_action", "by_entity"):
            assert k in data
        assert isinstance(data["by_action"], list)
        assert isinstance(data["by_entity"], list)
        assert data["total"] >= 0
