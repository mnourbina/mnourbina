import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Calendar, Heart, Syringe, AlertTriangle, BookOpen, CheckCircle2 } from "lucide-react";

const NAV = [
  { to: "/portail/patiente", label: "Accueil", end: true },
  { to: "/portail/patiente/vaccins", label: "Vaccins" },
];

const DANGER_SIGNS = [
  "Saignements vaginaux",
  "Maux de tete severes ou troubles visuels",
  "Oedemes du visage ou des mains",
  "Convulsions",
  "Fievre elevee",
  "Diminution des mouvements du bebe",
];

export default function PatientDashboard() {
  const { user } = useAuth();
  const [pregnancy, setPregnancy] = useState(null);
  const [nextCpn, setNextCpn] = useState(null);
  const [vaccines, setVaccines] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.patient_id) { setLoading(false); return; }
      try {
        const [pregsRes, vaccinesRes, alertsRes] = await Promise.all([
          api.get(`/pregnancies?patient_id=${user.patient_id}`),
          api.get(`/vaccines?patient_id=${user.patient_id}`),
          api.get(`/alerts?resolved=false`),
        ]);
        if (!active) return;
        const preg = pregsRes.data.find(p => p.status === "active") || pregsRes.data[0];
        setPregnancy(preg);
        setVaccines(vaccinesRes.data);
        setAlerts(alertsRes.data);
        if (preg) {
          const cpnRes = await api.get(`/cpn?pregnancy_id=${preg.id}`);
          const last = cpnRes.data[cpnRes.data.length - 1];
          if (last?.next_appointment) setNextCpn(last.next_appointment);
        }
      } catch (e) {
        // silent
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  const upcomingVaccines = vaccines.filter(v => v.status !== "administered").slice(0, 3);

  return (
    <Layout title="Mon espace" nav={NAV}>
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Bonjour</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground" data-testid="patient-welcome">
          {user?.name?.split(" ")[0] || "Bienvenue"}
        </h1>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Chargement...</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {/* Hero: next appointment */}
          <div className="md:col-span-2 bg-primary text-primary-foreground rounded-3xl p-7 sm:p-9 shadow-lg" data-testid="patient-next-rdv-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest opacity-90 mb-3">
                  <Calendar size={14} /> Mon prochain rendez-vous
                </div>
                {nextCpn ? (
                  <>
                    <p className="font-display text-3xl sm:text-4xl font-bold leading-tight">
                      {new Date(nextCpn).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    <p className="text-sm opacity-90 mt-3">Consultation prenatale a votre centre de sante.</p>
                  </>
                ) : (
                  <p className="font-display text-2xl font-bold">Aucun rendez-vous programme pour le moment.</p>
                )}
              </div>
              <Heart className="opacity-30" size={56} />
            </div>
          </div>

          {/* Pregnancy info */}
          {pregnancy && (
            <div className="bg-white border border-border rounded-2xl p-6" data-testid="patient-pregnancy-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Ma grossesse</p>
              <p className="font-display text-4xl font-bold text-foreground">{pregnancy.gestational_age_weeks} SA</p>
              <p className="text-sm text-muted-foreground mt-2">Date prevue d'accouchement</p>
              <p className="font-display text-lg font-semibold text-foreground">
                {new Date(pregnancy.expected_delivery_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          )}

          {/* Upcoming vaccines */}
          <div className="bg-white border border-border rounded-2xl p-6" data-testid="patient-vaccines-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Vaccins a venir</p>
              <Link to="/portail/patiente/vaccins" className="text-xs font-semibold text-primary hover:underline">Voir tout</Link>
            </div>
            {upcomingVaccines.length ? (
              <ul className="space-y-3">
                {upcomingVaccines.map(v => (
                  <li key={v.id} className="flex items-start gap-3" data-testid={`patient-vaccine-row-${v.vaccine_code}`}>
                    <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center flex-shrink-0"><Syringe size={16} /></span>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{v.vaccine_label}</p>
                      <p className="text-xs text-muted-foreground">Prevu le {new Date(v.scheduled_date).toLocaleDateString("fr-FR")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground py-3">Aucun vaccin a venir <CheckCircle2 className="inline ml-1" size={14} /></p>
            )}
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="md:col-span-2 bg-destructive/5 border border-destructive/20 rounded-2xl p-6" data-testid="patient-alerts-card">
              <p className="text-xs font-semibold uppercase tracking-widest text-destructive mb-3 flex items-center gap-2"><AlertTriangle size={14} /> A surveiller</p>
              <ul className="space-y-2">
                {alerts.slice(0, 4).map(a => (
                  <li key={a.id} className="text-sm text-foreground" data-testid={`patient-alert-${a.id}`}>· {a.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Danger signs */}
          <div className="md:col-span-2 bg-secondary rounded-2xl p-6" data-testid="patient-danger-signs">
            <p className="text-xs font-semibold uppercase tracking-widest text-foreground mb-3 flex items-center gap-2"><BookOpen size={14} /> Si vous ressentez l'un de ces signes, allez immediatement au centre de sante</p>
            <ul className="grid sm:grid-cols-2 gap-2 mt-2">
              {DANGER_SIGNS.map((d) => (
                <li key={d} className="flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Layout>
  );
}
