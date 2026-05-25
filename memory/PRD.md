# Khalaba — PRD (Product Requirements Document)

## Problem statement (original)
> Tu es un expert qui verifie 2 fois, tu es sceptique et tu fais tes recherches. Je n'ai pas toujours raison, toi non plus. Et on cherche tous les deux la precision. Analyse ce projet qui est cher pour moi pour construire une application qui revolutionner la pratique de la sante materno-infantile en afrique subsaharien, une application complet, technique pour les professionnels, avec base des donnees exploitable et extractables pour les admins et tres facile a utiliser pour les patientes.

## Architecture references
1. `khalaba-architecture.docx` — May 2026 — technical architecture (Next.js+Postgres reference; adapted to React+FastAPI+MongoDB)
2. `KHALABA_Dossier_D_Investissement_Et_Guide_Technique.docx` — Investment dossier with branding, clinical OMS protocols, and strategic pillars (Direct Channel, Sectorisation, Offline-First)

## MVP delivered stack
- **Backend**: FastAPI + Motor (MongoDB) — single `server.py`
- **Frontend**: React 19 + React Router v7 + Tailwind + Shadcn UI
- **Auth**: JWT Bearer (email + password, bcrypt) — SMS OTP deferred to V2
- **Language**: French only — EN/AR deferred to V2

## User personas
1. **Patiente** (low-literacy, mobile-first) — appointments, vaccines, alerts, danger signs
2. **Sage-femme** — primary CPN clinician, sectorisee
3. **Gynecologue** — referrals receiver, advanced clinical decisions, audits
4. **Administrateur (MSPP/programme)** — dashboards, exports, user/zone management, MPDSR

## Strategic pillars (from the investment dossier)
1. **Canal direct sage-femme / patiente** — confirmation RDV, decalage, conseil medical, signalement de signes de danger. Tous les echanges sont traces.
2. **Sectorisation / Zone de responsabilite** — cloisonnement geographique strict. Sage-femme ne voit que sa zone. References filtrees par zone.
3. **Resilience offline-first** — saisie en zone blanche (V2, PWA cache prevu).

## Visual identity (official)
- Palette: Terracotta #A95C42 / Ocre #D49B7A / Sable #F9F5F0 / Chocolat #3E2720 / Or #FFB300
- Typo: Outfit (display) + Manrope (body)
- Logo: silhouette mere+bebe formant un K, coeur d'or au centre

## What's been implemented (2026-02 & 2026-05)
- Auth JWT (login, /me, /admin/users) + 4 roles + RBAC
- Zones (3 zones TD: N'Djamena, Logone Occidental, Ouaddai) + Facilities (3) + Khalaba-ID unique par patiente
- Patients CRUD + scoping par zone (cloisonnement)
- Pregnancies + auto EDD + risk scoring
- CPN 1-8 with 7 sections (general, clinical, biology incl. Hepatite B, prevention incl. deparasitage, vaccination, education, danger signs, decision)
- Auto-alerts: HTA, perte de poids >5%, anemie/anemie severe, proteinurie, hepatite B+, VIH+, syphilis+, signes de danger
- Complications module (diabete gestationnel, HTA gravidique, anemie severe, MAP, placenta praevia, ...)
- Postnatal en 3 etapes (6h / 6j / 6s) avec surveillance mere & nouveau-ne + alertes (HPP, ictere, sepsis, depression PP)
- Newborn record + auto detection LBW
- MPDSR (audit des deces maternels et neonataux) — declaration, statut, recommandations comite
- Canal direct sage-femme/patiente (logue : channel, direction, motif, notes)
- Vaccines: mother schedule (VAT1-5) + child schedule (BCG, VPO, Penta, PCV, Rota, RR, Fievre Jaune), administer endpoint
- Dashboard KPIs (19 indicateurs + couvertures postnatales reelles + deces depuis MPDSR)
- CSV exports: patients, pregnancies, cpn
- 3 portails (Patient / Pro / Admin) avec navigation Admin: Dashboard / MPDSR / Utilisateurs / Exports
- Landing page revisitee: statistiques chocs Tchad (748-856/100k mortalite maternelle), narratif Medecin Chef de District, 3 piliers strategiques
- Demo seed enrichi: 3 zones, 3 facilities, 1 admin, 1 gyno, 2 midwives, 1 patient user, 12 patients, 8 pregnancies actives + 2 grossesses delivered (avec newborn + postnatal step 1+2), 2 complications seedees, 1 death audit MPDSR

## Demo accounts
See `/app/memory/test_credentials.md`.

## Prioritized backlog
### P0 (next iteration)
- Offline-first PWA cache (IndexedDB) + bandeau "Mode hors-ligne active"
- Document PDF generation (CPN sheet, referral form, MPDSR report)
- Referrals module (creation + reception + filtres gynecos par zone)

### P1
- DHIS2 export connector UI
- SMS notifications (Africa's Talking) for appointment reminders
- Audit log writer wired across endpoints
- I18n: English + Arabic with RTL
- Configurable vaccine schedule per country (admin)

### P2
- React Native mobile app
- Score risque ML
- Teleconsultation
- Integration laboratoire/echographie HL7 FHIR
- Agents de sante communautaires (role + formulaires simplifies)
- Integration paiement mobile (MoMo, Airtel Money)
