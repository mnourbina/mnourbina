# KHALABA — Plateforme de Santé Maternelle & Infantile

## Original Problem Statement
> "developpe cet application" — referencing the investment dossier at:
> https://customer-assets.emergentagent.com/job_7a271745-c7c4-4056-b6a7-d440d8c2f88d/artifacts/fb2m9tfu_KHALABA_Dossier_D_Investissement_Et_Guide_Technique.docx

KHALABA is a digital maternal-infant health platform targeting Sub-Saharan Africa (Chad-first), connecting three portals — Patient, Healthcare Professional (Sage-femme / Gynéco), and Administrator / Ministry — around a unified clinical record (CPN 1-8, Postnatal 6h/6j/6s, vaccination calendar, MPDSR surveillance).

## User Choices (Feb 26, 2026)
- Stack: React + FastAPI + MongoDB (adapted from dossier's Next.js + PostgreSQL recommendation)
- Auth: JWT custom + simulated OTP (6-digit code returned in API response for demo)
- MVP scope: All 3 portals + Analytics dashboard
- Language: French only (Anglais/Arabe deferred)
- Mode: Online MVP (offline-first PWA deferred)

## Architecture
- **Backend** (`/app/backend/server.py` + `auth_utils.py` + `models.py`)
  - FastAPI with `/api` prefix, cookie-based JWT (httpOnly access + refresh)
  - MongoDB collections: users, zones, structures, patients, pregnancies, cpn_visits, postnatal_visits, children, vaccinations, mpdsr_reports, appointments, otp_codes
  - Indexes + seed (5 zones for Tchad, structures, admin + 2 demo accounts)
- **Frontend** (`/app/frontend/src`)
  - React Router + Tailwind + shadcn/ui + Recharts + Sonner toast
  - Pages: Landing, Login (2-step OTP), Register, AppLayout (role-aware sidebar), Patient/Soignant/Admin dashboards, full CPN form, Postnatal form (6h/6j/6s tabs), Vaccination form, MPDSR dialog, Admin Config (zones + structures)

## User Personas
1. **Maman / Patiente** — view pregnancy timeline, appointments, baby vaccinations
2. **Sage-femme / Gynécologue** — manage patients in her zone, do CPN/postnatal/vaccination, declare MPDSR
3. **Administrateur / Ministère** — analytics dashboard, configure zones & structures

## Implemented (Feb 26, 2026)
- ✅ JWT + simulated OTP auth with httpOnly cookies, 3 roles, seed accounts
- ✅ Zones & Structures CRUD (5 zones, 10 structures seeded)
- ✅ Patient CRUD (zone-filtered for soignants)
- ✅ Pregnancy management
- ✅ CPN form with clinical constants, biology, preventive packages, complications + automatic alerts (HTN, anaemia, proteinuria)
- ✅ Postnatal form (3 stages 6h/6j/6s) with danger-sign detection
- ✅ Child registration + Vaccination calendar (17 vaccines)
- ✅ MPDSR death surveillance form
- ✅ Admin analytics with KPIs, BarChart by zone, PieChart of top complications, CPN4+ coverage
- ✅ Warm earth-tone design (Terracotta / Ochre / Sand / Chocolate / Gold) — branded Logo with mother-child K silhouette
- ✅ Mobile-responsive sidebar nav

## Implemented (Iteration 2 — Feb 27, 2026)
- ✅ Patient timeline endpoint `/api/patient/me/timeline` (CPN + postnatal + children + vaccinations nested)
- ✅ Enriched Patient portal: vertical CPN timeline with numbered dots + alert badges, postnatal history, baby vaccination cards
- ✅ Full Appointment management: create dialog (patient + date + time + type), shadcn Calendar with day-indicator dots, day-detail panel, status update (done/missed) via PATCH `/api/appointments/{id}`
- ✅ Patient agenda grouped into Upcoming / Past with status badges
- ✅ Multilingual FR / EN / AR with full RTL flip (sidebar position, html dir, text alignment), persistent in localStorage

## Backlog (P0 → P2)
- P1: Appointments scheduler with calendar UI (model exists, UI is a list)
- P1: Patient portal — display her own CPN visits, vaccination calendar of her baby
- P1: Multi-language toggle (FR / EN / AR + RTL)
- P1: Production email/SMS OTP (Twilio) — replace demo
- P2: Offline-first PWA + sync
- P2: DHIS2 export hook (analytics → ministry)
- P2: Photo attachments for clinical visits (object storage)
- P2: SMS reminders for missed appointments

## Test Credentials
See `/app/memory/test_credentials.md`

## Test Results (Iteration 1)
- Backend: 21/21 pytest passing (see `/app/backend/tests/test_khalaba_api.py`)
- Frontend: critical flows validated (landing, login per role, admin dashboard, soignant patient + CPN flow)
