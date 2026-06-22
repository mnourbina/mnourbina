"""KHALABA Brique 9 — PWA assets + offline replay tolerance (server side)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
FRONTEND = BASE_URL.rstrip("/")
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


class TestPWAAssets:
    """Static assets required for PWA installability are exposed by the frontend host."""

    def test_manifest_served(self):
        r = requests.get(f"{FRONTEND}/manifest.json", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("name") and "KHALABA" in data["name"]
        assert data.get("start_url") == "/"
        assert data.get("display") == "standalone"
        assert data.get("theme_color") == "#C85A48"
        icons = data.get("icons") or []
        sizes = {i.get("sizes") for i in icons}
        assert "192x192" in sizes and "512x512" in sizes

    def test_service_worker_served(self):
        r = requests.get(f"{FRONTEND}/service-worker.js", timeout=15)
        assert r.status_code == 200, r.text
        body = r.text
        # Must register install/fetch handlers
        assert 'addEventListener("install"' in body or "addEventListener('install'" in body
        assert "fetch" in body
        # API caching strategy
        assert "/api/" in body

    def test_icons_served(self):
        for size in ("icon-192.svg", "icon-512.svg"):
            r = requests.get(f"{FRONTEND}/icons/{size}", timeout=15)
            assert r.status_code == 200, r.text
            assert "<svg" in r.text


class TestOfflineReplayHeader:
    """Mutating endpoints must accept the X-Offline-Replay marker without error."""

    def test_check_ltfu_with_replay_header(self, adm):
        s, _ = adm
        r = s.post(f"{API}/admin/check-ltfu",
                   headers={"X-Offline-Replay": "1"}, timeout=30)
        assert r.status_code == 200, r.text

    def test_mark_found_with_replay_header(self, adm):
        s, _ = adm
        # Pick any pregnancy
        pregs = s.get(f"{API}/pregnancies", timeout=15).json()
        if not pregs:
            pytest.skip("No pregnancies available")
        pid = pregs[0]["id"]
        r = s.post(f"{API}/pregnancies/{pid}/found",
                   json={"notes": "offline replay"},
                   headers={"X-Offline-Replay": "1"}, timeout=15)
        assert r.status_code == 200, r.text
