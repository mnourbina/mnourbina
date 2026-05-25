import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { LineChart, Line, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Users, HeartPulse, Syringe, AlertTriangle } from "lucide-react";

const NAV = [
  { to: "/portail/admin", label: "Tableau de bord", end: true },
  { to: "/portail/admin/mpdsr", label: "Audits MPDSR" },
  { to: "/portail/admin/sync", label: "Synchronisation" },
  { to: "/portail/admin/utilisateurs", label: "Utilisateurs" },
  { to: "/portail/admin/exports", label: "Exports" },
];

const COLORS = ["#A95C42", "#2D7D46", "#FFB300", "#D49B7A", "#3E2720"];

export default function AdminDashboard() {
  const [kpis, setKpis] = useState(null);
  const [trend, setTrend] = useState([]);
  const [vaccineCov, setVaccineCov] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/kpis"),
      api.get("/dashboard/coverage-trend"),
      api.get("/dashboard/vaccine-coverage"),
    ]).then(([k, t, v]) => {
      setKpis(k.data); setTrend(t.data); setVaccineCov(v.data);
    }).finally(() => setLoading(false));
  }, []);

  const indicators = kpis ? [
    { label: "Nouvelles grossesses (30j)", value: kpis.new_pregnancies, format: (n) => n },
    { label: "Grossesses actives", value: kpis.active_pregnancies, format: (n) => n },
    { label: "Taux CPN1", value: kpis.cpn1_rate, format: (n) => `${n}%` },
    { label: "Taux CPN4", value: kpis.cpn4_rate, format: (n) => `${n}%` },
    { label: "Taux CPN8", value: kpis.cpn8_rate, format: (n) => `${n}%` },
    { label: "CPN1 precoce (<12 SA)", value: kpis.cpn1_early_rate, format: (n) => `${n}%` },
    { label: "Grossesses a risque", value: kpis.at_risk_rate, format: (n) => `${n}%` },
    { label: "Accouchements", value: kpis.institutional_deliveries, format: (n) => n },
    { label: "Taux cesarienne", value: kpis.cesarean_rate, format: (n) => `${n}%` },
    { label: "References obstetricales", value: kpis.obstetric_referrals, format: (n) => n },
    { label: "Couverture VAT mere", value: kpis.maternal_vat_coverage, format: (n) => `${n}%` },
    { label: "Couverture BCG", value: kpis.child_bcg_coverage, format: (n) => `${n}%` },
    { label: "Couverture Penta3", value: kpis.child_penta3_coverage, format: (n) => `${n}%` },
    { label: "Faible poids naissance", value: kpis.low_birth_weight_rate, format: (n) => `${n}%` },
    { label: "Dossiers complets", value: kpis.complete_records_rate, format: (n) => `${n}%` },
    { label: "Perdues de vue", value: kpis.lost_to_followup_rate, format: (n) => `${n}%` },
    { label: "Deces maternels", value: kpis.maternal_deaths, format: (n) => n },
    { label: "Deces neonataux", value: kpis.neonatal_deaths, format: (n) => n },
    { label: "Total patientes", value: kpis.total_patients, format: (n) => n },
  ] : [];

  return (
    <Layout title="Administration" nav={NAV}>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Tableau de bord</p>
        <h1 className="font-display text-3xl font-bold text-foreground">Indicateurs cles</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble du programme materno-infantile.</p>
      </div>

      {loading ? <p className="text-muted-foreground">Chargement...</p> : (
        <>
          {/* Headline cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <HeadlineCard icon={Users} color="text-primary bg-primary/10" label="Patientes" value={kpis.total_patients} />
            <HeadlineCard icon={HeartPulse} color="text-[#2D7D46] bg-[#2D7D46]/10" label="Grossesses actives" value={kpis.active_pregnancies} />
            <HeadlineCard icon={Syringe} color="text-[#E59500] bg-[#E59500]/10" label="Couverture VAT" value={`${kpis.maternal_vat_coverage}%`} />
            <HeadlineCard icon={AlertTriangle} color="text-destructive bg-destructive/10" label="Risque eleve" value={`${kpis.at_risk_rate}%`} />
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-5 mb-6">
            <div className="bg-white border border-border rounded-xl p-5" data-testid="chart-cpn-trend">
              <h3 className="font-display font-bold mb-1">Tendance CPN — 6 derniers mois</h3>
              <p className="text-xs text-muted-foreground mb-4">Pourcentage de grossesses avec >= N contacts</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E1D8" />
                  <XAxis dataKey="month" stroke="#5C6B62" fontSize={12} />
                  <YAxis stroke="#5C6B62" fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="cpn1" stroke="#A95C42" strokeWidth={2.5} name="CPN1" />
                  <Line type="monotone" dataKey="cpn4" stroke="#2D7D46" strokeWidth={2.5} name="CPN4" />
                  <Line type="monotone" dataKey="cpn8" stroke="#FFB300" strokeWidth={2.5} name="CPN8" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white border border-border rounded-xl p-5" data-testid="chart-vaccine-coverage">
              <h3 className="font-display font-bold mb-1">Couverture vaccinale par antigene</h3>
              <p className="text-xs text-muted-foreground mb-4">Taux d'administration (%)</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={vaccineCov}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E1D8" />
                  <XAxis dataKey="code" stroke="#5C6B62" fontSize={11} />
                  <YAxis stroke="#5C6B62" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="rate" fill="#A95C42" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 19 indicators bento */}
          <h2 className="font-display text-xl font-bold mb-3">Les 19 indicateurs</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {indicators.map((ind, i) => (
              <div key={ind.label} className="bg-white border border-border rounded-lg p-4" data-testid={`indicator-${i}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight">{ind.label}</p>
                <p className="font-display text-2xl font-bold text-foreground mt-2">{ind.format(ind.value)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}

function HeadlineCard({ icon: Icon, color, label, value }) {
  return (
    <div className="bg-white border border-border rounded-xl p-5">
      <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${color}`}><Icon size={18} /></span>
      <p className="font-display text-3xl font-bold text-foreground mt-3">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
