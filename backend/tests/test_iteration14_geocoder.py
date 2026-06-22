"""KHALABA Brique 14 — Auto-geocoding patient address via Nominatim."""
import os
import uuid
import pytest
import requests
from unittest.mock import patch, AsyncMock

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


class TestGeocoder:
    def test_create_patient_without_address_does_not_geocode(self, adm):
        """No address → no geocode call → coords stay None."""
        s, _ = adm
        zone = s.get(f"{API}/zones", timeout=15).json()[0]
        payload = {
            "full_name": f"NoAddr_{uuid.uuid4().hex[:6]}",
            "dob": "1995-05-05",
            "zone_id": zone["id"],
        }
        r = s.post(f"{API}/patients", json=payload, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body.get("latitude") is None
        assert body.get("longitude") is None

    def test_create_patient_with_explicit_coords_preserved(self, adm):
        """If caller supplies coords, the geocoder MUST NOT overwrite them."""
        s, _ = adm
        zone = s.get(f"{API}/zones", timeout=15).json()[0]
        payload = {
            "full_name": f"Explicit_{uuid.uuid4().hex[:6]}",
            "dob": "1995-05-05",
            "zone_id": zone["id"],
            "address": "Adresse n'importe quoi qui n'existe pas",
            "latitude": 12.0,
            "longitude": 15.0,
        }
        r = s.post(f"{API}/patients", json=payload, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["latitude"] == pytest.approx(12.0)
        assert body["longitude"] == pytest.approx(15.0)

    def test_geocode_patient_endpoint_requires_address(self, adm):
        s, _ = adm
        zone = s.get(f"{API}/zones", timeout=15).json()[0]
        patient = s.post(f"{API}/patients",
                          json={"full_name": f"GeoEP_{uuid.uuid4().hex[:6]}",
                                "dob": "1995-05-05", "zone_id": zone["id"]},
                          timeout=15).json()
        r = s.post(f"{API}/patients/{patient['id']}/geocode", timeout=15)
        assert r.status_code == 400
        assert "Adresse" in r.json().get("detail", "")


class TestGeocoderUnit:
    """Pure unit tests of the geocoder module (no HTTP)."""

    @pytest.mark.asyncio
    async def test_empty_address_returns_none(self):
        from geocoder import geocode_address
        lat, lon = await geocode_address("")
        assert lat is None and lon is None

    @pytest.mark.asyncio
    async def test_whitespace_address_returns_none(self):
        from geocoder import geocode_address
        lat, lon = await geocode_address("   ")
        assert lat is None and lon is None

    @pytest.mark.asyncio
    async def test_nominatim_hit_returns_floats(self):
        """Mocked Nominatim response → coords parsed."""
        from geocoder import geocode_address
        fake_resp = AsyncMock()
        fake_resp.status_code = 200
        fake_resp.json = lambda: [{"lat": "12.1234", "lon": "15.5678"}]
        with patch("geocoder.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=fake_resp)
            lat, lon = await geocode_address("Quartier Chagoua, N'Djamena")
        assert lat == pytest.approx(12.1234)
        assert lon == pytest.approx(15.5678)

    @pytest.mark.asyncio
    async def test_nominatim_no_results(self):
        from geocoder import geocode_address
        fake_resp = AsyncMock()
        fake_resp.status_code = 200
        fake_resp.json = lambda: []
        with patch("geocoder.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=fake_resp)
            lat, lon = await geocode_address("inexistant")
        assert lat is None and lon is None

    @pytest.mark.asyncio
    async def test_nominatim_network_error_returns_none(self):
        from geocoder import geocode_address
        with patch("geocoder.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(side_effect=Exception("boom"))
            lat, lon = await geocode_address("Anywhere")
        assert lat is None and lon is None
