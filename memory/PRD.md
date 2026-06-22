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

## Implemented (Iteration 3 — Feb 28, 2026) — DHIS2 / MSP
- ✅ 10 official MSP/DHIS2 indicators covered: DE_CPN1_TOTAL, DE_CPN4_TOTAL, DE_ANEMIA_PREG, DE_VIH_TESTED, DE_VIH_POS, DE_SYPH_TESTED, DE_SYPH_POS, DE_MATERNAL_DEATH, DE_NEONATAL_DEATH, DE_MPDSR_AUDITED
- ✅ `GET /api/analytics/dhis2-indicators?period=YYYYMM&zone_id=` — returns indicators table
- ✅ `GET /api/analytics/dhis2-export?period=YYYYMM` — returns official DHIS2 DataValueSet JSON (dataSet: `KHALABA_MNCH_MONTHLY`, period, orgUnit, attributeOptionCombo, dataValues[].value as string, completeDate) — spec compliant
- ✅ `GET /api/analytics/dhis2-indicators/export.csv` — CSV export for Excel
- ✅ `GET /api/audit-logs` — every DHIS2 export is audit-logged (user, period, zone, values summary)
- ✅ MPDSR form extended with `audit_status` (Non audité / En attente / Audité en comité) + `audit_date`, used for DE_MPDSR_AUDITED (<30 days from death)
- ✅ Admin "Indicateurs MSP" page (`/app/admin/indicators`): filter (period + zone), table 10 indicators, bar chart, JSON preview + copy/download buttons

## Implemented (Iteration 4 — Feb 28, 2026) — Suivi obstétrical OMS
- ✅ Module `lib/pregnancyCalc.js` : Naegele (LMP→EDD), âge gestationnel (SA+j), calendrier OMS 8 contacts (CPN1=0w, CPN2=20w, CPN3=26w, CPN4=30w, CPN5=34w, CPN6=36w, CPN7=38w, CPN8=40w)
- ✅ CPN form enrichi : bloc "Calculs OMS" automatique (GA + DPA + prochaine CPN), alerte "CPN1 tardive" si GA>12 SA, hint anémie en ligne (Hb<11), case "auto-schedule next appointment" qui crée le RDV à la date OMS
- ✅ Nouvelle page "Grossesses actives" (`/app/soignant/grossesses`) avec `PregnancyCard` (statut/GA/DPA/dernière CPN/prochaine CPN/anémie), bannière CPN en retard >7j (jaune) / >14j (rouge urgente), action "Marquer LTFU"
- ✅ Endpoints backend : `GET /api/pregnancies` (zone-filtré pour soignant, avec patient + last_cpn nested), `PATCH /api/pregnancies/{id}` (statut), `POST /api/pregnancies/{id}/found` (marque retrouvée)
- ✅ Statuts grossesse : `en_cours`, `perdue_vue`, `accouchee`, `fausse_couche`, `ivg`, `transferee` + legacy `active`
- ✅ Normalisation HIV/Syphilis aux valeurs canoniques MSP : NEG / POS / INCONNU (rétrocompatible avec données legacy negatif/positif)
- ✅ Filtre "Perdues de vue" + KPI strip + actions rapides (Appeler tel: / Marquer retrouvée / Nouvelle CPN / Ouvrir dossier)

## Implemented (Iteration 5 — Feb 28, 2026) — MSP Schema alignment
- ✅ **MPDSR enrichi (Brique 4)** : 3 retards OMS (recours, accès, prise en charge) + `preventable` + `preventive_actions` + nouveau type `foetal_in_utero` + statuts canoniques MSP (`en_attente_audit`, `audite_en_comite`, `cloture`)
- ✅ **Alertes cliniques persistantes (Brique 3)** : collection `alerts` avec `severity` (CRITICAL/WARNING/INFO), `is_read`, `resolved_at`. Port fidèle de la fonction MSP `checkAlerts` : pré-éclampsie sévère (TA≥160/110), pré-éclampsie risque (≥140/90), anémie sévère (Hb<7), anémie modérée (Hb<11), bradycardie fœtale (BCF<110), tachycardie fœtale (BCF>160), protéinurie ++/+++
- ✅ Endpoints : `GET /api/alerts` (zone-filtré), `GET /api/alerts/unread-count`, `PATCH /api/alerts/{id}` (mark read / resolve)
- ✅ Page Alertes (`/app/soignant/alerts`) avec KPIs + filtres (Toutes/Non lues/Critiques/Résolues) + actions individuelles + tel: link direct
- ✅ **Bilans cliniques étendus** : `creatinine`, `platelets`, `urine_albumin` (alias MSP de proteinuria), `iptp` (alias MSP de malaria_prophylaxis) — rétrocompatibles
- ✅ Nav link "Alertes cliniques" avec icône Bell
- ✅ **55/55 tests pytest passent**
- ⚪ Hiérarchie Region/District/Facility (c) et AuditLog générique (e) reportés à une itération dédiée

## Implemented (Iteration 6 — Feb 28, 2026) — Brique 5 : Admin KPIs UNFPA
- ✅ **Endpoint `GET /api/admin/kpis`** (admin only) avec filtres `zone_id`, `date_from`, `date_to`
- ✅ 4 KPIs alignés UNFPA/OMS, chacun avec numerator/denominator/target/target_direction/on_track :
  - `cpn4_rate` : Taux CPN4+ (cible ≥ 75%)
  - `assisted_birth_rate` : Accouchement assisté (cible ≥ 85%, proxy visite postnatale 6h)
  - `anemia_rate` : Taux d'anémie Hb<11 sur dépistées (cible ≤ 20%, lower-is-better)
  - `death_audit_rate` : Décès audités MPDSR sous 30 jours (cible ≥ 95%)
- ✅ Dashboard admin (`/app/admin`) enrichi avec section "Indicateurs clés UNFPA / OMS" : 4 cartes KpiCard avec badges Sur cible / Hors cible, icônes contextuelles, ratio num/den
- ✅ Bug fix : code orphelin en fin de `MPDSRPage.jsx` (compile error qui bloquait le frontend) supprimé
- ✅ **62/62 tests pytest passent** (55 anciens + 7 nouveaux test_iteration5_admin_kpis.py)

## Implemented (Iteration 6b — Feb 28, 2026) — Calendrier OMS fenêtré + Progression CPN
- ✅ **Nouveau `CPN_SCHEDULE_OMS`** (lib/pregnancyCalc.js) avec fenêtres `weekMin`/`weekMax` pour chacun des 8 contacts OMS (1er trim, 20-24, 26-30, 30-34, 34-36, 36-38, 38-40, 40-42)
- ✅ **`getNextCPN(lmpStr, doneCpnNumbers[])`** : sélectionne la prochaine CPN selon (1) fenêtre contenant l'âge gestationnel courant ET non faite, (2) fallback prochaine non-faite après cette semaine, (3) tout undone restant. Retourne `recommendedDate` (milieu fenêtre), `currentWeek`, `daysLate` (uniquement si on a dépassé `weekMax`)
- ✅ **`isCPNOverdue(nextCPN)`** : true si `daysLate > 7` jours (>1 semaine après la fin de fenêtre)
- ✅ **PregnancyCard** : barre de progression CPN (0/8 → 8/8), bannière retard en semaines, libellés MAJ
- ✅ Endpoint `GET /api/pregnancies` retourne désormais `done_cpns` (liste des numéros) et `cpn_count` pour alimenter la barre de progression
- ✅ **62/62 tests pytest toujours OK**

## Implemented (Iteration 7 — Feb 28, 2026) — Brique 7 : Perdues de vue (LTFU) automatique
- ✅ **Scanner backend `run_ltfu_scan()`** : port fidèle du `checkLostToFollowUp` MSP. Pour chaque grossesse `en_cours`, calcule `getNextCPN(...)`, flippe en `perdue_vue` si `daysLate > 14`, crée une alerte type `PERDUE_DE_VUE` (severity WARNING) avec `context.days_late`, assigne un ASC (V1: tout soignant de la zone) + audit log `ASSIGNED_LTFU`. Notification ASC mockée (log only, prêt pour Twilio/WhatsApp).
- ✅ **Idempotence stricte** : ne crée jamais d'alerte LTFU dupliquée — vérifie `existing` avant insert
- ✅ **APScheduler** : job cron quotidien à 07:00 UTC démarré au boot FastAPI (`apscheduler==3.11.2` ajouté à requirements.txt)
- ✅ Endpoints : `POST /api/admin/check-ltfu` (trigger manuel), `GET /api/admin/ltfu` (cas ouverts, zone-filtré pour soignants)
- ✅ Filtre `type=` ajouté à `GET /api/alerts`
- ✅ `POST /api/pregnancies/{id}/found` met aussi à jour les alertes `PERDUE_DE_VUE` (is_read + resolved_at) et journalise `MARKED_FOUND` dans audit_logs
- ✅ Page admin `/app/admin/ltfu` (`AdminLTFUPage.jsx`) avec bouton "Lancer un scan", info dernier scan, grille de cartes LTFU avec bouton "Marquer comme retrouvée", nav link Perdues de vue
- ✅ **70/70 tests pytest passent** (62 anciens + 8 nouveaux test_iteration7_ltfu.py — incluant idempotence + résolution d'alerte au mark-found)

## Implemented (Iteration 8 — Feb 28, 2026) — Brique 8 : Export DHIS2 JSON aligné rapport district
- ✅ **Nouveau endpoint `GET /api/reports/dhis2?month=X&year=Y[&zone_id=]`** (admin only) retournant un **DHIS2 DataValueSet JSON** spec-compliant : `dataSet=MATERNAL_HEALTH_MONTHLY`, `period=YYYYMM`, `orgUnit`, `attributeOptionCombo=DEFAULT`, `dataValues[]` avec `value` typé string
- ✅ Mapping `DHIS2_REPORT_MAPPING` (10 dataElements) : `ANC1`, `ANC1_VISIT`, `ANC4_VISIT`, `DEL_FACILITY`, `ANEMIA_SCR`, `ANEMIA_CASE`, `HIV_TEST`, `HIV_POS`, `MAT_DEATH`, `NEO_DEATH` — alignés sur les indicateurs du rapport mensuel
- ✅ Audit trail automatique : action `EXPORT_DHIS2_REPORT` enregistrée dans `audit_logs`
- ✅ Bouton "Export DHIS2 JSON" ajouté à `AdminMonthlyReport.jsx` (à côté Imprimer/PDF et Export CSV)
- ✅ **76/76 tests pytest passent** (70 anciens + 6 nouveaux test_iteration8_dhis2_report.py)



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
