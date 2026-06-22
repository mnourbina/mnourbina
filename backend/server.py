"""KHALABA backend API server."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse, PlainTextResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import io
import csv
from datetime import datetime, timezone, timedelta

from auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_temp_otp_token,
    decode_token,
    generate_otp_code,
    set_auth_cookies,
    clear_auth_cookies,
    get_current_user,
)
from models import (
    RegisterIn,
    LoginIn,
    VerifyOtpIn,
    RegionIn,
    ZoneIn,
    StructureIn,
    PatientIn,
    PregnancyIn,
    CPNVisitIn,
    PostnatalVisitIn,
    ChildIn,
    VaccinationIn,
    MPDSRReportIn,
    AppointmentIn,
    new_id,
    now_iso,
)
from analytics import (
    UNFPA_TARGETS,
    LTFU_THRESHOLD_DAYS,
    CPN_OMS_WINDOWS as _CPN_OMS_WINDOWS,
    DHIS2_INDICATOR_DEFS,
    DHIS2_REPORT_MAPPING,
    next_cpn_overdue as _next_cpn_overdue,
    patient_ids_in_zone,
    pregnancy_ids_for_patients,
    resolve_dhis2_org_unit,
    compute_dhis2_indicators,
)
from geocoder import geocode_address

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("khalaba")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="KHALABA API")
api = APIRouter(prefix="/api")
scheduler = AsyncIOScheduler()


async def current_user(request: Request):
    return await get_current_user(request, db)


def require_role(*roles):
    async def dep(user=Depends(current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Accès interdit pour ce rôle")
        return user
    return dep


# ============================================================
# Audit log helper (Brique 10 — generic audit trail)
# ============================================================
async def audit(user: Optional[dict], action: str, entity: str, entity_id: Optional[str] = None,
                new_data: Optional[dict] = None, old_data: Optional[dict] = None,
                extra: Optional[dict] = None) -> None:
    """Insert a structured audit log entry. Never raises (best-effort)."""
    try:
        doc = {
            "id": new_id(),
            "user_id": (user or {}).get("id"),
            "user_email": (user or {}).get("email"),
            "user_role": (user or {}).get("role"),
            "action": action,
            "entity": entity,
            "entity_id": entity_id,
            "new_data": new_data,
            "old_data": old_data,
            "created_at": now_iso(),
        }
        if extra:
            doc.update(extra)
        await db.audit_logs.insert_one(doc)
    except Exception as e:
        logger.warning("audit log failed for %s/%s: %s", action, entity, e)


# ============================================================
# Health
# ============================================================
@api.get("/")
async def root():
    return {"message": "KHALABA API", "version": "1.0.0"}


# ============================================================
# AUTH
# ============================================================
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    user_doc = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name.strip(),
        "role": payload.role,
        "phone": payload.phone,
        "zone_id": payload.zone_id,
        "structure_id": payload.structure_id,
        "profession": payload.profession,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    # If patient, create a patient record
    if payload.role == "patient" and payload.zone_id:
        await db.patients.insert_one({
            "id": new_id(),
            "user_id": user_doc["id"],
            "full_name": user_doc["name"],
            "dob": None,
            "phone": user_doc["phone"],
            "address": None,
            "zone_id": payload.zone_id,
            "structure_id": payload.structure_id,
            "blood_group": None,
            "emergency_contact": None,
            "created_at": now_iso(),
        })
    access = create_access_token(user_doc["id"], email, user_doc["role"])
    refresh = create_refresh_token(user_doc["id"])
    set_auth_cookies(response, access, refresh)
    public = {k: v for k, v in user_doc.items() if k not in ("password_hash", "_id")}
    return public


@api.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    otp = generate_otp_code()
    temp_token = create_temp_otp_token(user["id"])
    await db.otp_codes.update_one(
        {"user_id": user["id"]},
        {"$set": {"code": otp, "issued_at": now_iso(), "temp_token": temp_token}},
        upsert=True,
    )
    logger.info("OTP for %s = %s (simulated SMS)", email, otp)
    # Simulated SMS: return the OTP directly so the demo flow works without external provider
    return {
        "temp_token": temp_token,
        "otp_code": otp,
        "message": "Code OTP envoyé (simulé)",
        "demo": True,
    }


@api.post("/auth/verify-otp")
async def verify_otp(payload: VerifyOtpIn, response: Response):
    try:
        decoded = decode_token(payload.temp_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Token temporaire invalide ou expiré")
    if decoded.get("type") != "otp_pending":
        raise HTTPException(status_code=401, detail="Token invalide")
    user_id = decoded["sub"]
    record = await db.otp_codes.find_one({"user_id": user_id})
    if not record or record.get("code") != payload.otp_code.strip():
        raise HTTPException(status_code=401, detail="Code OTP incorrect")
    await db.otp_codes.delete_one({"user_id": user_id})

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    access = create_access_token(user["id"], user["email"], user["role"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return user


@api.post("/auth/logout")
async def logout(response: Response, user=Depends(current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


# ============================================================
# REGIONS / ZONES (= districts) / STRUCTURES (= facilities)
# Hierarchy: Region → Zone (district sanitaire) → Structure (facility)
# ============================================================
@api.get("/regions")
async def list_regions():
    return await db.regions.find({}, {"_id": 0}).sort("name", 1).to_list(500)


@api.post("/regions")
async def create_region(payload: RegionIn, user=Depends(require_role("admin"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso()}
    await db.regions.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "CREATE", "Region", doc["id"], new_data=doc)
    return doc


@api.patch("/regions/{region_id}")
async def update_region(region_id: str, payload: dict, user=Depends(require_role("admin"))):
    allowed = {k: v for k, v in payload.items() if k in {"name", "country", "dhis2_org_unit_uid"}}
    if not allowed:
        raise HTTPException(400, "Aucun champ valide")
    allowed["updated_at"] = now_iso()
    res = await db.regions.update_one({"id": region_id}, {"$set": allowed})
    if res.matched_count == 0:
        raise HTTPException(404, "Région introuvable")
    await audit(user, "UPDATE", "Region", region_id, new_data=allowed)
    return await db.regions.find_one({"id": region_id}, {"_id": 0})


@api.get("/zones")
async def list_zones():
    zones = await db.zones.find({}, {"_id": 0}).to_list(500)
    return zones


@api.post("/zones")
async def create_zone(payload: ZoneIn, user=Depends(require_role("admin"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso()}
    # Auto-link region_id from region name if not supplied
    if not doc.get("region_id") and doc.get("region"):
        existing = await db.regions.find_one({"name": doc["region"]}, {"_id": 0})
        if existing:
            doc["region_id"] = existing["id"]
        else:
            new_region = {"id": new_id(), "name": doc["region"], "country": doc.get("country", "Tchad"),
                          "dhis2_org_unit_uid": None, "created_at": now_iso()}
            await db.regions.insert_one(new_region)
            doc["region_id"] = new_region["id"]
    await db.zones.insert_one(doc)
    doc.pop('_id', None)
    await audit(user, "CREATE", "Zone", doc["id"], new_data=doc)
    return doc


@api.patch("/zones/{zone_id}")
async def update_zone(zone_id: str, payload: dict, user=Depends(require_role("admin"))):
    allowed = {k: v for k, v in payload.items()
               if k in {"name", "region", "region_id", "country", "dhis2_org_unit_uid"}}
    if not allowed:
        raise HTTPException(400, "Aucun champ valide")
    allowed["updated_at"] = now_iso()
    res = await db.zones.update_one({"id": zone_id}, {"$set": allowed})
    if res.matched_count == 0:
        raise HTTPException(404, "Zone introuvable")
    await audit(user, "UPDATE", "Zone", zone_id, new_data=allowed)
    return await db.zones.find_one({"id": zone_id}, {"_id": 0})


@api.get("/structures")
async def list_structures(zone_id: Optional[str] = None, district_id: Optional[str] = None,
                          region_id: Optional[str] = None):
    q = {}
    # zone_id and district_id are synonyms (district_id is the canonical name introduced in Brique 12)
    formal_id = district_id or zone_id
    if formal_id:
        q["zone_id"] = formal_id
    if region_id:
        q["region_id"] = region_id
    return await db.structures.find(q, {"_id": 0}).to_list(500)


@api.post("/structures")
async def create_structure(payload: StructureIn, user=Depends(require_role("admin"))):
    data = payload.model_dump()
    # Canonical: ensure zone_id and district_id stay in sync, denormalise region_id
    canonical = data.get("district_id") or data.get("zone_id")
    if not canonical:
        raise HTTPException(400, "zone_id (ou district_id) requis")
    data["zone_id"] = canonical
    data["district_id"] = canonical
    if not data.get("region_id"):
        z = await db.zones.find_one({"id": canonical}, {"_id": 0, "region_id": 1})
        data["region_id"] = (z or {}).get("region_id")
    doc = {"id": new_id(), **data, "created_at": now_iso()}
    await db.structures.insert_one(doc)
    doc.pop('_id', None)
    await audit(user, "CREATE", "Structure", doc["id"], new_data=doc)
    return doc


@api.patch("/structures/{structure_id}")
async def update_structure(structure_id: str, payload: dict, user=Depends(require_role("admin"))):
    allowed = {k: v for k, v in payload.items()
               if k in {"name", "zone_id", "district_id", "region_id", "type", "dhis2_org_unit_uid"}}
    if not allowed:
        raise HTTPException(400, "Aucun champ valide")
    # Keep zone_id and district_id in sync
    canonical = allowed.get("district_id") or allowed.get("zone_id")
    if canonical:
        allowed["zone_id"] = canonical
        allowed["district_id"] = canonical
        # Re-derive region_id when district changes (unless caller overrode it)
        if "region_id" not in payload:
            z = await db.zones.find_one({"id": canonical}, {"_id": 0, "region_id": 1})
            allowed["region_id"] = (z or {}).get("region_id")
    allowed["updated_at"] = now_iso()
    res = await db.structures.update_one({"id": structure_id}, {"$set": allowed})
    if res.matched_count == 0:
        raise HTTPException(404, "Structure introuvable")
    await audit(user, "UPDATE", "Structure", structure_id, new_data=allowed)
    return await db.structures.find_one({"id": structure_id}, {"_id": 0})


# ============================================================
# PATIENTS
# ============================================================
def _zone_filter_for_user(user: dict) -> dict:
    if user["role"] == "soignant" and user.get("zone_id"):
        return {"zone_id": user["zone_id"]}
    return {}


@api.get("/patients")
async def list_patients(user=Depends(current_user)):
    if user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": user["id"]}, {"_id": 0})
        return [patient] if patient else []
    q = _zone_filter_for_user(user)
    return await db.patients.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/patients")
async def create_patient(payload: PatientIn, user=Depends(require_role("soignant", "admin"))):
    doc = {
        "id": new_id(),
        **payload.model_dump(),
        "user_id": None,
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    # Brique 14 — auto-geocode address if coords missing
    if doc.get("address") and (doc.get("latitude") is None or doc.get("longitude") is None):
        lat, lon = await geocode_address(doc["address"])
        if lat is not None and lon is not None:
            doc["latitude"] = lat
            doc["longitude"] = lon
            doc["geocoded_at"] = now_iso()
    await db.patients.insert_one(doc)
    doc.pop('_id', None)
    await audit(user, "CREATE", "Patient", doc["id"], new_data={"full_name": doc.get("full_name"), "zone_id": doc.get("zone_id")})
    return doc


@api.post("/patients/{patient_id}/geocode")
async def geocode_patient(patient_id: str, user=Depends(require_role("soignant", "admin"))):
    """Force a re-geocoding of the patient address (e.g. after the address was edited)."""
    p = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Patient introuvable")
    if not p.get("address"):
        raise HTTPException(400, "Adresse absente")
    lat, lon = await geocode_address(p["address"])
    if lat is None:
        raise HTTPException(422, "Adresse non géocodable")
    await db.patients.update_one(
        {"id": patient_id},
        {"$set": {"latitude": lat, "longitude": lon, "geocoded_at": now_iso(), "updated_at": now_iso()}},
    )
    await audit(user, "GEOCODE", "Patient", patient_id, new_data={"lat": lat, "lng": lon})
    return {"latitude": lat, "longitude": lon}


@api.get("/patients/{patient_id}")
async def get_patient(patient_id: str, user=Depends(current_user)):
    p = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Patient introuvable")
    if user["role"] == "soignant" and user.get("zone_id") and p.get("zone_id") != user["zone_id"]:
        raise HTTPException(403, "Patient hors de votre zone")
    if user["role"] == "patient" and p.get("user_id") != user["id"]:
        raise HTTPException(403, "Accès interdit")
    # attach pregnancies, children
    pregnancies = await db.pregnancies.find({"patient_id": patient_id}, {"_id": 0}).to_list(50)
    children = await db.children.find({"patient_id": patient_id}, {"_id": 0}).to_list(50)
    p["pregnancies"] = pregnancies
    p["children"] = children
    return p


# ============================================================
# PREGNANCIES
# ============================================================
@api.post("/pregnancies")
async def create_pregnancy(payload: PregnancyIn, user=Depends(require_role("soignant", "admin"))):
    doc = {
        "id": new_id(),
        **payload.model_dump(),
        "status": "en_cours",
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    await db.pregnancies.insert_one(doc)
    doc.pop('_id', None)
    await audit(user, "CREATE", "Pregnancy", doc["id"],
                new_data={"patient_id": doc.get("patient_id"), "lmp_date": doc.get("lmp_date")})
    return doc


@api.get("/pregnancies")
async def list_pregnancies(
    status: Optional[str] = None,
    user=Depends(current_user),
):
    """List pregnancies (with nested patient + last CPN). Soignant: zone-filtered."""
    if user["role"] == "patient":
        raise HTTPException(403, "Réservé aux soignants")
    if user["role"] == "soignant" and user.get("zone_id"):
        patient_ids = [p["id"] async for p in db.patients.find({"zone_id": user["zone_id"]}, {"id": 1})]
        q = {"patient_id": {"$in": patient_ids}}
    else:
        q = {}
    if status:
        q["status"] = status
    pregnancies = await db.pregnancies.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    results = []
    for preg in pregnancies:
        patient = await db.patients.find_one({"id": preg["patient_id"]}, {"_id": 0})
        last_cpn = await db.cpn_visits.find_one(
            {"pregnancy_id": preg["id"]},
            {"_id": 0},
            sort=[("visit_number", -1)],
        )
        done_cpns = sorted({
            d.get("visit_number") async for d in db.cpn_visits.find(
                {"pregnancy_id": preg["id"]}, {"visit_number": 1, "_id": 0}
            ) if d.get("visit_number") is not None
        })
        preg["patient"] = patient
        preg["last_cpn"] = last_cpn
        preg["done_cpns"] = done_cpns
        preg["cpn_count"] = len(done_cpns)
        results.append(preg)
    return results


@api.patch("/pregnancies/{pregnancy_id}")
async def update_pregnancy(pregnancy_id: str, payload: dict, user=Depends(require_role("soignant", "admin"))):
    allowed_status = {"en_cours", "perdue_vue", "accouchee", "fausse_couche", "ivg", "transferee", "active"}
    update = {}
    if "status" in payload:
        if payload["status"] not in allowed_status:
            raise HTTPException(400, "Statut invalide")
        update["status"] = payload["status"]
    for k in ("notes", "delivery_date", "found_at"):
        if k in payload:
            update[k] = payload[k]
    if not update:
        raise HTTPException(400, "Aucun champ valide à modifier")
    update["updated_at"] = now_iso()
    res = await db.pregnancies.update_one({"id": pregnancy_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Grossesse introuvable")
    return await db.pregnancies.find_one({"id": pregnancy_id}, {"_id": 0})


@api.post("/pregnancies/{pregnancy_id}/found")
async def mark_pregnancy_found(pregnancy_id: str, payload: Optional[dict] = None, user=Depends(require_role("soignant", "admin"))):
    notes = (payload or {}).get("notes") if payload else None
    res = await db.pregnancies.update_one(
        {"id": pregnancy_id},
        {"$set": {"status": "en_cours", "found_at": now_iso(), "updated_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Grossesse introuvable")
    # Resolve any open LTFU alert
    await db.alerts.update_many(
        {"pregnancy_id": pregnancy_id, "type": "PERDUE_DE_VUE", "is_read": False},
        {"$set": {"is_read": True, "resolved_at": now_iso()}},
    )
    # Audit log
    await db.audit_logs.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "user_email": user["email"],
        "action": "MARKED_FOUND",
        "entity": "Pregnancy",
        "entity_id": pregnancy_id,
        "new_data": {"notes": notes, "found_at": now_iso()},
        "created_at": now_iso(),
    })
    return await db.pregnancies.find_one({"id": pregnancy_id}, {"_id": 0})


@api.get("/pregnancies/{pregnancy_id}")
async def get_pregnancy(pregnancy_id: str, user=Depends(current_user)):
    p = await db.pregnancies.find_one({"id": pregnancy_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Grossesse introuvable")
    cpn = await db.cpn_visits.find({"pregnancy_id": pregnancy_id}, {"_id": 0}).sort("visit_number", 1).to_list(50)
    postnatal = await db.postnatal_visits.find({"pregnancy_id": pregnancy_id}, {"_id": 0}).to_list(50)
    p["cpn_visits"] = cpn
    p["postnatal_visits"] = postnatal
    return p


# ============================================================
# Brique 7 — Perdues de vue (LTFU) automatique
# ============================================================
# OMS: 2 semaines de retard sur la fenêtre OMS = perdue de vue
async def _find_asc_for_patient(patient: dict) -> Optional[dict]:
    """V1: any soignant in the same zone acts as ASC.
    V2: dedicated role + geo matching per quartier."""
    if not patient or not patient.get("zone_id"):
        return None
    return await db.users.find_one(
        {"role": "soignant", "zone_id": patient["zone_id"]},
        {"_id": 0, "id": 1, "name": 1, "phone": 1, "email": 1},
    )


async def _notify_asc(asc: dict, patient: dict, next_cpn: dict, days_late: int) -> None:
    """V1: log only (no Twilio). Replace with WhatsApp send when integration is enabled."""
    if not asc or not asc.get("phone"):
        return
    weeks_late = days_late // 7
    message = (
        f"[KHALABA] Recherche perdue de vue\n"
        f"Patiente: {patient.get('full_name', 'N/A')}\n"
        f"Tél: {patient.get('phone') or 'Non renseigné'}\n"
        f"Adresse: {patient.get('address') or 'Non renseignée'}\n"
        f"{next_cpn['label']} en retard de {weeks_late} semaine(s).\n"
        f"Action: visite à domicile et ramener au CSC."
    )
    logger.info("LTFU notify (mock SMS) → %s : %s", asc.get("phone"), message.replace("\n", " | "))


async def run_ltfu_scan() -> list:
    """Scan en_cours pregnancies, flip to perdue_vue when CPN >14 days overdue.
    Creates a PERDUE_DE_VUE alert + ASC assignment + audit log.
    Idempotent — never creates duplicate open alerts.
    """
    flagged: list = []
    pregnancies = await db.pregnancies.find(
        {"status": {"$in": ["en_cours", "active"]}}, {"_id": 0}
    ).to_list(5000)
    for preg in pregnancies:
        done = [
            d["visit_number"] async for d in db.cpn_visits.find(
                {"pregnancy_id": preg["id"]}, {"visit_number": 1, "_id": 0}
            ) if d.get("visit_number") is not None
        ]
        nxt = _next_cpn_overdue(preg.get("lmp_date"), done)
        if not nxt or nxt["days_late"] <= LTFU_THRESHOLD_DAYS:
            continue

        patient = await db.patients.find_one({"id": preg["patient_id"]}, {"_id": 0})
        asc = await _find_asc_for_patient(patient)
        weeks_late = nxt["days_late"] // 7

        # Mark pregnancy as LTFU
        await db.pregnancies.update_one(
            {"id": preg["id"]},
            {"$set": {"status": "perdue_vue", "updated_at": now_iso()}},
        )

        # Idempotency: skip if open LTFU alert already exists
        existing = await db.alerts.find_one({
            "pregnancy_id": preg["id"], "type": "PERDUE_DE_VUE", "is_read": False
        })
        alert_id = existing["id"] if existing else new_id()
        if not existing:
            await db.alerts.insert_one({
                "id": alert_id,
                "pregnancy_id": preg["id"],
                "type": "PERDUE_DE_VUE",
                "message": (
                    f"{(patient or {}).get('full_name', 'Patiente')} — {nxt['label']} "
                    f"en retard de {weeks_late} semaine(s). Recherche domicile."
                ),
                "severity": "WARNING",
                "is_read": False,
                "resolved_at": None,
                "context": {
                    "days_late": nxt["days_late"],
                    "expected_cpn": nxt["number"],
                    "label": nxt["label"],
                },
                "created_at": now_iso(),
            })

        # Notify + audit (only on first detection)
        if not existing and asc:
            await _notify_asc(asc, patient or {}, nxt, nxt["days_late"])
            await db.audit_logs.insert_one({
                "id": new_id(),
                "user_id": asc["id"],
                "user_email": asc.get("email", ""),
                "action": "ASSIGNED_LTFU",
                "entity": "Pregnancy",
                "entity_id": preg["id"],
                "new_data": {"alert_id": alert_id, "days_late": nxt["days_late"]},
                "created_at": now_iso(),
            })

        flagged.append({
            "pregnancy_id": preg["id"],
            "patient_id": preg.get("patient_id"),
            "patient_name": (patient or {}).get("full_name"),
            "phone": (patient or {}).get("phone"),
            "address": (patient or {}).get("address"),
            "zone_id": (patient or {}).get("zone_id"),
            "days_late": nxt["days_late"],
            "weeks_late": weeks_late,
            "expected_cpn": nxt["number"],
            "expected_cpn_label": nxt["label"],
            "asc": asc.get("name") if asc else None,
            "asc_phone": asc.get("phone") if asc else None,
            "alert_id": alert_id,
            "already_flagged": bool(existing),
        })
    return flagged


@api.post("/admin/check-ltfu")
async def check_ltfu_endpoint(user=Depends(require_role("admin"))):
    """Manual trigger for the LTFU scan (also runs daily at 07:00 via APScheduler)."""
    flagged = await run_ltfu_scan()
    return {
        "scanned_at": now_iso(),
        "threshold_days": LTFU_THRESHOLD_DAYS,
        "flagged_count": len(flagged),
        "newly_flagged": [f for f in flagged if not f["already_flagged"]],
        "flagged": flagged,
    }


@api.get("/admin/ltfu")
async def list_ltfu_cases(user=Depends(require_role("admin", "soignant"))):
    """List currently open LTFU cases (PERDUE_DE_VUE alerts unresolved).
    Zone-filtered for soignants."""
    q: dict = {"type": "PERDUE_DE_VUE", "is_read": False}
    if user["role"] == "soignant" and user.get("zone_id"):
        patient_ids = [p["id"] async for p in db.patients.find({"zone_id": user["zone_id"]}, {"id": 1})]
        preg_ids = [pr["id"] async for pr in db.pregnancies.find({"patient_id": {"$in": patient_ids}}, {"id": 1})]
        q["pregnancy_id"] = {"$in": preg_ids}
    alerts = await db.alerts.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for a in alerts:
        preg = await db.pregnancies.find_one({"id": a["pregnancy_id"]}, {"_id": 0, "patient_id": 1, "lmp_date": 1})
        if not preg:
            continue
        patient = await db.patients.find_one({"id": preg["patient_id"]}, {"_id": 0, "full_name": 1, "phone": 1, "address": 1, "id": 1})
        ctx = a.get("context") or {}
        out.append({
            "alert_id": a["id"],
            "pregnancy_id": a["pregnancy_id"],
            "patient": patient,
            "message": a["message"],
            "days_late": ctx.get("days_late"),
            "weeks_late": (ctx.get("days_late") or 0) // 7,
            "expected_cpn_label": ctx.get("label"),
            "created_at": a["created_at"],
        })
    return out


# ============================================================
# CPN VISITS
# ============================================================
async def _enqueue_sync(table_name: str, record_id: str, action: str, payload: dict) -> None:
    """Brique 2 — SyncQueue scaffold for offline-first replication.
    Persists a sync intent that an offline client / replication worker can consume.
    """
    safe_payload = {k: v for k, v in payload.items() if k != "_id"}
    await db.sync_queue.insert_one({
        "id": new_id(),
        "table_name": table_name,
        "record_id": record_id,
        "action": action,
        "payload": safe_payload,
        "created_at": now_iso(),
        "synced_at": None,
        "retry_count": 0,
    })


async def _check_and_persist_alerts(cpn: dict) -> list:
    """MSP-grade alert checker, faithful port of the reference checkAlerts."""
    alerts_to_create = []
    sys_bp = cpn.get("bp_systolic")
    dia_bp = cpn.get("bp_diastolic")
    hb = cpn.get("hemoglobin")
    fhr = cpn.get("fetal_heart_rate")
    prot = cpn.get("urine_albumin") or cpn.get("proteinuria")
    pid = cpn["pregnancy_id"]

    if sys_bp and dia_bp:
        if sys_bp >= 160 or dia_bp >= 110:
            alerts_to_create.append({"pregnancy_id": pid, "type": "PRE_ECLAMPSIE_SEVERE",
                "message": f"URGENCE: TA {sys_bp}/{dia_bp} mmHg. Référer immédiatement à l'hôpital", "severity": "CRITICAL"})
        elif sys_bp >= 140 or dia_bp >= 90:
            alerts_to_create.append({"pregnancy_id": pid, "type": "PRE_ECLAMPSIE_RISQUE",
                "message": f"TA élevée: {sys_bp}/{dia_bp} mmHg. Contrôler TA dans 4h + bandelette urinaire", "severity": "WARNING"})
    if hb is not None and hb > 0:
        if hb < 7:
            alerts_to_create.append({"pregnancy_id": pid, "type": "ANEMIE_SEVERE",
                "message": f"Anémie sévère: Hb {hb} g/dl. Transfusion + Fer IV urgent", "severity": "CRITICAL"})
        elif hb < 11:
            alerts_to_create.append({"pregnancy_id": pid, "type": "ANEMIE_MODEREE",
                "message": f"Anémie: Hb {hb} g/dl. Fer + Acide folique + conseil nutritionnel", "severity": "WARNING"})
    if fhr:
        if fhr < 110:
            alerts_to_create.append({"pregnancy_id": pid, "type": "BRADYCARDIE_FOETALE",
                "message": f"BCF bas: {fhr} bpm. Position latérale gauche + O2 + référer urgent", "severity": "CRITICAL"})
        elif fhr > 160:
            alerts_to_create.append({"pregnancy_id": pid, "type": "TACHYCARDIE_FOETALE",
                "message": f"BCF élevé: {fhr} bpm. Rechercher fièvre maternelle + infection", "severity": "WARNING"})
    if prot in ("++", "+++"):
        alerts_to_create.append({"pregnancy_id": pid, "type": "PROTEINURIE",
            "message": f"Protéinurie {prot}. Suspect pré-éclampsie. TA + créatinine urgentes", "severity": "WARNING"})

    persisted = []
    for a in alerts_to_create:
        a["id"] = new_id()
        a["consultation_id"] = cpn.get("id")
        a["is_read"] = False
        a["resolved_at"] = None
        a["created_at"] = now_iso()
        await db.alerts.insert_one(a)
        a.pop("_id", None)
        persisted.append(a)
    return persisted


@api.post("/cpn-visits")
async def create_cpn(payload: CPNVisitIn, user=Depends(require_role("soignant", "admin"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso(), "created_by": user["id"]}
    # Sync iptp <-> malaria_prophylaxis and urine_albumin <-> proteinuria
    if doc.get("iptp") is True:
        doc["malaria_prophylaxis"] = True
    if doc.get("malaria_prophylaxis") is True and doc.get("iptp") is None:
        doc["iptp"] = True
    if doc.get("urine_albumin") and not doc.get("proteinuria"):
        doc["proteinuria"] = doc["urine_albumin"]
    # Legacy short alerts
    legacy = []
    if payload.bp_systolic and payload.bp_systolic >= 140:
        legacy.append("Hypertension")
    if payload.bp_diastolic and payload.bp_diastolic >= 90:
        legacy.append("Hypertension diastolique")
    if payload.hemoglobin is not None and payload.hemoglobin < 7:
        legacy.append("Anémie sévère")
    elif payload.hemoglobin is not None and payload.hemoglobin < 11:
        legacy.append("Anémie")
    if (doc.get("proteinuria") or doc.get("urine_albumin")) in ("++", "+++"):
        legacy.append("Protéinurie élevée")
    doc["alerts"] = legacy
    await db.cpn_visits.insert_one(doc)
    doc.pop('_id', None)
    # MSP-grade persistent alerts
    persisted = await _check_and_persist_alerts(doc)
    doc["msp_alerts"] = persisted
    # Brique 2 — SyncQueue (offline-first replication)
    await _enqueue_sync("Consultation", doc["id"], "CREATE", doc)
    for alert in persisted:
        await _enqueue_sync("Alert", alert["id"], "CREATE", alert)
    return doc


@api.get("/cpn-visits")
async def list_cpn(pregnancy_id: str, user=Depends(current_user)):
    return await db.cpn_visits.find({"pregnancy_id": pregnancy_id}, {"_id": 0}).sort("visit_number", 1).to_list(50)


# ============================================================
# ALERTS (persistent, MSP-grade)
# ============================================================
@api.get("/alerts")
async def list_alerts(
    severity: Optional[str] = None,
    is_read: Optional[bool] = None,
    pregnancy_id: Optional[str] = None,
    type: Optional[str] = None,
    user=Depends(current_user),
):
    if user["role"] == "patient":
        raise HTTPException(403, "Réservé aux soignants")
    q: dict = {}
    if severity:
        q["severity"] = severity
    if is_read is not None:
        q["is_read"] = is_read
    if type:
        q["type"] = type
    if pregnancy_id:
        q["pregnancy_id"] = pregnancy_id
    elif user["role"] == "soignant" and user.get("zone_id"):
        patient_ids = [p["id"] async for p in db.patients.find({"zone_id": user["zone_id"]}, {"id": 1})]
        preg_ids = [pr["id"] async for pr in db.pregnancies.find({"patient_id": {"$in": patient_ids}}, {"id": 1})]
        q["pregnancy_id"] = {"$in": preg_ids}
    rows = await db.alerts.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Hydrate with patient name & last cpn
    for r in rows:
        preg = await db.pregnancies.find_one({"id": r["pregnancy_id"]}, {"_id": 0, "patient_id": 1, "lmp_date": 1})
        if preg:
            patient = await db.patients.find_one({"id": preg["patient_id"]}, {"_id": 0, "full_name": 1, "phone": 1, "id": 1})
            r["patient"] = patient
            r["lmp_date"] = preg.get("lmp_date")
    return rows


@api.get("/alerts/unread-count")
async def unread_alerts_count(user=Depends(current_user)):
    if user["role"] == "patient":
        return {"total": 0, "critical": 0}
    q: dict = {"is_read": False}
    if user["role"] == "soignant" and user.get("zone_id"):
        patient_ids = [p["id"] async for p in db.patients.find({"zone_id": user["zone_id"]}, {"id": 1})]
        preg_ids = [pr["id"] async for pr in db.pregnancies.find({"patient_id": {"$in": patient_ids}}, {"id": 1})]
        q["pregnancy_id"] = {"$in": preg_ids}
    total = await db.alerts.count_documents(q)
    critical = await db.alerts.count_documents({**q, "severity": "CRITICAL"})
    return {"total": total, "critical": critical}


@api.patch("/alerts/{alert_id}")
async def update_alert(alert_id: str, payload: dict, user=Depends(require_role("soignant", "admin"))):
    update = {}
    if "is_read" in payload:
        update["is_read"] = bool(payload["is_read"])
    if payload.get("resolve"):
        update["resolved_at"] = now_iso()
        update["is_read"] = True
    if not update:
        raise HTTPException(400, "Aucun champ à modifier")
    res = await db.alerts.update_one({"id": alert_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Alerte introuvable")
    doc = await db.alerts.find_one({"id": alert_id}, {"_id": 0})
    await _enqueue_sync("Alert", alert_id, "UPDATE", doc)
    return doc


# ============================================================
# SYNC QUEUE (Brique 2 — offline-first scaffold)
# ============================================================
@api.get("/sync-queue")
async def list_sync_queue(
    pending_only: bool = True,
    limit: int = 200,
    user=Depends(require_role("admin")),
):
    q = {"synced_at": None} if pending_only else {}
    rows = await db.sync_queue.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    total = await db.sync_queue.count_documents({})
    pending = await db.sync_queue.count_documents({"synced_at": None})
    return {"total": total, "pending": pending, "items": rows}


@api.post("/sync-queue/{queue_id}/mark-synced")
async def mark_synced(queue_id: str, user=Depends(require_role("admin"))):
    res = await db.sync_queue.update_one(
        {"id": queue_id},
        {"$set": {"synced_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Entrée introuvable")
    return {"ok": True}


# ============================================================
# POSTNATAL VISITS
# ============================================================
@api.post("/postnatal-visits")
async def create_postnatal(payload: PostnatalVisitIn, user=Depends(require_role("soignant", "admin"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso(), "created_by": user["id"]}
    alerts = []
    if payload.bleeding in ("abondant", "severe", "abundant"):
        alerts.append("Saignement post-partum")
    if payload.maternal_temp and payload.maternal_temp >= 38:
        alerts.append("Fièvre maternelle")
    if payload.danger_signs:
        alerts.append("Signes de danger présents")
    doc["alerts"] = alerts
    await db.postnatal_visits.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api.get("/postnatal-visits")
async def list_postnatal(pregnancy_id: str, user=Depends(current_user)):
    return await db.postnatal_visits.find({"pregnancy_id": pregnancy_id}, {"_id": 0}).to_list(50)


# ============================================================
# CHILDREN & VACCINATION
# ============================================================
@api.post("/children")
async def create_child(payload: ChildIn, user=Depends(require_role("soignant", "admin"))):
    pregnancy = await db.pregnancies.find_one({"id": payload.pregnancy_id})
    patient_id = pregnancy.get("patient_id") if pregnancy else None
    doc = {
        "id": new_id(),
        **payload.model_dump(),
        "patient_id": patient_id,
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    await db.children.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api.get("/children")
async def list_children(pregnancy_id: Optional[str] = None, patient_id: Optional[str] = None, user=Depends(current_user)):
    q = {}
    if pregnancy_id:
        q["pregnancy_id"] = pregnancy_id
    if patient_id:
        q["patient_id"] = patient_id
    return await db.children.find(q, {"_id": 0}).to_list(100)


@api.get("/children/{child_id}")
async def get_child(child_id: str, user=Depends(current_user)):
    child = await db.children.find_one({"id": child_id}, {"_id": 0})
    if not child:
        raise HTTPException(404, "Enfant introuvable")
    vaccines = await db.vaccinations.find({"child_id": child_id}, {"_id": 0}).to_list(200)
    child["vaccinations"] = vaccines
    return child


@api.post("/vaccinations")
async def create_vaccination(payload: VaccinationIn, user=Depends(require_role("soignant", "admin"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso(), "created_by": user["id"]}
    await db.vaccinations.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api.get("/vaccinations")
async def list_vaccinations(child_id: str, user=Depends(current_user)):
    return await db.vaccinations.find({"child_id": child_id}, {"_id": 0}).to_list(200)


# ============================================================
# MPDSR
# ============================================================
@api.post("/mpdsr")
async def create_mpdsr(payload: MPDSRReportIn, user=Depends(require_role("soignant", "admin"))):
    # Brique 4 — Conflict check: block if declarant already has a pending audit
    pending_q: dict = {
        "declared_by": user["id"],
        "audit_status": {"$in": ["en_attente_audit", "en_attente", "non_audite"]},
    }
    existing = await db.mpdsr_reports.find_one(pending_q)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Un décès en attente d'audit existe déjà (id={existing['id']}). Finalisez l'audit avant.",
        )
    doc = {"id": new_id(), **payload.model_dump(), "declared_by": user["id"], "created_at": now_iso(), "created_by": user["id"]}
    if doc.get("audit_status") in (None, "non_audite", "en_attente"):
        doc["audit_status"] = "en_attente_audit"
    await db.mpdsr_reports.insert_one(doc)
    doc.pop('_id', None)
    await _enqueue_sync("MaternalNeonatalDeath", doc["id"], "CREATE", doc)
    # Notify admins (placeholder log + audit log)
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "email": 1, "name": 1}).to_list(50)
    logger.warning(f"ALERTE MPDSR · Décès {doc['death_type']} déclaré par {user['name']} le {doc['death_date']}.")
    await db.audit_logs.insert_one({
        "id": new_id(), "user_id": user["id"], "user_email": user["email"],
        "action": "DEATH_DECLARED", "entity": "MaternalNeonatalDeath", "entity_id": doc["id"],
        "values_summary": {"death_type": doc["death_type"], "death_date": doc["death_date"], "admins": [a.get("email") for a in admins]},
        "created_at": now_iso(),
    })
    return {"death": doc, "must_complete_audit": True,
            "message": "Déclaration enregistrée. Audit MPDSR obligatoire avant toute autre action."}


@api.post("/mpdsr/{death_id}/complete-audit")
async def complete_mpdsr_audit(death_id: str, payload: dict, user=Depends(require_role("soignant", "admin"))):
    required = ["delay1_recours", "delay2_acces", "delay3_prise_charge", "preventable", "preventive_actions"]
    missing = [f for f in required if f not in payload]
    if missing:
        raise HTTPException(400, f"Champs requis manquants : {', '.join(missing)}")
    if not (payload["delay1_recours"] or payload["delay2_acces"] or payload["delay3_prise_charge"]):
        raise HTTPException(400, "Cochez au moins un retard selon le modèle OMS des 3 retards.")
    update = {
        "delay1_recours": bool(payload["delay1_recours"]),
        "delay2_acces": bool(payload["delay2_acces"]),
        "delay3_prise_charge": bool(payload["delay3_prise_charge"]),
        "delay1_factors": list(payload.get("delay1_factors") or []),
        "delay2_factors": list(payload.get("delay2_factors") or []),
        "delay3_factors": list(payload.get("delay3_factors") or []),
        "preventable": bool(payload["preventable"]),
        "preventive_actions": str(payload["preventive_actions"]),
        "audit_status": "audite_en_comite",
        "audit_date": payload.get("audit_date") or datetime.now(timezone.utc).date().isoformat(),
        "audit_recommendations": payload.get("audit_recommendations") or "",
        "audited_by": user["id"],
        "audited_at": now_iso(),
        "updated_at": now_iso(),
    }
    res = await db.mpdsr_reports.update_one({"id": death_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Déclaration MPDSR introuvable")
    doc = await db.mpdsr_reports.find_one({"id": death_id}, {"_id": 0})
    await _enqueue_sync("MaternalNeonatalDeath", death_id, "UPDATE", doc)
    await db.audit_logs.insert_one({
        "id": new_id(), "user_id": user["id"], "user_email": user["email"],
        "action": "DEATH_AUDITED", "entity": "MaternalNeonatalDeath", "entity_id": death_id,
        "values_summary": {"preventable": doc["preventable"], "delays": {"1": doc["delay1_recours"], "2": doc["delay2_acces"], "3": doc["delay3_prise_charge"]}},
        "created_at": now_iso(),
    })
    return doc


@api.get("/auth/pending-audit")
async def my_pending_audit(user=Depends(current_user)):
    if user["role"] == "patient":
        return {"pending": None}
    doc = await db.mpdsr_reports.find_one(
        {"declared_by": user["id"], "audit_status": {"$in": ["en_attente_audit", "en_attente", "non_audite"]}},
        {"_id": 0}, sort=[("created_at", -1)],
    )
    return {"pending": doc}


@api.get("/mpdsr")
async def list_mpdsr(user=Depends(require_role("soignant", "admin"))):
    q = _zone_filter_for_user(user) if user["role"] == "soignant" else {}
    # join with patient zone if available; here we just return all for admin
    return await db.mpdsr_reports.find(q, {"_id": 0}).sort("death_date", -1).to_list(200)


# ============================================================
# APPOINTMENTS
# ============================================================
@api.post("/appointments")
async def create_appointment(payload: AppointmentIn, user=Depends(require_role("soignant", "admin"))):
    doc = {"id": new_id(), **payload.model_dump(), "status": "scheduled", "created_at": now_iso(), "created_by": user["id"]}
    await db.appointments.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api.get("/appointments")
async def list_appointments(user=Depends(current_user)):
    if user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": user["id"]})
        if not patient:
            return []
        return await db.appointments.find({"patient_id": patient["id"]}, {"_id": 0}).sort("scheduled_at", 1).to_list(200)
    if user["role"] == "soignant":
        # Get all patients in zone
        zone = user.get("zone_id")
        if zone:
            patient_ids = [p["id"] async for p in db.patients.find({"zone_id": zone}, {"id": 1})]
            return await db.appointments.find({"patient_id": {"$in": patient_ids}}, {"_id": 0}).sort("scheduled_at", 1).to_list(500)
    return await db.appointments.find({}, {"_id": 0}).sort("scheduled_at", 1).to_list(500)


@api.patch("/appointments/{appt_id}")
async def update_appointment(appt_id: str, payload: dict, user=Depends(require_role("soignant", "admin"))):
    allowed = {"status", "notes", "scheduled_at"}
    update = {k: v for k, v in payload.items() if k in allowed}
    if not update:
        raise HTTPException(400, "Aucun champ valide à modifier")
    res = await db.appointments.update_one({"id": appt_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Rendez-vous introuvable")
    doc = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    return doc


@api.get("/patient/me/timeline")
async def patient_timeline(user=Depends(current_user)):
    if user["role"] != "patient":
        raise HTTPException(403, "Réservé aux patientes")
    patient = await db.patients.find_one({"user_id": user["id"]}, {"_id": 0})
    if not patient:
        return {"patient": None, "pregnancies": [], "children": []}
    pregnancies = await db.pregnancies.find({"patient_id": patient["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    for preg in pregnancies:
        preg["cpn_visits"] = await db.cpn_visits.find({"pregnancy_id": preg["id"]}, {"_id": 0}).sort("visit_number", 1).to_list(50)
        preg["postnatal_visits"] = await db.postnatal_visits.find({"pregnancy_id": preg["id"]}, {"_id": 0}).sort("visit_date", 1).to_list(50)
    children = await db.children.find({"patient_id": patient["id"]}, {"_id": 0}).to_list(20)
    for c in children:
        c["vaccinations"] = await db.vaccinations.find({"child_id": c["id"]}, {"_id": 0}).sort("date_given", 1).to_list(200)
    return {"patient": patient, "pregnancies": pregnancies, "children": children}


# ============================================================
# ANALYTICS (Admin)
# ============================================================
@api.get("/analytics/overview")
async def analytics_overview(user=Depends(require_role("admin"))):
    total_patients = await db.patients.count_documents({})
    total_pregnancies = await db.pregnancies.count_documents({})
    # Also count in analytics endpoint
    active_pregnancies = await db.pregnancies.count_documents({"status": {"$in": ["active", "en_cours"]}})
    total_cpn = await db.cpn_visits.count_documents({})
    total_postnatal = await db.postnatal_visits.count_documents({})
    total_vaccinations = await db.vaccinations.count_documents({})
    total_mpdsr = await db.mpdsr_reports.count_documents({})
    maternal_deaths = await db.mpdsr_reports.count_documents({"death_type": "maternelle"})
    neonatal_deaths = await db.mpdsr_reports.count_documents({"death_type": "neonatale"})

    # CPN coverage: ratio of pregnancies with at least 4 CPN visits
    pregnancies = await db.pregnancies.find({}, {"id": 1, "_id": 0}).to_list(10000)
    cpn4plus = 0
    for preg in pregnancies:
        c = await db.cpn_visits.count_documents({"pregnancy_id": preg["id"]})
        if c >= 4:
            cpn4plus += 1
    cpn4_coverage = (cpn4plus / total_pregnancies * 100) if total_pregnancies else 0

    # By zone
    zones = await db.zones.find({}, {"_id": 0}).to_list(100)
    by_zone = []
    for z in zones:
        p = await db.patients.count_documents({"zone_id": z["id"]})
        preg = await db.pregnancies.count_documents({"patient_id": {"$in": [pp["id"] async for pp in db.patients.find({"zone_id": z["id"]}, {"id": 1})]}})
        by_zone.append({"zone": z["name"], "patients": p, "pregnancies": preg})

    # Complications top
    pipeline = [{"$unwind": "$complications"}, {"$group": {"_id": "$complications", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 8}]
    top_complications = []
    async for r in db.cpn_visits.aggregate(pipeline):
        top_complications.append({"name": r["_id"], "count": r["count"]})

    return {
        "totals": {
            "patients": total_patients,
            "pregnancies": total_pregnancies,
            "active_pregnancies": active_pregnancies,
            "cpn_visits": total_cpn,
            "postnatal_visits": total_postnatal,
            "vaccinations": total_vaccinations,
            "mpdsr_reports": total_mpdsr,
            "maternal_deaths": maternal_deaths,
            "neonatal_deaths": neonatal_deaths,
        },
        "cpn4_coverage_percent": round(cpn4_coverage, 1),
        "by_zone": by_zone,
        "top_complications": top_complications,
    }


# ============================================================
# ADMIN KPIs (Brique 5) — UNFPA-aligned high-level indicators
# ============================================================
# UNFPA / OMS targets are defined in `analytics.UNFPA_TARGETS`
#   - CPN4 coverage ≥ 75%
#   - Skilled / assisted birth ≥ 85%
#   - Anaemia in pregnancy ≤ 20%
#   - MPDSR audited within 30 days ≥ 95%


@api.get("/admin/kpis")
async def admin_kpis(
    zone_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_role("admin")),
):
    """Return the 4 UNFPA-aligned KPIs with their UNFPA target and on/off-track status.

    Filters:
      - zone_id: limit aggregation to a single zone sanitaire
      - date_from / date_to: ISO date range (YYYY-MM-DD) on visit/death dates
    """
    # Scope filtering (zone-aware)
    patient_ids = await _patient_ids_in_zone(zone_id) if zone_id else None
    pregnancy_ids = await _pregnancy_ids_for_patients(patient_ids) if patient_ids is not None else None

    # Date range
    dq: dict = {}
    if date_from:
        dq["$gte"] = date_from
    if date_to:
        dq["$lte"] = date_to

    preg_q: dict = {}
    cpn_q: dict = {}
    pn_q: dict = {"stage": "6h"}
    mpdsr_q: dict = {}
    if patient_ids is not None:
        preg_q["patient_id"] = {"$in": patient_ids}
        mpdsr_q["patient_id"] = {"$in": patient_ids}
    if pregnancy_ids is not None:
        cpn_q["pregnancy_id"] = {"$in": pregnancy_ids}
        pn_q["pregnancy_id"] = {"$in": pregnancy_ids}
    if dq:
        cpn_q["visit_date"] = dq
        pn_q["visit_date"] = dq
        mpdsr_q["death_date"] = dq

    total_pregnancies = await db.pregnancies.count_documents(preg_q)

    # KPI 1 — CPN4 rate
    pipeline_cpn4 = [
        {"$match": cpn_q} if cpn_q else {"$match": {}},
        {"$group": {"_id": "$pregnancy_id", "n": {"$sum": 1}}},
        {"$match": {"n": {"$gte": 4}}},
        {"$count": "total"},
    ]
    cpn4_doc = await db.cpn_visits.aggregate(pipeline_cpn4).to_list(1)
    cpn4 = cpn4_doc[0]["total"] if cpn4_doc else 0

    # KPI 2 — Assisted birth rate (proxy = postnatal visit at 6h means delivery was followed in-facility)
    assisted_births = await db.postnatal_visits.count_documents(pn_q)

    # KPI 3 — Anaemia rate (Hb < 11) over screened CPNs
    anemia_screened = await db.cpn_visits.count_documents({**cpn_q, "hemoglobin": {"$ne": None, "$gt": 0}})
    anemia_cases = await db.cpn_visits.count_documents({**cpn_q, "hemoglobin": {"$lt": 11, "$gt": 0}})

    # KPI 4 — MPDSR audit < 30 days
    total_deaths = await db.mpdsr_reports.count_documents(mpdsr_q)
    audited_in_30d = 0
    async for r in db.mpdsr_reports.find(
        {**mpdsr_q, "audit_status": "audite_en_comite", "audit_date": {"$ne": None}},
        {"_id": 0, "death_date": 1, "audit_date": 1},
    ):
        try:
            dd = datetime.fromisoformat(r["death_date"])
            ad = datetime.fromisoformat(r["audit_date"])
            if (ad - dd).days <= 30:
                audited_in_30d += 1
        except Exception:
            continue

    def rate(num, den):
        return round((num / den * 100) if den else 0.0, 1)

    cpn4_rate = rate(cpn4, total_pregnancies)
    assisted_birth_rate = rate(assisted_births, total_pregnancies)
    anemia_rate = rate(anemia_cases, anemia_screened)
    death_audit_rate = rate(audited_in_30d, total_deaths)

    kpis = [
        {
            "code": "cpn4_rate",
            "label": "Taux CPN4+",
            "description": "Grossesses avec au moins 4 consultations prénatales",
            "value": cpn4_rate,
            "unit": "%",
            "numerator": cpn4,
            "denominator": total_pregnancies,
            "target": UNFPA_TARGETS["cpn4_rate"],
            "target_direction": "higher",
            "on_track": cpn4_rate >= UNFPA_TARGETS["cpn4_rate"],
        },
        {
            "code": "assisted_birth_rate",
            "label": "Accouchement assisté",
            "description": "Naissances suivies d'une visite postnatale 6h en structure",
            "value": assisted_birth_rate,
            "unit": "%",
            "numerator": assisted_births,
            "denominator": total_pregnancies,
            "target": UNFPA_TARGETS["assisted_birth_rate"],
            "target_direction": "higher",
            "on_track": assisted_birth_rate >= UNFPA_TARGETS["assisted_birth_rate"],
        },
        {
            "code": "anemia_rate",
            "label": "Taux d'anémie",
            "description": "Femmes enceintes dépistées avec Hb < 11 g/dL",
            "value": anemia_rate,
            "unit": "%",
            "numerator": anemia_cases,
            "denominator": anemia_screened,
            "target": UNFPA_TARGETS["anemia_rate"],
            "target_direction": "lower",
            "on_track": anemia_rate <= UNFPA_TARGETS["anemia_rate"],
        },
        {
            "code": "death_audit_rate",
            "label": "Audit décès < 30j",
            "description": "Décès maternels et néonatals audités en comité MPDSR sous 30 jours",
            "value": death_audit_rate,
            "unit": "%",
            "numerator": audited_in_30d,
            "denominator": total_deaths,
            "target": UNFPA_TARGETS["death_audit_rate"],
            "target_direction": "higher",
            "on_track": death_audit_rate >= UNFPA_TARGETS["death_audit_rate"],
        },
    ]

    return {
        "scope": {"zone_id": zone_id, "date_from": date_from, "date_to": date_to},
        "totals": {
            "pregnancies": total_pregnancies,
            "deaths": total_deaths,
            "anemia_screened": anemia_screened,
        },
        "kpis": kpis,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================
# DHIS2 / MSP Indicators
# ============================================================
# Thin db-bound wrappers — delegate to analytics module
async def _patient_ids_in_zone(zone_id: Optional[str]):
    return await patient_ids_in_zone(db, zone_id)


async def _pregnancy_ids_for_patients(patient_ids):
    return await pregnancy_ids_for_patients(db, patient_ids)


async def _resolve_dhis2_org_unit(zone_id: Optional[str], default: str = "NATIONAL") -> str:
    return await resolve_dhis2_org_unit(db, zone_id, default)


async def _compute_dhis2_indicators(zone_id: Optional[str], date_from: Optional[str], date_to: Optional[str]) -> dict:
    return await compute_dhis2_indicators(db, zone_id, date_from, date_to)



@api.get("/analytics/dhis2-indicators")
async def dhis2_indicators(
    zone_id: Optional[str] = None,
    period: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_role("admin")),
):
    # period (YYYYMM, DHIS2 standard) overrides date_from / date_to
    if period:
        if len(period) != 6 or not period.isdigit():
            raise HTTPException(400, "Format période invalide. Utiliser YYYYMM (ex: 202610)")
        year = int(period[:4])
        month = int(period[4:])
        if month < 1 or month > 12:
            raise HTTPException(400, "Mois invalide dans la période")
        first = datetime(year, month, 1).date().isoformat()
        if month == 12:
            last = datetime(year + 1, 1, 1).date()
        else:
            last = datetime(year, month + 1, 1).date()
        last = (last - timedelta(days=1)).isoformat()
        date_from, date_to = first, last
    values = await _compute_dhis2_indicators(zone_id, date_from, date_to)
    rows = []
    for d in DHIS2_INDICATOR_DEFS:
        rows.append({**d, "value": values.get(d["code"], 0)})
    zones = await db.zones.find({}, {"_id": 0}).to_list(100)
    zone_label = "Toutes zones"
    if zone_id:
        z = await db.zones.find_one({"id": zone_id}, {"_id": 0})
        zone_label = z["name"] if z else zone_id
    return {
        "filters": {
            "zone_id": zone_id,
            "zone_label": zone_label,
            "period": period,
            "date_from": date_from,
            "date_to": date_to,
        },
        "indicators": rows,
        "zones": zones,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@api.get("/analytics/dhis2-export")
async def dhis2_export_json(
    period: str,
    zone_id: Optional[str] = None,
    user=Depends(require_role("admin")),
):
    """Returns DHIS2 DataValueSet JSON payload ready to be POSTed to DHIS2."""
    if len(period) != 6:
        raise HTTPException(400, "Format période invalide. Utiliser YYYYMM (ex: 202610)")
    try:
        year = int(period[:4])
        month = int(period[4:])
    except ValueError:
        raise HTTPException(400, "Période non numérique")
    first = datetime(year, month, 1).date().isoformat()
    if month == 12:
        last = datetime(year + 1, 1, 1).date()
    else:
        last = datetime(year, month + 1, 1).date()
    last = (last - timedelta(days=1)).isoformat()

    values = await _compute_dhis2_indicators(zone_id, first, last)
    org_unit = await _resolve_dhis2_org_unit(zone_id, "NATIONAL")
    payload = {
        "dataSet": "KHALABA_MNCH_MONTHLY",
        "period": period,
        "orgUnit": org_unit,
        "attributeOptionCombo": "default",
        "dataValues": [
            {"dataElement": d["code"], "value": str(values.get(d["code"], 0))}
            for d in DHIS2_INDICATOR_DEFS
        ],
        "completeDate": datetime.now(timezone.utc).date().isoformat(),
    }
    # Audit log
    await db.audit_logs.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "user_email": user["email"],
        "action": "EXPORT_DHIS2",
        "entity": "Report",
        "entity_id": period,
        "zone_id": zone_id,
        "values_summary": {dv["dataElement"]: dv["value"] for dv in payload["dataValues"]},
        "created_at": now_iso(),
    })
    return payload


@api.get("/audit-logs")
async def list_audit_logs(
    limit: int = 100,
    action: Optional[str] = None,
    entity: Optional[str] = None,
    user_id: Optional[str] = None,
    user=Depends(require_role("admin")),
):
    q: dict = {}
    if action:
        q["action"] = action
    if entity:
        q["entity"] = entity
    if user_id:
        q["user_id"] = user_id
    return await db.audit_logs.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)


@api.get("/audit-logs/summary")
async def audit_logs_summary(user=Depends(require_role("admin"))):
    """Aggregated audit log counts by action and entity."""
    by_action = []
    async for r in db.audit_logs.aggregate([
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 25},
    ]):
        by_action.append({"action": r["_id"], "count": r["count"]})
    by_entity = []
    async for r in db.audit_logs.aggregate([
        {"$group": {"_id": "$entity", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 25},
    ]):
        by_entity.append({"entity": r["_id"], "count": r["count"]})
    total = await db.audit_logs.count_documents({})
    return {"total": total, "by_action": by_action, "by_entity": by_entity}


@api.get("/audit-logs/export.csv")
async def export_audit_logs_csv(
    action: Optional[str] = None,
    entity: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 5000,
    user=Depends(require_role("admin")),
):
    """Brique 13 — CSV export of audit logs for MSP inspections."""
    q: dict = {}
    if action:
        q["action"] = action
    if entity:
        q["entity"] = entity
    if user_id:
        q["user_id"] = user_id
    rows = await db.audit_logs.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)

    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["created_at", "user_email", "user_role", "action", "entity", "entity_id"])
    for r in rows:
        w.writerow([
            r.get("created_at", ""),
            r.get("user_email", ""),
            r.get("user_role", ""),
            r.get("action", ""),
            r.get("entity", ""),
            r.get("entity_id", ""),
        ])
    # Audit the export itself (meta)
    await audit(user, "EXPORT_AUDIT_LOGS", "AuditLog",
                extra={"rows": len(rows), "filters": {k: v for k, v in q.items()}})
    today = datetime.now(timezone.utc).date().isoformat()
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="audit_logs_{today}.csv"'},
    )


@api.get("/reports/district")
async def district_monthly_report(
    month: int,
    year: int,
    zone_id: Optional[str] = None,
    user=Depends(require_role("admin")),
):
    if month < 1 or month > 12:
        raise HTTPException(400, "Mois invalide (1-12)")
    first = datetime(year, month, 1).date().isoformat()
    last_dt = datetime(year + 1, 1, 1).date() if month == 12 else datetime(year, month + 1, 1).date()
    last = (last_dt - timedelta(days=1)).isoformat()

    patient_ids = await _patient_ids_in_zone(zone_id) if zone_id else None
    cpn_q: dict = {"visit_date": {"$gte": first, "$lte": last}}
    preg_q: dict = {"created_at": {"$gte": first, "$lte": last + "T23:59:59"}}
    pn_q: dict = {"visit_date": {"$gte": first, "$lte": last}, "stage": "6h"}
    mpdsr_q: dict = {"death_date": {"$gte": first, "$lte": last}}
    if patient_ids is not None:
        preg_q["patient_id"] = {"$in": patient_ids}
        preg_ids_zone = await _pregnancy_ids_for_patients(patient_ids)
        cpn_q["pregnancy_id"] = {"$in": preg_ids_zone}
        pn_q["pregnancy_id"] = {"$in": preg_ids_zone}
        mpdsr_q["patient_id"] = {"$in": patient_ids}

    total_pregnancies = await db.pregnancies.count_documents(preg_q)
    cpn1 = await db.cpn_visits.count_documents({**cpn_q, "visit_number": 1})
    pipeline_cpn4 = [{"$match": cpn_q}, {"$group": {"_id": "$pregnancy_id", "c": {"$sum": 1}}}, {"$match": {"c": {"$gte": 4}}}, {"$count": "n"}]
    cpn4_doc = await db.cpn_visits.aggregate(pipeline_cpn4).to_list(1)
    cpn4 = cpn4_doc[0]["n"] if cpn4_doc else 0
    assisted_births = await db.postnatal_visits.count_documents(pn_q)
    anemia_screened = await db.cpn_visits.count_documents({**cpn_q, "hemoglobin": {"$ne": None, "$gt": 0}})
    anemia_cases = await db.cpn_visits.count_documents({**cpn_q, "hemoglobin": {"$lt": 11, "$gt": 0}})
    hiv_tested = await db.cpn_visits.count_documents({**cpn_q, "hiv_status": {"$in": ["negatif", "positif", "NEG", "POS"]}})
    hiv_positive = await db.cpn_visits.count_documents({**cpn_q, "hiv_status": {"$in": ["positif", "POS"]}})
    syph_tested = await db.cpn_visits.count_documents({**cpn_q, "syphilis_status": {"$in": ["negatif", "positif", "NEG", "POS"]}})
    maternal_deaths = await db.mpdsr_reports.count_documents({**mpdsr_q, "death_type": "maternelle"})
    neonatal_deaths = await db.mpdsr_reports.count_documents({**mpdsr_q, "death_type": {"$in": ["neonatale", "foetal_in_utero"]}})
    audits_completed = await db.mpdsr_reports.count_documents({**mpdsr_q, "audit_status": "audite_en_comite"})
    ltfu_count = await db.pregnancies.count_documents({**(preg_q if patient_ids is not None else {}), "status": "perdue_vue"})

    def rate(num, den):
        return round((num / den * 100) if den else 0, 1)

    return {
        "month": f"{year}-{month:02d}",
        "year": year,
        "month_num": month,
        "zone_id": zone_id,
        "period": {"date_from": first, "date_to": last},
        "indicators": {
            "totalPregnancies": total_pregnancies,
            "cpn1": cpn1,
            "cpn4": cpn4,
            "assistedBirths": assisted_births,
            "anemiaScreened": anemia_screened,
            "anemiaCases": anemia_cases,
            "hivTested": hiv_tested,
            "hivPositive": hiv_positive,
            "syphilisTested": syph_tested,
            "maternalDeaths": maternal_deaths,
            "neonatalDeaths": neonatal_deaths,
            "auditsCompleted": audits_completed,
        },
        "ltfuCount": ltfu_count,
        "coverageRates": {
            "cpn1": rate(cpn1, total_pregnancies),
            "cpn4": rate(cpn4, total_pregnancies),
            "assistedBirth": rate(assisted_births, total_pregnancies),
        },
        "targets": {"cpn1": 90, "cpn4": 80, "assistedBirth": 90, "auditCoverage": 100},
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# Brique 8 — DHIS2 DataValueSet export uses `DHIS2_REPORT_MAPPING` from `analytics`.


@api.get("/reports/dhis2")
async def reports_dhis2_export(
    month: int,
    year: int,
    zone_id: Optional[str] = None,
    user=Depends(require_role("admin")),
):
    """DHIS2 DataValueSet JSON for the district monthly report (Brique 8).
    Mirrors the same indicators displayed on the report grid.
    """
    report = await district_monthly_report(month=month, year=year, zone_id=zone_id, user=user)
    ind = report["indicators"]
    period = f"{year}{str(month).zfill(2)}"
    data_values = []
    for key, (ind_field, data_element) in DHIS2_REPORT_MAPPING.items():
        data_values.append({
            "dataElement": data_element,
            "categoryOptionCombo": "DEFAULT",
            "value": str(ind.get(ind_field, 0)),
        })
    org_unit = await _resolve_dhis2_org_unit(zone_id, "DISTRICT_ORG_UNIT_ID")
    payload = {
        "dataSet": "MATERNAL_HEALTH_MONTHLY",
        "completeDate": datetime.now(timezone.utc).date().isoformat(),
        "period": period,
        "orgUnit": org_unit,
        "attributeOptionCombo": "DEFAULT",
        "dataValues": data_values,
    }
    # Audit trail (same pattern as /analytics/dhis2-export)
    await db.audit_logs.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "user_email": user["email"],
        "action": "EXPORT_DHIS2_REPORT",
        "entity": "Report",
        "entity_id": period,
        "zone_id": zone_id,
        "values_summary": {dv["dataElement"]: dv["value"] for dv in data_values},
        "created_at": now_iso(),
    })
    return payload



@api.get("/analytics/dhis2-indicators/export.csv")
async def dhis2_indicators_csv(
    zone_id: Optional[str] = None,
    period: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_role("admin")),
):
    if period and len(period) == 6:
        year = int(period[:4])
        month = int(period[4:])
        first = datetime(year, month, 1).date().isoformat()
        if month == 12:
            last_dt = datetime(year + 1, 1, 1).date()
        else:
            last_dt = datetime(year, month + 1, 1).date()
        last = (last_dt - timedelta(days=1)).isoformat()
        date_from, date_to = first, last
    values = await _compute_dhis2_indicators(zone_id, date_from, date_to)
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    writer.writerow(["Code DHIS2", "Indicateur", "Catégorie", "Valeur", "Formule", "Zone", "Période_du", "Période_au", "Généré_le"])
    zone_label = "Toutes zones"
    if zone_id:
        z = await db.zones.find_one({"id": zone_id}, {"_id": 0})
        zone_label = z["name"] if z else zone_id
    generated = datetime.now(timezone.utc).isoformat()
    for d in DHIS2_INDICATOR_DEFS:
        writer.writerow([
            d["code"], d["label"], d["category"],
            values.get(d["code"], 0), d["formula"],
            zone_label, date_from or "", date_to or "", generated,
        ])
    csv_text = buf.getvalue()
    filename = f"khalaba_dhis2_{(date_from or 'all')}_{(date_to or 'all')}.csv"
    return PlainTextResponse(
        csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================
# Mount router & middleware
# ============================================================
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    # indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.patients.create_index("id", unique=True)
    await db.patients.create_index("zone_id")
    await db.pregnancies.create_index("id", unique=True)
    await db.pregnancies.create_index("patient_id")
    await db.cpn_visits.create_index("pregnancy_id")
    await db.postnatal_visits.create_index("pregnancy_id")
    await db.children.create_index("pregnancy_id")
    await db.vaccinations.create_index("child_id")
    await db.zones.create_index("id", unique=True)
    await db.structures.create_index("id", unique=True)
    await db.regions.create_index("id", unique=True)
    await db.regions.create_index("name")
    await db.audit_logs.create_index([("created_at", -1)])
    await db.audit_logs.create_index("action")
    await db.audit_logs.create_index("entity")
    await db.audit_logs.create_index("user_id")
    await db.otp_codes.create_index("user_id", unique=True)
    await db.alerts.create_index("pregnancy_id")
    await db.alerts.create_index([("created_at", -1)])
    await db.sync_queue.create_index([("created_at", -1)])
    await db.sync_queue.create_index("synced_at")

    # seed zones
    if await db.zones.count_documents({}) == 0:
        default_zones = [
            {"name": "N'Djamena Centre", "region": "N'Djamena", "country": "Tchad"},
            {"name": "N'Djamena Sud", "region": "N'Djamena", "country": "Tchad"},
            {"name": "Moundou", "region": "Logone Occidental", "country": "Tchad"},
            {"name": "Sarh", "region": "Moyen-Chari", "country": "Tchad"},
            {"name": "Abéché", "region": "Ouaddaï", "country": "Tchad"},
        ]
        for z in default_zones:
            await db.zones.insert_one({"id": new_id(), **z, "created_at": now_iso()})

    # Brique 10 — auto-derive regions from zones (idempotent migration)
    region_by_name: dict = {}
    async for region_doc in db.regions.find({}, {"_id": 0}):
        region_by_name[region_doc["name"]] = region_doc
    async for z in db.zones.find({}, {"_id": 0}):
        name = z.get("region")
        if not name:
            continue
        if name not in region_by_name:
            new_region = {"id": new_id(), "name": name, "country": z.get("country", "Tchad"),
                          "dhis2_org_unit_uid": None, "created_at": now_iso()}
            await db.regions.insert_one(new_region)
            region_by_name[name] = new_region
        # Back-link region_id on zone if missing
        if not z.get("region_id"):
            await db.zones.update_one({"id": z["id"]},
                                       {"$set": {"region_id": region_by_name[name]["id"]}})

    # Brique 12 — denormalise district_id (= zone_id) and region_id on every structure (idempotent)
    zone_region_map: dict = {}
    async for z in db.zones.find({}, {"_id": 0, "id": 1, "region_id": 1}):
        zone_region_map[z["id"]] = z.get("region_id")
    async for stru in db.structures.find(
        {"$or": [{"district_id": {"$exists": False}}, {"district_id": None},
                  {"region_id": {"$exists": False}}, {"region_id": None}]},
        {"_id": 0, "id": 1, "zone_id": 1, "district_id": 1, "region_id": 1},
    ):
        canonical = stru.get("district_id") or stru.get("zone_id")
        update = {"district_id": canonical, "zone_id": canonical,
                  "region_id": zone_region_map.get(canonical)}
        await db.structures.update_one({"id": stru["id"]}, {"$set": update})

    # seed structures
    if await db.structures.count_documents({}) == 0:
        zones = await db.zones.find({}, {"_id": 0}).to_list(50)
        for z in zones:
            await db.structures.insert_one({
                "id": new_id(),
                "name": f"Hôpital Régional de {z['name']}",
                "zone_id": z["id"],
                "type": "hopital",
                "created_at": now_iso(),
            })
            await db.structures.insert_one({
                "id": new_id(),
                "name": f"Centre de Santé Communautaire {z['name']}",
                "zone_id": z["id"],
                "type": "centre_sante",
                "created_at": now_iso(),
            })

    # seed admin user
    admin_email = os.environ["ADMIN_EMAIL"]
    admin_pass = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(),
            "email": admin_email,
            "password_hash": hash_password(admin_pass),
            "name": "Administrateur KHALABA",
            "role": "admin",
            "phone": None,
            "zone_id": None,
            "structure_id": None,
            "profession": None,
            "created_at": now_iso(),
        })
    elif not verify_password(admin_pass, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pass)}})

    # seed demo soignant
    soignant_email = os.environ.get("SOIGNANT_DEMO_EMAIL")
    if soignant_email:
        z = await db.zones.find_one({"name": "N'Djamena Centre"}, {"_id": 0})
        s = await db.structures.find_one({"zone_id": z["id"]}, {"_id": 0}) if z else None
        if not await db.users.find_one({"email": soignant_email}):
            await db.users.insert_one({
                "id": new_id(),
                "email": soignant_email,
                "password_hash": hash_password(os.environ["SOIGNANT_DEMO_PASSWORD"]),
                "name": "Dr. Fatimé Hassan",
                "role": "soignant",
                "phone": "+235 60 00 00 01",
                "zone_id": z["id"] if z else None,
                "structure_id": s["id"] if s else None,
                "profession": "Sage-femme",
                "created_at": now_iso(),
            })

    # seed demo patient
    patient_email = os.environ.get("PATIENT_DEMO_EMAIL")
    if patient_email and not await db.users.find_one({"email": patient_email}):
        z = await db.zones.find_one({"name": "N'Djamena Centre"}, {"_id": 0})
        user_id = new_id()
        await db.users.insert_one({
            "id": user_id,
            "email": patient_email,
            "password_hash": hash_password(os.environ["PATIENT_DEMO_PASSWORD"]),
            "name": "Aïcha Mahamat",
            "role": "patient",
            "phone": "+235 66 00 00 02",
            "zone_id": z["id"] if z else None,
            "structure_id": None,
            "profession": None,
            "created_at": now_iso(),
        })
        await db.patients.insert_one({
            "id": new_id(),
            "user_id": user_id,
            "full_name": "Aïcha Mahamat",
            "dob": "1998-04-12",
            "phone": "+235 66 00 00 02",
            "address": "Quartier Chagoua, N'Djamena",
            "zone_id": z["id"] if z else None,
            "structure_id": None,
            "blood_group": "O+",
            "emergency_contact": "+235 66 11 22 33",
            "created_at": now_iso(),
        })

    logger.info("KHALABA backend started — admin seeded.")

    # Brique 7 — daily LTFU scan at 07:00 (Africa/Ndjamena ~ UTC+1, run UTC)
    async def _ltfu_job():
        try:
            res = await run_ltfu_scan()
            new_cases = [f for f in res if not f["already_flagged"]]
            logger.info("LTFU daily scan: %d flagged (%d new)", len(res), len(new_cases))
        except Exception as e:
            logger.exception("LTFU scan failed: %s", e)

    if not scheduler.running:
        scheduler.add_job(_ltfu_job, "cron", hour=7, minute=0, id="ltfu_daily_scan", replace_existing=True)
        scheduler.start()
        logger.info("APScheduler started: ltfu_daily_scan @ 07:00 UTC")


@app.on_event("shutdown")
async def shutdown():
    if scheduler.running:
        scheduler.shutdown(wait=False)
    client.close()
