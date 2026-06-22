"""Pydantic models for KHALABA."""
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime, timezone
import uuid


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- Auth ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=2)
    role: Literal["patient", "soignant", "admin"] = "patient"
    phone: Optional[str] = None
    zone_id: Optional[str] = None
    structure_id: Optional[str] = None
    profession: Optional[str] = None  # for soignant: sage-femme, gynéco, etc.


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class VerifyOtpIn(BaseModel):
    temp_token: str
    otp_code: str


class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    phone: Optional[str] = None
    zone_id: Optional[str] = None
    structure_id: Optional[str] = None
    profession: Optional[str] = None
    created_at: Optional[str] = None


# ---------- Zones / Structures ----------
class RegionIn(BaseModel):
    name: str
    country: str = "Tchad"
    dhis2_org_unit_uid: Optional[str] = None


class ZoneIn(BaseModel):
    name: str
    region: str  # legacy name string (kept for compat)
    region_id: Optional[str] = None
    country: str = "Tchad"
    dhis2_org_unit_uid: Optional[str] = None


class StructureIn(BaseModel):
    name: str
    zone_id: str
    type: Literal["hopital", "centre_sante", "clinique", "case_sante"] = "centre_sante"
    dhis2_org_unit_uid: Optional[str] = None


# ---------- Patient & Pregnancy ----------
class PatientIn(BaseModel):
    full_name: str
    dob: str  # ISO date
    phone: Optional[str] = None
    address: Optional[str] = None
    zone_id: str
    structure_id: Optional[str] = None
    blood_group: Optional[str] = None
    emergency_contact: Optional[str] = None


class PregnancyIn(BaseModel):
    patient_id: str
    lmp_date: str  # last menstrual period ISO date
    parity: Optional[int] = 0
    gravidity: Optional[int] = 1
    notes: Optional[str] = None


# ---------- Clinical: CPN (Antenatal) ----------
class CPNVisitIn(BaseModel):
    pregnancy_id: str
    visit_number: int = Field(ge=1, le=8)
    visit_date: str
    gestational_age_weeks: Optional[float] = None
    # Constants
    weight_kg: Optional[float] = None
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    uterine_height_cm: Optional[float] = None
    fetal_heart_rate: Optional[int] = None
    # Biology (extended MSP)
    hemoglobin: Optional[float] = None
    proteinuria: Optional[str] = None  # negative/+/++/+++
    urine_albumin: Optional[str] = None  # alias MSP for proteinuria
    creatinine: Optional[float] = None  # umol/L or mg/dL
    platelets: Optional[int] = None  # /mm3
    hiv_status: Optional[str] = None
    syphilis_status: Optional[str] = None
    hepb_status: Optional[str] = None
    # Preventive
    iron_folic: Optional[bool] = False
    deworming: Optional[bool] = False
    tetanus_dose: Optional[int] = None  # 0-5
    malaria_prophylaxis: Optional[bool] = False
    iptp: Optional[bool] = None  # MSP canonical alias for malaria_prophylaxis
    # Complications & notes
    complications: List[str] = []
    notes: Optional[str] = None


# ---------- Clinical: Postnatal ----------
class PostnatalVisitIn(BaseModel):
    pregnancy_id: str
    stage: Literal["6h", "6j", "6s"]
    visit_date: str
    # 6h fields
    bleeding: Optional[str] = None  # normal/abundant/severe
    uterine_tone: Optional[str] = None  # firm/soft
    maternal_temp: Optional[float] = None
    first_breastfeed: Optional[bool] = None
    # 6j fields
    wound_healing: Optional[str] = None
    lochia: Optional[str] = None
    milk_supply: Optional[str] = None
    neonatal_jaundice: Optional[bool] = None
    cord_care: Optional[str] = None
    danger_signs: List[str] = []
    # 6s fields
    menstruation_return: Optional[bool] = None
    maternal_mental_health: Optional[str] = None
    family_planning: Optional[str] = None
    infant_weight_kg: Optional[float] = None
    notes: Optional[str] = None


# ---------- Child & Vaccination ----------
class ChildIn(BaseModel):
    pregnancy_id: str
    full_name: Optional[str] = None
    dob: str
    sex: Literal["M", "F"]
    birth_weight_kg: Optional[float] = None
    apgar_1min: Optional[int] = None
    apgar_5min: Optional[int] = None


class VaccinationIn(BaseModel):
    child_id: str
    vaccine_name: str
    dose_number: int = 1
    date_given: str
    batch_number: Optional[str] = None
    notes: Optional[str] = None


# ---------- MPDSR (Maternal/Neonatal Death Surveillance & Response) ----------
class MPDSRReportIn(BaseModel):
    patient_id: Optional[str] = None
    pregnancy_id: Optional[str] = None
    death_type: Literal["maternelle", "neonatale", "foetal_in_utero"]
    death_date: str
    place_of_death: str
    medical_cause: str
    contributing_factors: List[str] = []
    audit_recommendations: Optional[str] = None
    # MSP canonical audit_status
    audit_status: Literal[
        "non_audite", "en_attente", "en_attente_audit",
        "audite_en_comite", "cloture"
    ] = "en_attente_audit"
    audit_date: Optional[str] = None
    # 3 retards OMS (WHO three-delays model)
    delay1_recours: Optional[bool] = False         # délai de recours aux soins
    delay2_acces: Optional[bool] = False           # délai d'accès à la structure
    delay3_prise_charge: Optional[bool] = False    # délai de prise en charge
    preventable: Optional[bool] = False
    preventive_actions: Optional[str] = None
    notes: Optional[str] = None


# ---------- Appointment ----------
class AppointmentIn(BaseModel):
    patient_id: str
    soignant_id: Optional[str] = None
    scheduled_at: str
    type: Literal["CPN", "postnatal", "vaccination", "consultation"]
    notes: Optional[str] = None
