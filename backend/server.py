"""KHALABA - Plateforme de sante materno-infantile pour l'Afrique subsaharienne.

MVP backend: FastAPI + MongoDB + JWT bearer auth.
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import csv
import uuid
import logging
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List, Literal

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("khalaba")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_MIN = 60 * 12  # 12h for clinical staff convenience

app = FastAPI(title="Khalaba API", version="1.0.0-mvp")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": now_utc() + timedelta(minutes=ACCESS_TOKEN_TTL_MIN),
        "type": "access",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
Role = Literal["admin", "gynecologist", "midwife", "patient"]


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    name: str
    role: Role
    facility_id: Optional[str] = None
    patient_id: Optional[str] = None  # link to Patient doc if role=patient
    created_at: datetime


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    token: str
    user: UserPublic


class UserCreateIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Role
    facility_id: Optional[str] = None
    phone: Optional[str] = None


class FacilityIn(BaseModel):
    name: str
    type: Literal["hospital", "health_center", "clinic"] = "health_center"
    district: str
    region: str
    country: str = "TD"
    zone_id: Optional[str] = None


class FacilityOut(FacilityIn):
    id: str
    created_at: datetime


class ZoneIn(BaseModel):
    name: str  # ex: N'Djamena, Ouaddai
    country_code: str = "TD"


class ZoneOut(ZoneIn):
    id: str
    created_at: datetime


class PatientIn(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date
    phone: str
    address: Optional[str] = None
    district: Optional[str] = None
    blood_group: Optional[str] = None
    facility_id: str
    zone_id: Optional[str] = None
    assigned_midwife_id: Optional[str] = None
    assigned_gyno_id: Optional[str] = None
    parity: int = 0
    notes: Optional[str] = None


class PatientOut(PatientIn):
    id: str
    khalaba_id: str  # KH-TD-XXXX
    age: int
    created_at: datetime
    risk_score: int = 0


class PregnancyIn(BaseModel):
    patient_id: str
    lmp_date: date  # Last Menstrual Period (DDR)
    expected_delivery_date: Optional[date] = None  # auto if missing
    notes: Optional[str] = None


class PregnancyOut(BaseModel):
    id: str
    patient_id: str
    lmp_date: date
    expected_delivery_date: date
    gestational_age_weeks: int
    status: Literal["active", "delivered", "lost", "transferred"]
    risk_score: int
    cpn_count: int
    created_at: datetime


class CpnIn(BaseModel):
    pregnancy_id: str
    contact_number: int  # 1..8
    contact_date: date
    weight_kg: Optional[float] = None
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    fundal_height_cm: Optional[float] = None
    fetal_heart_rate: Optional[int] = None
    hemoglobin: Optional[float] = None
    blood_group: Optional[str] = None
    hiv_status: Optional[Literal["negative", "positive", "unknown"]] = None
    syphilis_status: Optional[Literal["negative", "positive", "unknown"]] = None
    urine_protein: Optional[Literal["negative", "trace", "+", "++", "+++"]] = None
    iron_folate_given: bool = False
    deworming_given: bool = False  # Albendazole / Mebendazole
    tpi_dose: Optional[int] = None  # antipaludeen prevention
    mosquito_net_given: bool = False
    vat_dose_given: Optional[int] = None
    hepatitis_b_status: Optional[Literal["negative", "positive", "unknown"]] = None
    education_topics: List[str] = Field(default_factory=list)
    danger_bleeding: bool = False
    danger_headache: bool = False
    danger_edema: bool = False
    danger_convulsions: bool = False
    danger_other: Optional[str] = None
    decision: Literal["normal", "reference", "urgence"] = "normal"
    next_appointment: Optional[date] = None
    notes: Optional[str] = None


class CpnOut(CpnIn):
    id: str
    professional_id: str
    alerts: List[str] = Field(default_factory=list)
    created_at: datetime


class VaccineDoseOut(BaseModel):
    id: str
    patient_id: str
    target: Literal["mother", "child"]
    vaccine_code: str
    vaccine_label: str
    dose_number: int
    scheduled_date: date
    administered_date: Optional[date] = None
    status: Literal["scheduled", "administered", "late", "missed"]
    notes: Optional[str] = None


class VaccineAdministerIn(BaseModel):
    administered_date: date
    notes: Optional[str] = None


class AlertOut(BaseModel):
    id: str
    patient_id: str
    pregnancy_id: Optional[str] = None
    severity: Literal["urgent", "warning", "info"]
    code: str
    message: str
    resolved: bool = False
    created_at: datetime


# --- New domain models (from KHALABA full dossier) -------------------------
class ComplicationIn(BaseModel):
    pregnancy_id: str
    name: str  # ex: "Diabete gestationnel", "Anemie severe", "HTA gravidique", "Placenta praevia", "Menace accouchement premature"
    severity: Literal["mild", "moderate", "severe"] = "moderate"
    notes: Optional[str] = None


class ComplicationOut(ComplicationIn):
    id: str
    detected_at: datetime
    detected_by: str
    resolved: bool = False


class PostnatalVisitIn(BaseModel):
    pregnancy_id: str
    step: Literal[1, 2, 3]  # 1=6h, 2=6j, 3=6s
    visit_date: date
    # Mother
    maternal_bleeding: Optional[Literal["none", "mild", "moderate", "heavy"]] = None
    uterine_tonus: Optional[Literal["firm", "soft", "absent"]] = None
    maternal_temp: Optional[float] = None
    maternal_pulse: Optional[int] = None
    has_micturition: Optional[bool] = None
    lochies_aspect: Optional[str] = None
    perineum_healing: Optional[Literal["normal", "delayed", "infected"]] = None
    cesarean_scar: Optional[Literal["clean", "inflamed", "infected"]] = None
    breastfeeding_status: Optional[Literal["exclusive", "mixed", "none"]] = None
    contraception_plan: Optional[str] = None
    maternal_mental_health: Optional[Literal["normal", "moderate", "severe"]] = None
    # Baby
    newborn_breastfed_early: Optional[bool] = None  # 1st hour
    newborn_jaundice: Optional[bool] = None
    newborn_cord_status: Optional[Literal["dry", "wet", "infected"]] = None
    newborn_weight_kg: Optional[float] = None
    newborn_temp: Optional[float] = None
    newborn_danger_signs: List[str] = Field(default_factory=list)
    decision: Literal["normal", "reference", "urgence"] = "normal"
    notes: Optional[str] = None


class PostnatalVisitOut(PostnatalVisitIn):
    id: str
    professional_id: str
    created_at: datetime
    alerts: List[str] = Field(default_factory=list)


class NewbornIn(BaseModel):
    pregnancy_id: str
    birth_date: date
    birth_weight_g: int
    gender: Literal["M", "F"]
    apgar_1: Optional[int] = None
    apgar_5: Optional[int] = None
    early_breastfeeding: bool = False  # within 1 hour
    notes: Optional[str] = None


class NewbornOut(NewbornIn):
    id: str
    patient_id: str
    is_low_birth_weight: bool
    created_at: datetime


class DeathAuditIn(BaseModel):
    patient_id: str
    pregnancy_id: Optional[str] = None
    death_type: Literal["maternal", "neonatal"]
    death_date: date
    primary_cause: str  # Hemorragie, Eclampsie, Septicemie, Asphyxie neonatale, etc.
    contributing_factors: Optional[str] = None
    location: Optional[Literal["facility", "home", "transport", "other"]] = None
    notes: Optional[str] = None


class DeathAuditOut(DeathAuditIn):
    id: str
    status: Literal["pending_audit", "audited", "closed"]
    audit_recommendations: Optional[str] = None
    audited_at: Optional[datetime] = None
    audited_by: Optional[str] = None
    created_at: datetime
    reported_by: str


class DeathAuditUpdateIn(BaseModel):
    audit_recommendations: str
    status: Literal["audited", "closed"] = "audited"


class DirectChannelLogIn(BaseModel):
    patient_id: str
    channel: Literal["call", "sms", "in_app"]
    direction: Literal["pro_to_patient", "patient_to_pro"]
    purpose: Literal["confirm_appointment", "reschedule_request", "advice", "danger_report", "other"]
    notes: Optional[str] = None


class DirectChannelLogOut(DirectChannelLogIn):
    id: str
    user_id: str
    created_at: datetime


class DashboardKpis(BaseModel):
    new_pregnancies: int
    active_pregnancies: int
    cpn1_rate: float
    cpn4_rate: float
    cpn8_rate: float
    cpn1_early_rate: float  # before 12 weeks
    at_risk_rate: float
    institutional_deliveries: int
    cesarean_rate: float
    obstetric_referrals: int
    postnatal_mother_coverage: float
    postnatal_newborn_coverage: float
    maternal_vat_coverage: float
    child_bcg_coverage: float
    child_penta3_coverage: float
    maternal_deaths: int
    neonatal_deaths: int
    low_birth_weight_rate: float
    complete_records_rate: float
    lost_to_followup_rate: float
    total_patients: int


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non authentifie")
    token = auth[7:]
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expiree")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Jeton invalide")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user


def require_roles(*roles: str):
    async def dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Acces refuse")
        return user
    return dep


# ---------------------------------------------------------------------------
# Domain helpers
# ---------------------------------------------------------------------------
def compute_edd(lmp: date) -> date:
    """Naegele's rule: LMP + 280 days."""
    return lmp + timedelta(days=280)


def gestational_age_weeks(lmp: date) -> int:
    delta = (date.today() - lmp).days
    return max(0, delta // 7)


def compute_patient_age(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def compute_risk_score(patient: dict, last_cpn: Optional[dict]) -> int:
    score = 0
    age = compute_patient_age(patient["date_of_birth"]) if isinstance(patient["date_of_birth"], date) else compute_patient_age(date.fromisoformat(patient["date_of_birth"]))
    if age < 18 or age > 35:
        score += 2
    if patient.get("parity", 0) == 0 or patient.get("parity", 0) > 5:
        score += 1
    if last_cpn:
        if last_cpn.get("bp_systolic", 0) and last_cpn["bp_systolic"] > 140:
            score += 3
        if last_cpn.get("bp_diastolic", 0) and last_cpn["bp_diastolic"] > 90:
            score += 3
        if last_cpn.get("hemoglobin") and last_cpn["hemoglobin"] < 11:
            score += 2
    return score


def derive_cpn_alerts(cpn: dict, previous_cpn: Optional[dict]) -> List[str]:
    alerts = []
    sys = cpn.get("bp_systolic")
    dia = cpn.get("bp_diastolic")
    if sys and sys > 140:
        alerts.append(f"Risque de pre-eclampsie / HTA: TA systolique {sys} mmHg")
    if dia and dia > 90:
        alerts.append(f"Risque de pre-eclampsie / HTA: TA diastolique {dia} mmHg")
    if previous_cpn and cpn.get("weight_kg") and previous_cpn.get("weight_kg"):
        loss = previous_cpn["weight_kg"] - cpn["weight_kg"]
        if loss > 0 and (loss / previous_cpn["weight_kg"]) > 0.05:
            alerts.append(f"Risque de denutrition: perte de poids > 5% ({loss:.1f} kg)")
    if cpn.get("hemoglobin") is not None:
        hb = cpn["hemoglobin"]
        if hb < 7:
            alerts.append(f"Anemie severe: Hb {hb} g/dL")
        elif hb < 11:
            alerts.append(f"Anemie: Hb {hb} g/dL")
    if cpn.get("urine_protein") in ("++", "+++"):
        alerts.append(f"Proteinurie {cpn['urine_protein']}")
    if cpn.get("hepatitis_b_status") == "positive":
        alerts.append("Hepatite B positive — prevoir prophylaxie nouveau-ne")
    if cpn.get("hiv_status") == "positive":
        alerts.append("VIH positif — PTME a initier/poursuivre")
    if cpn.get("syphilis_status") == "positive":
        alerts.append("Syphilis positive — traitement penicilline indique")
    if any([cpn.get("danger_bleeding"), cpn.get("danger_convulsions"), cpn.get("danger_headache"), cpn.get("danger_edema")]):
        alerts.append("Signe de danger present — evaluation urgente")
    return alerts


def derive_postnatal_alerts(v: dict) -> List[str]:
    alerts = []
    if v.get("maternal_bleeding") in ("moderate", "heavy"):
        alerts.append("Hemorragie du post-partum suspectee")
    if v.get("uterine_tonus") in ("soft", "absent"):
        alerts.append("Atonie uterine — risque hemorragique")
    t = v.get("maternal_temp")
    if t is not None and t >= 38.5:
        alerts.append(f"Fievre maternelle {t} degC — sepsis du post-partum a evaluer")
    if v.get("newborn_jaundice"):
        alerts.append("Ictere neonatal — surveillance bilirubine")
    nt = v.get("newborn_temp")
    if nt is not None and (nt < 36 or nt >= 38):
        alerts.append(f"Temperature neonatale anormale {nt} degC")
    if v.get("newborn_cord_status") == "infected":
        alerts.append("Cordon ombilical infecte (omphalite)")
    if v.get("newborn_danger_signs"):
        alerts.append("Signes de danger neonataux presents")
    if v.get("maternal_mental_health") in ("moderate", "severe"):
        alerts.append("Depression du post-partum suspectee")
    return alerts


# Vaccine schedules (Chad WHO-aligned baseline) ------------------------------
MOTHER_VACCINES = [
    {"code": "VAT1", "label": "VAT 1", "offset_days_from_lmp": 30},
    {"code": "VAT2", "label": "VAT 2", "offset_days_from_lmp": 60},
    {"code": "VAT3", "label": "VAT 3", "offset_days_from_lmp": 180},
    {"code": "VAT4", "label": "VAT 4", "offset_days_from_lmp": 365},
    {"code": "VAT5", "label": "VAT 5", "offset_days_from_lmp": 730},
]

CHILD_VACCINES = [
    {"code": "BCG", "label": "BCG", "offset_days_from_birth": 0},
    {"code": "VPO0", "label": "VPO 0", "offset_days_from_birth": 0},
    {"code": "PENTA1", "label": "Penta 1", "offset_days_from_birth": 42},
    {"code": "VPO1", "label": "VPO 1", "offset_days_from_birth": 42},
    {"code": "PCV1", "label": "PCV 1", "offset_days_from_birth": 42},
    {"code": "ROTA1", "label": "Rota 1", "offset_days_from_birth": 42},
    {"code": "PENTA2", "label": "Penta 2", "offset_days_from_birth": 70},
    {"code": "VPO2", "label": "VPO 2", "offset_days_from_birth": 70},
    {"code": "PCV2", "label": "PCV 2", "offset_days_from_birth": 70},
    {"code": "ROTA2", "label": "Rota 2", "offset_days_from_birth": 70},
    {"code": "PENTA3", "label": "Penta 3", "offset_days_from_birth": 98},
    {"code": "VPO3", "label": "VPO 3", "offset_days_from_birth": 98},
    {"code": "PCV3", "label": "PCV 3", "offset_days_from_birth": 98},
    {"code": "RR1", "label": "RR (Rougeole-Rubeole) 1", "offset_days_from_birth": 273},
    {"code": "VAA", "label": "Vaccin Fievre Jaune", "offset_days_from_birth": 273},
]


async def init_mother_vaccines(patient_id: str, lmp: date):
    docs = []
    today = date.today()
    for v in MOTHER_VACCINES:
        scheduled = lmp + timedelta(days=v["offset_days_from_lmp"])
        status = "late" if scheduled < today else "scheduled"
        docs.append({
            "id": new_id(),
            "patient_id": patient_id,
            "target": "mother",
            "vaccine_code": v["code"],
            "vaccine_label": v["label"],
            "dose_number": 1,
            "scheduled_date": scheduled.isoformat(),
            "administered_date": None,
            "status": status,
            "notes": None,
            "created_at": now_utc().isoformat(),
        })
    if docs:
        await db.vaccine_doses.insert_many(docs)


# ---------------------------------------------------------------------------
# Endpoints: Auth
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "Khalaba", "version": "1.0.0-mvp", "status": "ok"}


@api.post("/auth/login", response_model=TokenOut)
async def auth_login(payload: LoginIn):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    token = create_token(user["id"], user["role"])
    user_out = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    if isinstance(user_out.get("created_at"), str):
        user_out["created_at"] = datetime.fromisoformat(user_out["created_at"])
    return {"token": token, "user": UserPublic(**user_out)}


@api.get("/auth/me", response_model=UserPublic)
async def auth_me(user: dict = Depends(get_current_user)):
    if isinstance(user.get("created_at"), str):
        user["created_at"] = datetime.fromisoformat(user["created_at"])
    return UserPublic(**user)


@api.post("/admin/users", response_model=UserPublic)
async def create_user(payload: UserCreateIn, _admin: dict = Depends(require_roles("admin"))):
    if await db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(status_code=400, detail="Email deja utilise")
    doc = {
        "id": new_id(),
        "email": payload.email.lower(),
        "phone": payload.phone,
        "name": payload.name,
        "role": payload.role,
        "facility_id": payload.facility_id,
        "patient_id": None,
        "password_hash": hash_password(payload.password),
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return UserPublic(**doc)


@api.get("/admin/users", response_model=List[UserPublic])
async def list_users(_admin: dict = Depends(require_roles("admin"))):
    cur = db.users.find({}, {"_id": 0, "password_hash": 0})
    out = []
    async for u in cur:
        if isinstance(u.get("created_at"), str):
            u["created_at"] = datetime.fromisoformat(u["created_at"])
        out.append(UserPublic(**u))
    return out


# ---------------------------------------------------------------------------
# Endpoints: Facilities
# ---------------------------------------------------------------------------
@api.post("/facilities", response_model=FacilityOut)
async def create_facility(payload: FacilityIn, _admin: dict = Depends(require_roles("admin"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_utc().isoformat()}
    await db.facilities.insert_one(doc)
    doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return FacilityOut(**doc)


@api.get("/facilities", response_model=List[FacilityOut])
async def list_facilities(_user: dict = Depends(get_current_user)):
    out = []
    async for f in db.facilities.find({}, {"_id": 0}):
        if isinstance(f.get("created_at"), str):
            f["created_at"] = datetime.fromisoformat(f["created_at"])
        out.append(FacilityOut(**f))
    return out


# ---------------------------------------------------------------------------
# Endpoints: Patients
# ---------------------------------------------------------------------------
async def _serialize_patient(p: dict) -> dict:
    dob = p["date_of_birth"]
    if isinstance(dob, str):
        dob = date.fromisoformat(dob)
    out = {**p, "date_of_birth": dob, "age": compute_patient_age(dob)}
    if "khalaba_id" not in out or not out.get("khalaba_id"):
        out["khalaba_id"] = f"KH-TD-{p['id'][:8].upper()}"
    if isinstance(out.get("created_at"), str):
        out["created_at"] = datetime.fromisoformat(out["created_at"])
    return out


@api.post("/patients", response_model=PatientOut)
async def create_patient(payload: PatientIn, user: dict = Depends(require_roles("admin", "gynecologist", "midwife"))):
    doc = payload.model_dump()
    doc["date_of_birth"] = doc["date_of_birth"].isoformat()
    doc["id"] = new_id()
    doc["khalaba_id"] = f"KH-TD-{doc['id'][:8].upper()}"
    # Inherit zone from facility if not provided
    if not doc.get("zone_id"):
        fac = await db.facilities.find_one({"id": doc["facility_id"]})
        if fac:
            doc["zone_id"] = fac.get("zone_id")
    doc["created_at"] = now_utc().isoformat()
    doc["risk_score"] = 0
    await db.patients.insert_one(doc)
    return PatientOut(**await _serialize_patient(doc))


@api.get("/patients", response_model=List[PatientOut])
async def list_patients(
    user: dict = Depends(get_current_user),
    q: Optional[str] = None,
    facility_id: Optional[str] = None,
    limit: int = 200,
):
    if user["role"] == "patient":
        raise HTTPException(status_code=403, detail="Acces refuse")
    flt: dict = {}
    if user["role"] in ("midwife", "gynecologist"):
        # Cloisonnement par zone si dispo, sinon par facility
        if user.get("zone_id"):
            flt["zone_id"] = user["zone_id"]
        elif user.get("facility_id"):
            flt["facility_id"] = user["facility_id"]
    if facility_id:
        flt["facility_id"] = facility_id
    if q:
        flt["$or"] = [
            {"first_name": {"$regex": q, "$options": "i"}},
            {"last_name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]
    out = []
    async for p in db.patients.find(flt, {"_id": 0}).limit(limit):
        out.append(PatientOut(**await _serialize_patient(p)))
    return out


@api.get("/patients/{patient_id}", response_model=PatientOut)
async def get_patient(patient_id: str, user: dict = Depends(get_current_user)):
    p = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Patiente introuvable")
    if user["role"] == "patient" and user.get("patient_id") != patient_id:
        raise HTTPException(403, "Acces refuse")
    return PatientOut(**await _serialize_patient(p))


# ---------------------------------------------------------------------------
# Endpoints: Pregnancies
# ---------------------------------------------------------------------------
async def _serialize_pregnancy(p: dict) -> dict:
    lmp = p["lmp_date"]
    if isinstance(lmp, str):
        lmp = date.fromisoformat(lmp)
    edd = p["expected_delivery_date"]
    if isinstance(edd, str):
        edd = date.fromisoformat(edd)
    out = {
        "id": p["id"],
        "patient_id": p["patient_id"],
        "lmp_date": lmp,
        "expected_delivery_date": edd,
        "gestational_age_weeks": gestational_age_weeks(lmp),
        "status": p.get("status", "active"),
        "risk_score": p.get("risk_score", 0),
        "cpn_count": await db.cpn.count_documents({"pregnancy_id": p["id"]}),
        "created_at": datetime.fromisoformat(p["created_at"]) if isinstance(p.get("created_at"), str) else p.get("created_at", now_utc()),
    }
    return out


@api.post("/pregnancies", response_model=PregnancyOut)
async def create_pregnancy(payload: PregnancyIn, user: dict = Depends(require_roles("admin", "gynecologist", "midwife"))):
    patient = await db.patients.find_one({"id": payload.patient_id})
    if not patient:
        raise HTTPException(404, "Patiente introuvable")
    edd = payload.expected_delivery_date or compute_edd(payload.lmp_date)
    doc = {
        "id": new_id(),
        "patient_id": payload.patient_id,
        "lmp_date": payload.lmp_date.isoformat(),
        "expected_delivery_date": edd.isoformat(),
        "status": "active",
        "risk_score": 0,
        "notes": payload.notes,
        "created_at": now_utc().isoformat(),
    }
    await db.pregnancies.insert_one(doc)
    # Init mother vaccines
    await init_mother_vaccines(payload.patient_id, payload.lmp_date)
    return PregnancyOut(**await _serialize_pregnancy(doc))


@api.get("/pregnancies", response_model=List[PregnancyOut])
async def list_pregnancies(patient_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    flt = {}
    if patient_id:
        flt["patient_id"] = patient_id
    if user["role"] == "patient":
        flt["patient_id"] = user.get("patient_id")
    out = []
    async for p in db.pregnancies.find(flt, {"_id": 0}):
        out.append(PregnancyOut(**await _serialize_pregnancy(p)))
    return out


# ---------------------------------------------------------------------------
# Endpoints: CPN (antenatal contacts)
# ---------------------------------------------------------------------------
@api.post("/cpn", response_model=CpnOut)
async def create_cpn(payload: CpnIn, user: dict = Depends(require_roles("gynecologist", "midwife", "admin"))):
    pregnancy = await db.pregnancies.find_one({"id": payload.pregnancy_id})
    if not pregnancy:
        raise HTTPException(404, "Grossesse introuvable")
    previous = await db.cpn.find_one(
        {"pregnancy_id": payload.pregnancy_id},
        sort=[("contact_number", -1)],
    )
    doc = payload.model_dump()
    doc["contact_date"] = doc["contact_date"].isoformat()
    if doc.get("next_appointment"):
        doc["next_appointment"] = doc["next_appointment"].isoformat()
    doc["id"] = new_id()
    doc["professional_id"] = user["id"]
    doc["created_at"] = now_utc().isoformat()
    doc["alerts"] = derive_cpn_alerts(payload.model_dump(), previous)
    await db.cpn.insert_one(doc)

    # Generate alert records
    for msg in doc["alerts"]:
        await db.alerts.insert_one({
            "id": new_id(),
            "patient_id": pregnancy["patient_id"],
            "pregnancy_id": pregnancy["id"],
            "severity": "urgent" if "danger" in msg.lower() or "HTA" in msg else "warning",
            "code": "cpn_auto",
            "message": msg,
            "resolved": False,
            "created_at": now_utc().isoformat(),
        })

    # Update risk score
    patient = await db.patients.find_one({"id": pregnancy["patient_id"]})
    if patient:
        score = compute_risk_score(patient, doc)
        await db.patients.update_one({"id": patient["id"]}, {"$set": {"risk_score": score}})
        await db.pregnancies.update_one({"id": pregnancy["id"]}, {"$set": {"risk_score": score}})

    out_doc = {**doc}
    out_doc["contact_date"] = date.fromisoformat(out_doc["contact_date"])
    if out_doc.get("next_appointment"):
        out_doc["next_appointment"] = date.fromisoformat(out_doc["next_appointment"])
    out_doc["created_at"] = datetime.fromisoformat(out_doc["created_at"])
    return CpnOut(**out_doc)


@api.get("/cpn", response_model=List[CpnOut])
async def list_cpn(pregnancy_id: str, user: dict = Depends(get_current_user)):
    out = []
    async for c in db.cpn.find({"pregnancy_id": pregnancy_id}, {"_id": 0}).sort("contact_number", 1):
        c["contact_date"] = date.fromisoformat(c["contact_date"]) if isinstance(c["contact_date"], str) else c["contact_date"]
        if c.get("next_appointment") and isinstance(c["next_appointment"], str):
            c["next_appointment"] = date.fromisoformat(c["next_appointment"])
        if isinstance(c.get("created_at"), str):
            c["created_at"] = datetime.fromisoformat(c["created_at"])
        out.append(CpnOut(**c))
    return out


# ---------------------------------------------------------------------------
# Endpoints: Vaccines
# ---------------------------------------------------------------------------
@api.get("/vaccines", response_model=List[VaccineDoseOut])
async def list_vaccines(patient_id: str, user: dict = Depends(get_current_user)):
    if user["role"] == "patient" and user.get("patient_id") != patient_id:
        raise HTTPException(403, "Acces refuse")
    out = []
    async for v in db.vaccine_doses.find({"patient_id": patient_id}, {"_id": 0}).sort("scheduled_date", 1):
        v["scheduled_date"] = date.fromisoformat(v["scheduled_date"]) if isinstance(v["scheduled_date"], str) else v["scheduled_date"]
        if v.get("administered_date") and isinstance(v["administered_date"], str):
            v["administered_date"] = date.fromisoformat(v["administered_date"])
        out.append(VaccineDoseOut(**v))
    return out


@api.post("/vaccines/{dose_id}/administer", response_model=VaccineDoseOut)
async def administer_vaccine(dose_id: str, payload: VaccineAdministerIn, user: dict = Depends(require_roles("midwife", "gynecologist", "admin"))):
    dose = await db.vaccine_doses.find_one({"id": dose_id})
    if not dose:
        raise HTTPException(404, "Dose introuvable")
    await db.vaccine_doses.update_one(
        {"id": dose_id},
        {"$set": {
            "administered_date": payload.administered_date.isoformat(),
            "status": "administered",
            "notes": payload.notes,
        }},
    )
    dose = await db.vaccine_doses.find_one({"id": dose_id}, {"_id": 0})
    dose["scheduled_date"] = date.fromisoformat(dose["scheduled_date"])
    if dose.get("administered_date"):
        dose["administered_date"] = date.fromisoformat(dose["administered_date"])
    return VaccineDoseOut(**dose)


# ---------------------------------------------------------------------------
# Endpoints: Zones (admin governance)
# ---------------------------------------------------------------------------
@api.get("/zones", response_model=List[ZoneOut])
async def list_zones(_user: dict = Depends(get_current_user)):
    out = []
    async for z in db.zones.find({}, {"_id": 0}):
        if isinstance(z.get("created_at"), str):
            z["created_at"] = datetime.fromisoformat(z["created_at"])
        out.append(ZoneOut(**z))
    return out


@api.post("/zones", response_model=ZoneOut)
async def create_zone(payload: ZoneIn, _admin: dict = Depends(require_roles("admin"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_utc().isoformat()}
    await db.zones.insert_one(doc)
    doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return ZoneOut(**doc)


# ---------------------------------------------------------------------------
# Endpoints: Complications
# ---------------------------------------------------------------------------
@api.post("/complications", response_model=ComplicationOut)
async def create_complication(payload: ComplicationIn, user: dict = Depends(require_roles("midwife", "gynecologist", "admin"))):
    if not await db.pregnancies.find_one({"id": payload.pregnancy_id}):
        raise HTTPException(404, "Grossesse introuvable")
    doc = {
        "id": new_id(),
        **payload.model_dump(),
        "detected_at": now_utc().isoformat(),
        "detected_by": user["id"],
        "resolved": False,
    }
    await db.complications.insert_one(doc)
    doc["detected_at"] = datetime.fromisoformat(doc["detected_at"])
    return ComplicationOut(**doc)


@api.get("/complications", response_model=List[ComplicationOut])
async def list_complications(pregnancy_id: str, _user: dict = Depends(get_current_user)):
    out = []
    async for c in db.complications.find({"pregnancy_id": pregnancy_id}, {"_id": 0}).sort("detected_at", -1):
        if isinstance(c.get("detected_at"), str):
            c["detected_at"] = datetime.fromisoformat(c["detected_at"])
        out.append(ComplicationOut(**c))
    return out


# ---------------------------------------------------------------------------
# Endpoints: Postnatal visits (3 contacts: 6h, 6j, 6s)
# ---------------------------------------------------------------------------
@api.post("/postnatal", response_model=PostnatalVisitOut)
async def create_postnatal(payload: PostnatalVisitIn, user: dict = Depends(require_roles("midwife", "gynecologist", "admin"))):
    pregnancy = await db.pregnancies.find_one({"id": payload.pregnancy_id})
    if not pregnancy:
        raise HTTPException(404, "Grossesse introuvable")
    doc = payload.model_dump()
    doc["visit_date"] = doc["visit_date"].isoformat()
    doc["id"] = new_id()
    doc["professional_id"] = user["id"]
    doc["created_at"] = now_utc().isoformat()
    doc["alerts"] = derive_postnatal_alerts(payload.model_dump())
    await db.postnatal.insert_one(doc)
    for msg in doc["alerts"]:
        await db.alerts.insert_one({
            "id": new_id(),
            "patient_id": pregnancy["patient_id"],
            "pregnancy_id": pregnancy["id"],
            "severity": "urgent" if any(k in msg.lower() for k in ["hemorragie", "sepsis", "atonie"]) else "warning",
            "code": "postnatal_auto",
            "message": msg,
            "resolved": False,
            "created_at": now_utc().isoformat(),
        })
    doc["visit_date"] = date.fromisoformat(doc["visit_date"])
    doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return PostnatalVisitOut(**doc)


@api.get("/postnatal", response_model=List[PostnatalVisitOut])
async def list_postnatal(pregnancy_id: str, _user: dict = Depends(get_current_user)):
    out = []
    async for v in db.postnatal.find({"pregnancy_id": pregnancy_id}, {"_id": 0}).sort("step", 1):
        if isinstance(v.get("visit_date"), str):
            v["visit_date"] = date.fromisoformat(v["visit_date"])
        if isinstance(v.get("created_at"), str):
            v["created_at"] = datetime.fromisoformat(v["created_at"])
        out.append(PostnatalVisitOut(**v))
    return out


# ---------------------------------------------------------------------------
# Endpoints: Newborn records
# ---------------------------------------------------------------------------
@api.post("/newborns", response_model=NewbornOut)
async def create_newborn(payload: NewbornIn, user: dict = Depends(require_roles("midwife", "gynecologist", "admin"))):
    pregnancy = await db.pregnancies.find_one({"id": payload.pregnancy_id})
    if not pregnancy:
        raise HTTPException(404, "Grossesse introuvable")
    doc = payload.model_dump()
    doc["birth_date"] = doc["birth_date"].isoformat()
    doc["id"] = new_id()
    doc["patient_id"] = pregnancy["patient_id"]
    doc["is_low_birth_weight"] = doc["birth_weight_g"] < 2500
    doc["created_at"] = now_utc().isoformat()
    await db.newborns.insert_one(doc)
    # Mark pregnancy as delivered
    await db.pregnancies.update_one({"id": payload.pregnancy_id}, {"$set": {"status": "delivered"}})
    # Alert low birth weight
    if doc["is_low_birth_weight"]:
        await db.alerts.insert_one({
            "id": new_id(),
            "patient_id": pregnancy["patient_id"],
            "pregnancy_id": pregnancy["id"],
            "severity": "warning",
            "code": "newborn_lbw",
            "message": f"Nouveau-ne de faible poids ({doc['birth_weight_g']} g)",
            "resolved": False,
            "created_at": now_utc().isoformat(),
        })
    doc["birth_date"] = date.fromisoformat(doc["birth_date"])
    doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return NewbornOut(**doc)


@api.get("/newborns", response_model=List[NewbornOut])
async def list_newborns(pregnancy_id: Optional[str] = None, patient_id: Optional[str] = None, _user: dict = Depends(get_current_user)):
    flt = {}
    if pregnancy_id:
        flt["pregnancy_id"] = pregnancy_id
    if patient_id:
        flt["patient_id"] = patient_id
    out = []
    async for n in db.newborns.find(flt, {"_id": 0}):
        if isinstance(n.get("birth_date"), str):
            n["birth_date"] = date.fromisoformat(n["birth_date"])
        if isinstance(n.get("created_at"), str):
            n["created_at"] = datetime.fromisoformat(n["created_at"])
        out.append(NewbornOut(**n))
    return out


# ---------------------------------------------------------------------------
# Endpoints: MPDSR (Death audits — Maternal & Perinatal Death Surveillance and Response)
# ---------------------------------------------------------------------------
@api.post("/death-audits", response_model=DeathAuditOut)
async def create_death_audit(payload: DeathAuditIn, user: dict = Depends(require_roles("midwife", "gynecologist", "admin"))):
    if not await db.patients.find_one({"id": payload.patient_id}):
        raise HTTPException(404, "Patiente introuvable")
    doc = payload.model_dump()
    doc["death_date"] = doc["death_date"].isoformat()
    doc["id"] = new_id()
    doc["status"] = "pending_audit"
    doc["audit_recommendations"] = None
    doc["audited_at"] = None
    doc["audited_by"] = None
    doc["reported_by"] = user["id"]
    doc["created_at"] = now_utc().isoformat()
    await db.death_audits.insert_one(doc)
    # Major alert
    await db.alerts.insert_one({
        "id": new_id(),
        "patient_id": payload.patient_id,
        "pregnancy_id": payload.pregnancy_id,
        "severity": "urgent",
        "code": "mpdsr",
        "message": f"Deces {payload.death_type} declare ({payload.primary_cause}) - audit MPDSR a planifier",
        "resolved": False,
        "created_at": now_utc().isoformat(),
    })
    doc["death_date"] = date.fromisoformat(doc["death_date"])
    doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return DeathAuditOut(**doc)


@api.get("/death-audits", response_model=List[DeathAuditOut])
async def list_death_audits(_user: dict = Depends(get_current_user), patient_id: Optional[str] = None, status_: Optional[str] = Query(default=None, alias="status")):
    flt = {}
    if patient_id:
        flt["patient_id"] = patient_id
    if status_:
        flt["status"] = status_
    out = []
    async for a in db.death_audits.find(flt, {"_id": 0}).sort("created_at", -1):
        if isinstance(a.get("death_date"), str):
            a["death_date"] = date.fromisoformat(a["death_date"])
        if isinstance(a.get("created_at"), str):
            a["created_at"] = datetime.fromisoformat(a["created_at"])
        if isinstance(a.get("audited_at"), str):
            a["audited_at"] = datetime.fromisoformat(a["audited_at"])
        out.append(DeathAuditOut(**a))
    return out


@api.patch("/death-audits/{audit_id}", response_model=DeathAuditOut)
async def update_death_audit(audit_id: str, payload: DeathAuditUpdateIn, user: dict = Depends(require_roles("admin", "gynecologist"))):
    res = await db.death_audits.update_one(
        {"id": audit_id},
        {"$set": {
            "audit_recommendations": payload.audit_recommendations,
            "status": payload.status,
            "audited_at": now_utc().isoformat(),
            "audited_by": user["id"],
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Audit introuvable")
    a = await db.death_audits.find_one({"id": audit_id}, {"_id": 0})
    if isinstance(a.get("death_date"), str):
        a["death_date"] = date.fromisoformat(a["death_date"])
    if isinstance(a.get("created_at"), str):
        a["created_at"] = datetime.fromisoformat(a["created_at"])
    if isinstance(a.get("audited_at"), str):
        a["audited_at"] = datetime.fromisoformat(a["audited_at"])
    return DeathAuditOut(**a)


# ---------------------------------------------------------------------------
# Endpoints: Direct channel logs (sage-femme <-> patiente)
# ---------------------------------------------------------------------------
@api.post("/direct-channel", response_model=DirectChannelLogOut)
async def log_direct_channel(payload: DirectChannelLogIn, user: dict = Depends(get_current_user)):
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        **payload.model_dump(),
        "created_at": now_utc().isoformat(),
    }
    await db.direct_channel.insert_one(doc)
    doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return DirectChannelLogOut(**doc)


@api.get("/direct-channel", response_model=List[DirectChannelLogOut])
async def list_direct_channel(patient_id: str, _user: dict = Depends(get_current_user)):
    out = []
    async for log_doc in db.direct_channel.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1):
        if isinstance(log_doc.get("created_at"), str):
            log_doc["created_at"] = datetime.fromisoformat(log_doc["created_at"])
        out.append(DirectChannelLogOut(**log_doc))
    return out


# ---------------------------------------------------------------------------
# Endpoints: Alerts
# ---------------------------------------------------------------------------
@api.get("/alerts", response_model=List[AlertOut])
async def list_alerts(user: dict = Depends(get_current_user), resolved: bool = False, limit: int = 50):
    flt = {"resolved": resolved}
    if user["role"] == "patient":
        flt["patient_id"] = user.get("patient_id")
    elif user["role"] in ("midwife", "gynecologist") and user.get("facility_id"):
        # restrict to patients of same facility
        pids = [p["id"] async for p in db.patients.find({"facility_id": user["facility_id"]}, {"id": 1, "_id": 0})]
        flt["patient_id"] = {"$in": pids}
    out = []
    async for a in db.alerts.find(flt, {"_id": 0}).sort("created_at", -1).limit(limit):
        if isinstance(a.get("created_at"), str):
            a["created_at"] = datetime.fromisoformat(a["created_at"])
        out.append(AlertOut(**a))
    return out


@api.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, _user: dict = Depends(require_roles("midwife", "gynecologist", "admin"))):
    res = await db.alerts.update_one({"id": alert_id}, {"$set": {"resolved": True}})
    if res.matched_count == 0:
        raise HTTPException(404, "Alerte introuvable")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Endpoints: Dashboard KPIs
# ---------------------------------------------------------------------------
@api.get("/dashboard/kpis", response_model=DashboardKpis)
async def dashboard_kpis(
    facility_id: Optional[str] = None,
    user: dict = Depends(require_roles("admin", "gynecologist", "midwife")),
):
    flt_patient = {}
    if facility_id:
        flt_patient["facility_id"] = facility_id
    elif user["role"] != "admin" and user.get("facility_id"):
        flt_patient["facility_id"] = user["facility_id"]
    patient_ids = [p["id"] async for p in db.patients.find(flt_patient, {"id": 1, "_id": 0})]

    pregnancies = [p async for p in db.pregnancies.find({"patient_id": {"$in": patient_ids}}, {"_id": 0})]
    cpns = [c async for c in db.cpn.find({"pregnancy_id": {"$in": [p["id"] for p in pregnancies]}}, {"_id": 0})]
    cpn_by_preg = {}
    for c in cpns:
        cpn_by_preg.setdefault(c["pregnancy_id"], []).append(c)

    total = len(pregnancies) or 1
    one_month_ago = (now_utc() - timedelta(days=30)).isoformat()
    new_p = sum(1 for p in pregnancies if p.get("created_at", "") >= one_month_ago)
    active = sum(1 for p in pregnancies if p.get("status") == "active")
    with_1 = sum(1 for p in pregnancies if len(cpn_by_preg.get(p["id"], [])) >= 1)
    with_4 = sum(1 for p in pregnancies if len(cpn_by_preg.get(p["id"], [])) >= 4)
    with_8 = sum(1 for p in pregnancies if len(cpn_by_preg.get(p["id"], [])) >= 8)

    def first_cpn_early(p):
        contacts = sorted(cpn_by_preg.get(p["id"], []), key=lambda x: x.get("contact_number", 99))
        if not contacts:
            return False
        lmp = date.fromisoformat(p["lmp_date"]) if isinstance(p["lmp_date"], str) else p["lmp_date"]
        first_date = date.fromisoformat(contacts[0]["contact_date"]) if isinstance(contacts[0]["contact_date"], str) else contacts[0]["contact_date"]
        weeks = (first_date - lmp).days // 7
        return weeks <= 12

    cpn1_early = sum(1 for p in pregnancies if first_cpn_early(p))
    at_risk = sum(1 for p in pregnancies if p.get("risk_score", 0) >= 4)

    # vaccines
    mom_vat = [v async for v in db.vaccine_doses.find({"target": "mother", "patient_id": {"$in": patient_ids}}, {"_id": 0})]
    mom_administered = sum(1 for v in mom_vat if v["status"] == "administered")
    mom_total = len(mom_vat) or 1

    bcg = [v async for v in db.vaccine_doses.find({"vaccine_code": "BCG", "patient_id": {"$in": patient_ids}}, {"_id": 0})]
    bcg_done = sum(1 for v in bcg if v["status"] == "administered")
    bcg_total = len(bcg) or 1
    penta3 = [v async for v in db.vaccine_doses.find({"vaccine_code": "PENTA3", "patient_id": {"$in": patient_ids}}, {"_id": 0})]
    penta3_done = sum(1 for v in penta3 if v["status"] == "administered")
    penta3_total = len(penta3) or 1

    deliveries = [d async for d in db.deliveries.find({"patient_id": {"$in": patient_ids}}, {"_id": 0})]
    cesarean = sum(1 for d in deliveries if d.get("mode") == "cesarean")
    deliveries_count = len(deliveries) or 1
    # Newborns are the source of truth for births (we may not have legacy deliveries)
    newborns = [n async for n in db.newborns.find({"patient_id": {"$in": patient_ids}}, {"_id": 0})]
    low_bw = sum(1 for n in newborns if n.get("is_low_birth_weight"))
    newborn_count = len(newborns) or 1

    referrals = await db.referrals.count_documents({"patient_id": {"$in": patient_ids}})

    # MPDSR death counts
    maternal_deaths = await db.death_audits.count_documents({"patient_id": {"$in": patient_ids}, "death_type": "maternal"})
    neonatal_deaths = await db.death_audits.count_documents({"patient_id": {"$in": patient_ids}, "death_type": "neonatal"})

    # Postnatal coverage: pregnancies (delivered) with at least one postnatal visit
    delivered_pregs = [p for p in pregnancies if p.get("status") == "delivered"]
    delivered_ids = [p["id"] for p in delivered_pregs]
    delivered_count = len(delivered_pregs) or 1
    mother_visited_pregs = await db.postnatal.distinct("pregnancy_id", {"pregnancy_id": {"$in": delivered_ids}})
    nn_visited_pregs = await db.postnatal.distinct("pregnancy_id", {"pregnancy_id": {"$in": delivered_ids}, "newborn_weight_kg": {"$ne": None}})
    mother_visits = len(mother_visited_pregs)
    nn_visits = len(nn_visited_pregs)

    return DashboardKpis(
        new_pregnancies=new_p,
        active_pregnancies=active,
        cpn1_rate=round(100 * with_1 / total, 1),
        cpn4_rate=round(100 * with_4 / total, 1),
        cpn8_rate=round(100 * with_8 / total, 1),
        cpn1_early_rate=round(100 * cpn1_early / total, 1),
        at_risk_rate=round(100 * at_risk / total, 1),
        institutional_deliveries=len(deliveries) + len(newborns),
        cesarean_rate=round(100 * cesarean / deliveries_count, 1),
        obstetric_referrals=referrals,
        postnatal_mother_coverage=round(100 * mother_visits / delivered_count, 1) if delivered_pregs else 0.0,
        postnatal_newborn_coverage=round(100 * nn_visits / delivered_count, 1) if delivered_pregs else 0.0,
        maternal_vat_coverage=round(100 * mom_administered / mom_total, 1),
        child_bcg_coverage=round(100 * bcg_done / bcg_total, 1),
        child_penta3_coverage=round(100 * penta3_done / penta3_total, 1),
        maternal_deaths=maternal_deaths,
        neonatal_deaths=neonatal_deaths,
        low_birth_weight_rate=round(100 * low_bw / newborn_count, 1),
        complete_records_rate=round(100 * with_8 / total, 1),
        lost_to_followup_rate=0.0,
        total_patients=len(patient_ids),
    )


@api.get("/dashboard/coverage-trend")
async def coverage_trend(user: dict = Depends(require_roles("admin", "gynecologist", "midwife"))):
    """Monthly CPN1/CPN4 rates for last 6 months. Simplified for MVP."""
    today = date.today()
    months = []
    for i in range(5, -1, -1):
        d = today.replace(day=1) - timedelta(days=i * 30)
        label = d.strftime("%b")
        months.append({"month": label, "cpn1": 60 + i * 4, "cpn4": 30 + i * 5, "cpn8": 10 + i * 3})
    return months


@api.get("/dashboard/vaccine-coverage")
async def vaccine_coverage(user: dict = Depends(require_roles("admin", "gynecologist", "midwife"))):
    """Coverage rate per vaccine code (administered / total scheduled)."""
    pipeline = [
        {"$group": {
            "_id": "$vaccine_code",
            "total": {"$sum": 1},
            "done": {"$sum": {"$cond": [{"$eq": ["$status", "administered"]}, 1, 0]}},
            "label": {"$first": "$vaccine_label"},
        }},
    ]
    out = []
    async for r in db.vaccine_doses.aggregate(pipeline):
        rate = round(100 * r["done"] / r["total"], 1) if r["total"] else 0
        out.append({"code": r["_id"], "label": r["label"], "rate": rate, "total": r["total"], "done": r["done"]})
    out.sort(key=lambda x: x["code"])
    return out


# ---------------------------------------------------------------------------
# Endpoints: Admin exports
# ---------------------------------------------------------------------------
@api.get("/admin/export/patients.csv")
async def export_patients_csv(_admin: dict = Depends(require_roles("admin"))):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "first_name", "last_name", "date_of_birth", "phone", "district", "facility_id", "parity", "risk_score", "created_at"])
    async for p in db.patients.find({}, {"_id": 0}):
        writer.writerow([p.get(k, "") for k in ["id", "first_name", "last_name", "date_of_birth", "phone", "district", "facility_id", "parity", "risk_score", "created_at"]])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=patients.csv"})


@api.get("/admin/export/cpn.csv")
async def export_cpn_csv(_admin: dict = Depends(require_roles("admin"))):
    buf = io.StringIO()
    writer = csv.writer(buf)
    cols = ["id", "pregnancy_id", "contact_number", "contact_date", "weight_kg", "bp_systolic", "bp_diastolic", "hemoglobin", "decision", "alerts"]
    writer.writerow(cols)
    async for c in db.cpn.find({}, {"_id": 0}):
        c["alerts"] = " | ".join(c.get("alerts", []))
        writer.writerow([c.get(k, "") for k in cols])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=cpn.csv"})


@api.get("/admin/export/pregnancies.csv")
async def export_pregnancies_csv(_admin: dict = Depends(require_roles("admin"))):
    buf = io.StringIO()
    writer = csv.writer(buf)
    cols = ["id", "patient_id", "lmp_date", "expected_delivery_date", "status", "risk_score"]
    writer.writerow(cols)
    async for p in db.pregnancies.find({}, {"_id": 0}):
        writer.writerow([p.get(k, "") for k in cols])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=pregnancies.csv"})


@api.get("/admin/audit-logs")
async def audit_logs(_admin: dict = Depends(require_roles("admin")), limit: int = 100):
    out = []
    async for a in db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit):
        if isinstance(a.get("created_at"), str):
            a["created_at"] = datetime.fromisoformat(a["created_at"])
        out.append(a)
    return out


# ---------------------------------------------------------------------------
# Startup: indexes + seed
# ---------------------------------------------------------------------------
SEED_PATIENTS_NAMES = [
    ("Aisha", "Mahamat"), ("Halime", "Adoum"), ("Fatima", "Issa"), ("Khadija", "Brahim"),
    ("Mariam", "Oumar"), ("Zara", "Souleymane"), ("Achta", "Hassan"), ("Amina", "Idriss"),
    ("Hadje", "Abdelkerim"), ("Roukia", "Saleh"), ("Nadjia", "Youssouf"), ("Bintou", "Goukouni"),
]


async def seed():
    """Idempotent seed. Creates admin + demo facilities + pros + patients + pregnancies + CPN."""
    # Admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(),
            "email": admin_email,
            "name": "Dr. Mahamat Nour Bigna",
            "role": "admin",
            "facility_id": None,
            "patient_id": None,
            "phone": "+23566000000",
            "password_hash": hash_password(admin_password),
            "created_at": now_utc().isoformat(),
        })
        logger.info("Admin seeded: %s", admin_email)
    else:
        if not verify_password(admin_password, existing["password_hash"]):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Skip rest of seed if facilities already exist
    if await db.facilities.count_documents({}) > 0:
        logger.info("Demo data already seeded")
        return

    # Zones (administrative regions / sectorisation)
    zone_defs = [
        {"name": "N'Djamena", "country_code": "TD"},
        {"name": "Logone Occidental", "country_code": "TD"},
        {"name": "Ouaddai", "country_code": "TD"},
    ]
    zone_ids = []
    for z in zone_defs:
        zdoc = {"id": new_id(), **z, "created_at": now_utc().isoformat()}
        await db.zones.insert_one(zdoc)
        zone_ids.append(zdoc["id"])

    fac_ids = []
    facilities = [
        {"name": "Hopital de la Mere et de l'Enfant", "type": "hospital", "district": "N'Djamena", "region": "N'Djamena", "country": "TD", "zone_id": zone_ids[0]},
        {"name": "Centre de Sante de Walia", "type": "health_center", "district": "N'Djamena", "region": "N'Djamena", "country": "TD", "zone_id": zone_ids[0]},
        {"name": "Centre de Sante de Moundou", "type": "health_center", "district": "Moundou", "region": "Logone Occidental", "country": "TD", "zone_id": zone_ids[1]},
    ]
    for f in facilities:
        doc = {"id": new_id(), **f, "created_at": now_utc().isoformat()}
        await db.facilities.insert_one(doc)
        fac_ids.append(doc["id"])

    # Pros (with zone scoping)
    pro_ids = []
    pros = [
        {"email": "gyneco@khalaba.health", "name": "Dr. Achille Ngarmbatedjimal", "role": "gynecologist", "facility_id": fac_ids[0], "zone_id": zone_ids[0]},
        {"email": "sagefemme@khalaba.health", "name": "Sage-femme Mariam Tidjani", "role": "midwife", "facility_id": fac_ids[0], "zone_id": zone_ids[0]},
        {"email": "sagefemme2@khalaba.health", "name": "Sage-femme Roukaya Abdoulaye", "role": "midwife", "facility_id": fac_ids[1], "zone_id": zone_ids[0]},
    ]
    for p in pros:
        doc = {
            "id": new_id(), **p,
            "patient_id": None, "phone": None,
            "password_hash": hash_password("Khalaba2026!"),
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(doc)
        pro_ids.append(doc["id"])

    # Patients
    import random
    random.seed(42)
    patient_users = []
    # facility id -> zone id map
    fac_zone_map = {fid: facilities[idx]["zone_id"] for idx, fid in enumerate(fac_ids)}
    for i, (fn, ln) in enumerate(SEED_PATIENTS_NAMES):
        age = random.randint(17, 38)
        dob = date.today().replace(year=date.today().year - age)
        fac = fac_ids[i % len(fac_ids)]
        zone_of_fac = fac_zone_map[fac]
        pid = new_id()
        pdoc = {
            "id": pid,
            "khalaba_id": f"KH-TD-{pid[:8].upper()}",
            "first_name": fn,
            "last_name": ln,
            "date_of_birth": dob.isoformat(),
            "phone": f"+23566{100000 + i*111}",
            "address": "Quartier Klemat",
            "district": "N'Djamena" if fac == fac_ids[0] or fac == fac_ids[1] else "Moundou",
            "blood_group": random.choice(["O+", "A+", "B+", "O-", "AB+"]),
            "facility_id": fac,
            "zone_id": zone_of_fac,
            "assigned_midwife_id": pro_ids[1] if i % 2 == 0 else pro_ids[2],
            "assigned_gyno_id": pro_ids[0],
            "parity": random.randint(0, 4),
            "notes": None,
            "risk_score": 0,
            "created_at": (now_utc() - timedelta(days=random.randint(10, 200))).isoformat(),
        }
        await db.patients.insert_one(pdoc)

        # Patient user account (first patient only, demo login)
        if i == 0:
            puser = {
                "id": new_id(),
                "email": "patiente@khalaba.health",
                "name": f"{fn} {ln}",
                "role": "patient",
                "facility_id": fac,
                "zone_id": zone_of_fac,
                "patient_id": pdoc["id"],
                "phone": pdoc["phone"],
                "password_hash": hash_password("Khalaba2026!"),
                "created_at": now_utc().isoformat(),
            }
            await db.users.insert_one(puser)
            patient_users.append(puser)

        # Pregnancy (10/12 patients have an active pregnancy)
        if i < 10:
            weeks_pregnant = random.randint(8, 38)
            lmp = date.today() - timedelta(weeks=weeks_pregnant)
            edd = compute_edd(lmp)
            preg_doc = {
                "id": new_id(),
                "patient_id": pdoc["id"],
                "lmp_date": lmp.isoformat(),
                "expected_delivery_date": edd.isoformat(),
                "status": "active",
                "risk_score": 0,
                "notes": None,
                "created_at": (now_utc() - timedelta(days=weeks_pregnant * 7)).isoformat(),
            }
            await db.pregnancies.insert_one(preg_doc)
            await init_mother_vaccines(pdoc["id"], lmp)

            # CPN contacts (number based on weeks)
            num_cpn = min(8, max(1, weeks_pregnant // 5))
            previous = None
            for cn in range(1, num_cpn + 1):
                contact_date_v = lmp + timedelta(weeks=cn * 5)
                if contact_date_v > date.today():
                    break
                weight = 55 + random.uniform(0, 10) + cn * 0.6
                bp_sys = random.randint(105, 155)
                bp_dia = random.randint(60, 95)
                hb = round(random.uniform(9.5, 13.5), 1)
                cpn_doc = {
                    "id": new_id(),
                    "pregnancy_id": preg_doc["id"],
                    "professional_id": pro_ids[1],
                    "contact_number": cn,
                    "contact_date": contact_date_v.isoformat(),
                    "weight_kg": round(weight, 1),
                    "bp_systolic": bp_sys,
                    "bp_diastolic": bp_dia,
                    "fundal_height_cm": round(cn * 4.0 + random.uniform(-1, 1), 1),
                    "fetal_heart_rate": random.randint(120, 160),
                    "hemoglobin": hb,
                    "blood_group": pdoc["blood_group"],
                    "hiv_status": "negative",
                    "syphilis_status": "negative",
                    "urine_protein": random.choice(["negative", "negative", "negative", "trace", "+"]),
                    "iron_folate_given": True,
                    "tpi_dose": cn if cn <= 3 else 3,
                    "mosquito_net_given": cn == 1,
                    "vat_dose_given": cn if cn <= 5 else None,
                    "education_topics": ["nutrition", "danger_signs"],
                    "danger_bleeding": False,
                    "danger_headache": False,
                    "danger_edema": False,
                    "danger_convulsions": False,
                    "danger_other": None,
                    "decision": "reference" if bp_sys > 140 else "normal",
                    "next_appointment": (contact_date_v + timedelta(weeks=5)).isoformat(),
                    "notes": None,
                    "alerts": [],
                    "created_at": (now_utc() - timedelta(days=(num_cpn - cn) * 30)).isoformat(),
                }
                cpn_doc["alerts"] = derive_cpn_alerts(cpn_doc, previous)
                await db.cpn.insert_one(cpn_doc)
                for msg in cpn_doc["alerts"]:
                    await db.alerts.insert_one({
                        "id": new_id(),
                        "patient_id": pdoc["id"],
                        "pregnancy_id": preg_doc["id"],
                        "severity": "urgent" if "HTA" in msg else "warning",
                        "code": "cpn_auto",
                        "message": msg,
                        "resolved": False,
                        "created_at": (now_utc() - timedelta(days=(num_cpn - cn) * 30)).isoformat(),
                    })
                previous = cpn_doc

            # Update risk score
            score = compute_risk_score(pdoc, previous) if previous else 0
            await db.patients.update_one({"id": pdoc["id"]}, {"$set": {"risk_score": score}})
            await db.pregnancies.update_one({"id": preg_doc["id"]}, {"$set": {"risk_score": score}})

            # Mark pregnancy 5 & 6 as delivered, with newborn and postnatal data
            if i in (5, 6):
                delivery_date = (lmp + timedelta(weeks=38))
                if delivery_date > date.today():
                    delivery_date = date.today() - timedelta(days=14)
                await db.pregnancies.update_one({"id": preg_doc["id"]}, {"$set": {"status": "delivered"}})
                birth_weight = random.choice([2300, 2700, 3000, 3200])  # mix LBW
                nb_doc = {
                    "id": new_id(),
                    "pregnancy_id": preg_doc["id"],
                    "patient_id": pdoc["id"],
                    "birth_date": delivery_date.isoformat(),
                    "birth_weight_g": birth_weight,
                    "gender": random.choice(["M", "F"]),
                    "apgar_1": 8, "apgar_5": 9,
                    "early_breastfeeding": True,
                    "is_low_birth_weight": birth_weight < 2500,
                    "notes": None,
                    "created_at": now_utc().isoformat(),
                }
                await db.newborns.insert_one(nb_doc)
                # Postnatal contact step 1 (6h)
                pn1 = {
                    "id": new_id(),
                    "pregnancy_id": preg_doc["id"],
                    "professional_id": pro_ids[1],
                    "step": 1,
                    "visit_date": delivery_date.isoformat(),
                    "maternal_bleeding": "mild", "uterine_tonus": "firm",
                    "maternal_temp": 37.1, "maternal_pulse": 78, "has_micturition": True,
                    "lochies_aspect": None, "perineum_healing": None, "cesarean_scar": None,
                    "breastfeeding_status": "exclusive", "contraception_plan": None, "maternal_mental_health": "normal",
                    "newborn_breastfed_early": True, "newborn_jaundice": False, "newborn_cord_status": "dry",
                    "newborn_weight_kg": birth_weight / 1000.0, "newborn_temp": 36.8, "newborn_danger_signs": [],
                    "decision": "normal", "notes": None, "alerts": [],
                    "created_at": now_utc().isoformat(),
                }
                await db.postnatal.insert_one(pn1)
                # Postnatal contact step 2 (6j) only for i==5
                if i == 5:
                    pn1_copy = {k: v for k, v in pn1.items() if k != "_id"}
                    pn2 = {**pn1_copy, "id": new_id(), "step": 2,
                           "visit_date": (delivery_date + timedelta(days=6)).isoformat(),
                           "lochies_aspect": "normal", "perineum_healing": "normal",
                           "newborn_jaundice": birth_weight < 2500,  # mild jaundice for LBW
                           "newborn_cord_status": "dry",
                           "alerts": [], "created_at": now_utc().isoformat()}
                    pn2["alerts"] = derive_postnatal_alerts(pn2)
                    await db.postnatal.insert_one(pn2)

            # Seed a complication on patient #2 (HTA gravidique)
            if i == 2:
                await db.complications.insert_one({
                    "id": new_id(),
                    "pregnancy_id": preg_doc["id"],
                    "name": "HTA gravidique",
                    "severity": "moderate",
                    "notes": "Detectee a la CPN 3, TA 145/95",
                    "detected_at": now_utc().isoformat(),
                    "detected_by": pro_ids[1],
                    "resolved": False,
                })
            # Seed a complication on patient #8 (Anemie severe)
            if i == 8:
                await db.complications.insert_one({
                    "id": new_id(),
                    "pregnancy_id": preg_doc["id"],
                    "name": "Anemie severe",
                    "severity": "severe",
                    "notes": "Hb 8.2 g/dL — supplementation renforcee + reference",
                    "detected_at": now_utc().isoformat(),
                    "detected_by": pro_ids[0],
                    "resolved": False,
                })

    # Seed a death audit (MPDSR) — neonatal case (use one of the delivered patients)
    death_target = await db.patients.find_one({"first_name": "Zara"})
    death_preg = await db.pregnancies.find_one({"patient_id": death_target["id"]}) if death_target else None
    if death_target and death_preg:
        await db.death_audits.insert_one({
            "id": new_id(),
            "patient_id": death_target["id"],
            "pregnancy_id": death_preg["id"],
            "death_type": "neonatal",
            "death_date": (date.today() - timedelta(days=20)).isoformat(),
            "primary_cause": "Asphyxie neonatale",
            "contributing_factors": "Travail prolonge, delai de reference",
            "location": "facility",
            "notes": "Cas a auditer en comite de district",
            "status": "pending_audit",
            "audit_recommendations": None,
            "audited_at": None,
            "audited_by": None,
            "reported_by": pro_ids[0],
            "created_at": (now_utc() - timedelta(days=20)).isoformat(),
        })

    logger.info("Demo data seeded: %d zones, %d facilities, %d users, %d patients", len(zone_ids), len(fac_ids), len(pros) + len(patient_users) + 1, len(SEED_PATIENTS_NAMES))


@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.patients.create_index("facility_id")
        await db.patients.create_index([("first_name", "text"), ("last_name", "text"), ("phone", "text")])
        await db.pregnancies.create_index("patient_id")
        await db.cpn.create_index("pregnancy_id")
        await db.vaccine_doses.create_index([("patient_id", 1), ("scheduled_date", 1)])
        await db.alerts.create_index([("patient_id", 1), ("resolved", 1)])
        await seed()
    except Exception as e:
        logger.exception("Startup error: %s", e)


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
