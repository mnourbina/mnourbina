"""KHALABA — Lightweight geocoding helper (Brique 14).

Uses OpenStreetMap Nominatim (free, no API key required) to convert a textual
address into latitude/longitude. Honors Nominatim ToS:
  - User-Agent identifying the application
  - One request at a time (we don't queue; callers must rate-limit themselves)
  - Falls back to (None, None) on any error — never raises.
"""
from __future__ import annotations

import logging
import os
from typing import Optional, Tuple

import httpx

logger = logging.getLogger("khalaba.geocoder")

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = os.environ.get(
    "KHALABA_USER_AGENT",
    "KhalabaMNCH/1.0 (https://khalaba.health; contact: tech@khalaba.health)",
)
# Bias geocoding towards Chad — improves accuracy for neighbourhood-level queries
DEFAULT_COUNTRY_CODES = os.environ.get("KHALABA_GEOCODE_COUNTRY", "td")
TIMEOUT_SECONDS = 4.0


async def geocode_address(address: str) -> Tuple[Optional[float], Optional[float]]:
    """Resolve `address` to (lat, lon). Returns (None, None) on any error/miss."""
    if not address or not address.strip():
        return None, None
    params = {
        "q": address,
        "format": "json",
        "limit": 1,
        "countrycodes": DEFAULT_COUNTRY_CODES,
        "addressdetails": 0,
    }
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "fr"}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            r = await client.get(NOMINATIM_URL, params=params, headers=headers)
        if r.status_code != 200:
            logger.info("Nominatim non-200 (%s) for %r", r.status_code, address)
            return None, None
        data = r.json()
        if not data:
            return None, None
        first = data[0]
        return float(first["lat"]), float(first["lon"])
    except Exception as e:
        logger.warning("Nominatim geocode failed for %r: %s", address, e)
        return None, None
