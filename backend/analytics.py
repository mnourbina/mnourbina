"""KHALABA — Analytics & clinical helpers.

This module factorises the pure/database helpers used across the
analytics, KPI, DHIS2 export and LTFU surveillance routes so that
`server.py` stays focused on route declarations.

All async helpers take a Motor database instance as their first
argument to remain testable in isolation.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, List

# ============================================================
# UNFPA / OMS targets (Brique 5)
# ============================================================
UNFPA_TARGETS = {
    "cpn4_rate": 75.0,
    "assisted_birth_rate": 85.0,
    "anemia_rate": 20.0,            # max acceptable (lower-is-better)
    "death_audit_rate": 95.0,
}

# ============================================================
# LTFU thresholds (Brique 7)
# ============================================================
LTFU_THRESHOLD_DAYS = 14

# WHO 8-contact ANC schedule windows — mirrors frontend CPN_SCHEDULE_OMS
CPN_OMS_WINDOWS = [
    {"number": 1, "weekMin": 0,  "weekMax": 12, "label": "CPN1 — 1er trimestre"},
    {"number": 2, "weekMin": 20, "weekMax": 24, "label": "CPN2 — 2ème trimestre"},
    {"number": 3, "weekMin": 26, "weekMax": 30, "label": "CPN3 — 2ème trimestre"},
    {"number": 4, "weekMin": 30, "weekMax": 34, "label": "CPN4 — 3ème trimestre"},
    {"number": 5, "weekMin": 34, "weekMax": 36, "label": "CPN5 — 3ème trimestre"},
    {"number": 6, "weekMin": 36, "weekMax": 38, "label": "CPN6 — 3ème trimestre"},
    {"number": 7, "weekMin": 38, "weekMax": 40, "label": "CPN7 — 3ème trimestre"},
    {"number": 8, "weekMin": 40, "weekMax": 42, "label": "CPN8 — Post-terme"},
]


def next_cpn_overdue(lmp_date_str: str, done_numbers: list) -> Optional[dict]:
    """Pure port of frontend `getNextCPN()` — returns next CPN slot with daysLate.

    Window-aware selection:
      1. Prefer the contact whose [weekMin, weekMax] contains current GA AND that isn't done.
      2. Fallback: next undone contact whose weekMin >= current week.
      3. Fallback: any undone contact (we're past the schedule).
    `days_late` is non-zero only when GA > weekMax of the picked slot.
    """
    if not lmp_date_str:
        return None
    try:
        lmp = datetime.fromisoformat(lmp_date_str)
    except Exception:
        return None
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    delta_days = (now - lmp.replace(tzinfo=None)).days
    weeks = delta_days // 7
    done = set(done_numbers or [])

    nxt = next(
        (c for c in CPN_OMS_WINDOWS if c["weekMin"] <= weeks <= c["weekMax"] and c["number"] not in done),
        None,
    )
    if not nxt:
        nxt = next((c for c in CPN_OMS_WINDOWS if c["number"] not in done and c["weekMin"] >= weeks), None)
    if not nxt:
        nxt = next((c for c in CPN_OMS_WINDOWS if c["number"] not in done), None)
    if not nxt:
        return None

    days_late = (weeks - nxt["weekMax"]) * 7 if weeks > nxt["weekMax"] else 0
    return {**nxt, "current_week": weeks, "days_late": days_late}


# ============================================================
# DHIS2 indicator definitions (Brique 8)
# ============================================================
DHIS2_INDICATOR_DEFS = [
    {"code": "DE_CPN1_TOTAL",    "label": "Nombre de CPN1",             "formula": "cpn_visits where visit_number == 1", "category": "CPN"},
    {"code": "DE_CPN4_TOTAL",    "label": "Nombre de CPN4+",            "formula": "grossesses avec >= 4 cpn_visits",    "category": "CPN"},
    {"code": "DE_ANEMIA_PREG",   "label": "Anémie de la grossesse",     "formula": "Hb < 11 g/dL",                       "category": "Biologie"},
    {"code": "DE_VIH_TESTED",    "label": "Femmes testées VIH",         "formula": "hiv_status != INCONNU",              "category": "VIH"},
    {"code": "DE_VIH_POS",       "label": "VIH positifs",               "formula": "hiv_status = positif",               "category": "VIH"},
    {"code": "DE_SYPH_TESTED",   "label": "Femmes testées Syphilis",    "formula": "syphilis_status != INCONNU",         "category": "Syphilis"},
    {"code": "DE_SYPH_POS",      "label": "Syphilis positifs",          "formula": "syphilis_status = positif",          "category": "Syphilis"},
    {"code": "DE_MATERNAL_DEATH","label": "Décès maternels",            "formula": "death_type = maternelle",            "category": "Mortalité"},
    {"code": "DE_NEONATAL_DEATH","label": "Décès néonatals",            "formula": "death_type = neonatale",             "category": "Mortalité"},
    {"code": "DE_MPDSR_AUDITED", "label": "MPDSR audités (< 30j)",
     "formula": "audit_status = audite_en_comite et audit_date - death_date <= 30j", "category": "MPDSR"},
]

# Simplified mapping aligned with district monthly report (Brique 8 — /reports/dhis2)
DHIS2_REPORT_MAPPING = {
    "ANC_Registered":      ("totalPregnancies", "ANC1"),
    "ANC1_Visits":         ("cpn1",             "ANC1_VISIT"),
    "ANC4_Visits":         ("cpn4",             "ANC4_VISIT"),
    "Deliveries_Facility": ("assistedBirths",   "DEL_FACILITY"),
    "Anemia_Screened":     ("anemiaScreened",   "ANEMIA_SCR"),
    "Anemia_Cases":        ("anemiaCases",      "ANEMIA_CASE"),
    "HIV_Tested":          ("hivTested",        "HIV_TEST"),
    "HIV_Positive":        ("hivPositive",      "HIV_POS"),
    "Maternal_Deaths":     ("maternalDeaths",   "MAT_DEATH"),
    "Neonatal_Deaths":     ("neonatalDeaths",   "NEO_DEATH"),
}


# ============================================================
# Scope / zone helpers
# ============================================================
async def patient_ids_in_zone(db, zone_id: Optional[str]) -> Optional[List[str]]:
    if not zone_id:
        return None
    return [p["id"] async for p in db.patients.find({"zone_id": zone_id}, {"id": 1})]


async def pregnancy_ids_for_patients(db, patient_ids: Optional[List[str]]) -> Optional[List[str]]:
    if patient_ids is None:
        return None
    return [pr["id"] async for pr in db.pregnancies.find({"patient_id": {"$in": patient_ids}}, {"id": 1})]


async def resolve_dhis2_org_unit(db, zone_id: Optional[str], default: str = "NATIONAL") -> str:
    """Resolve a Khalaba zone_id to its official DHIS2 org unit UID,
    falling back to the linked region's UID, then to a constant."""
    if not zone_id:
        return default
    z = await db.zones.find_one({"id": zone_id}, {"_id": 0, "dhis2_org_unit_uid": 1, "region_id": 1})
    if not z:
        return zone_id
    if z.get("dhis2_org_unit_uid"):
        return z["dhis2_org_unit_uid"]
    if z.get("region_id"):
        r = await db.regions.find_one({"id": z["region_id"]}, {"_id": 0, "dhis2_org_unit_uid": 1})
        if r and r.get("dhis2_org_unit_uid"):
            return r["dhis2_org_unit_uid"]
    return zone_id


# ============================================================
# DHIS2 indicators aggregation
# ============================================================
async def compute_dhis2_indicators(db, zone_id: Optional[str], date_from: Optional[str], date_to: Optional[str]) -> dict:
    patient_ids = await patient_ids_in_zone(db, zone_id)
    pregnancy_ids = await pregnancy_ids_for_patients(db, patient_ids)

    cpn_q: dict = {}
    if pregnancy_ids is not None:
        cpn_q["pregnancy_id"] = {"$in": pregnancy_ids}
    if date_from or date_to:
        dq: dict = {}
        if date_from:
            dq["$gte"] = date_from
        if date_to:
            dq["$lte"] = date_to
        cpn_q["visit_date"] = dq

    cpn1 = await db.cpn_visits.count_documents({**cpn_q, "visit_number": 1})

    # CPN4+ : grossesses avec >= 4 visites
    pipeline_cpn4 = [
        {"$match": cpn_q} if cpn_q else {"$match": {}},
        {"$group": {"_id": "$pregnancy_id", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gte": 4}}},
        {"$count": "n"},
    ]
    cpn4_doc = await db.cpn_visits.aggregate(pipeline_cpn4).to_list(1)
    cpn4 = cpn4_doc[0]["n"] if cpn4_doc else 0

    anemia = await db.cpn_visits.count_documents({**cpn_q, "hemoglobin": {"$lt": 11, "$gt": 0}})
    vih_tested = await db.cpn_visits.count_documents({**cpn_q, "hiv_status": {"$in": ["negatif", "positif", "NEG", "POS"]}})
    vih_pos = await db.cpn_visits.count_documents({**cpn_q, "hiv_status": {"$in": ["positif", "POS"]}})
    syph_tested = await db.cpn_visits.count_documents({**cpn_q, "syphilis_status": {"$in": ["negatif", "positif", "NEG", "POS"]}})
    syph_pos = await db.cpn_visits.count_documents({**cpn_q, "syphilis_status": {"$in": ["positif", "POS"]}})

    mpdsr_q: dict = {}
    if patient_ids is not None:
        mpdsr_q["patient_id"] = {"$in": patient_ids}
    if date_from or date_to:
        ddq: dict = {}
        if date_from:
            ddq["$gte"] = date_from
        if date_to:
            ddq["$lte"] = date_to
        mpdsr_q["death_date"] = ddq

    maternal_death = await db.mpdsr_reports.count_documents({**mpdsr_q, "death_type": "maternelle"})
    neonatal_death = await db.mpdsr_reports.count_documents({**mpdsr_q, "death_type": "neonatale"})

    # MPDSR audités < 30 j
    audited = 0
    async for r in db.mpdsr_reports.find(
        {**mpdsr_q, "audit_status": "audite_en_comite", "audit_date": {"$ne": None}},
        {"_id": 0, "death_date": 1, "audit_date": 1},
    ):
        try:
            dd = datetime.fromisoformat(r["death_date"])
            ad = datetime.fromisoformat(r["audit_date"])
            if (ad - dd).days <= 30:
                audited += 1
        except Exception:
            continue

    return {
        "DE_CPN1_TOTAL": cpn1,
        "DE_CPN4_TOTAL": cpn4,
        "DE_ANEMIA_PREG": anemia,
        "DE_VIH_TESTED": vih_tested,
        "DE_VIH_POS": vih_pos,
        "DE_SYPH_TESTED": syph_tested,
        "DE_SYPH_POS": syph_pos,
        "DE_MATERNAL_DEATH": maternal_death,
        "DE_NEONATAL_DEATH": neonatal_death,
        "DE_MPDSR_AUDITED": audited,
    }
