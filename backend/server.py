"""KHALABA backend API server."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("khalaba")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="KHALABA API")
api = APIRouter(prefix="/api")


async def current_user(request: Request):
    return await get_current_user(request, db)


def require_role(*roles):
    async def dep(user=Depends(current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Accès interdit pour ce rôle")
        return user
    return dep


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
# ZONES & STRUCTURES
# ============================================================
@api.get("/zones")
async def list_zones():
    zones = await db.zones.find({}, {"_id": 0}).to_list(500)
    return zones


@api.post("/zones")
async def create_zone(payload: ZoneIn, user=Depends(require_role("admin"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso()}
    await db.zones.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api.get("/structures")
async def list_structures(zone_id: Optional[str] = None):
    q = {}
    if zone_id:
        q["zone_id"] = zone_id
    return await db.structures.find(q, {"_id": 0}).to_list(500)


@api.post("/structures")
async def create_structure(payload: StructureIn, user=Depends(require_role("admin"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso()}
    await db.structures.insert_one(doc)
    doc.pop('_id', None)
    return doc


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
    await db.patients.insert_one(doc)
    doc.pop('_id', None)
    return doc


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
        "status": "active",
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    await db.pregnancies.insert_one(doc)
    doc.pop('_id', None)
    return doc


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
# CPN VISITS
# ============================================================
@api.post("/cpn-visits")
async def create_cpn(payload: CPNVisitIn, user=Depends(require_role("soignant", "admin"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso(), "created_by": user["id"]}
    # Alert flags
    alerts = []
    if payload.bp_systolic and payload.bp_systolic >= 140:
        alerts.append("Hypertension")
    if payload.bp_diastolic and payload.bp_diastolic >= 90:
        alerts.append("Hypertension diastolique")
    if payload.hemoglobin is not None and payload.hemoglobin < 7:
        alerts.append("Anémie sévère")
    elif payload.hemoglobin is not None and payload.hemoglobin < 11:
        alerts.append("Anémie")
    if payload.proteinuria and payload.proteinuria in ("++", "+++"):
        alerts.append("Protéinurie élevée")
    doc["alerts"] = alerts
    await db.cpn_visits.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api.get("/cpn-visits")
async def list_cpn(pregnancy_id: str, user=Depends(current_user)):
    return await db.cpn_visits.find({"pregnancy_id": pregnancy_id}, {"_id": 0}).sort("visit_number", 1).to_list(50)


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
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso(), "created_by": user["id"]}
    await db.mpdsr_reports.insert_one(doc)
    doc.pop('_id', None)
    return doc


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


# ============================================================
# ANALYTICS (Admin)
# ============================================================
@api.get("/analytics/overview")
async def analytics_overview(user=Depends(require_role("admin"))):
    total_patients = await db.patients.count_documents({})
    total_pregnancies = await db.pregnancies.count_documents({})
    active_pregnancies = await db.pregnancies.count_documents({"status": "active"})
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
    await db.otp_codes.create_index("user_id", unique=True)

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


@app.on_event("shutdown")
async def shutdown():
    client.close()
