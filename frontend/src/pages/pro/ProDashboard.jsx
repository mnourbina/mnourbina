import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Users, AlertTriangle, Activity, TrendingUp, Search, ArrowRight } from "lucide-react";

const NAV = [
  { to: "/portail/pro", label: "Tableau de bord", end: true },
  { to: "/portail/pro/patientes", label: "Patientes" },
];

export default function ProDashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/kpis"),
      api.get("/alerts?resolved=false"),
      api.get("/patients?limit=8"),
    ]).then(([k, a, p]) => {
      setKpis(k.data); setAlerts(a.data); setPatients(p.data);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <Layout title="Espace professionnel" nav={NAV}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">{user?.role === "midwife" ? "Sage-femme" : "Gynecologue"}</p>
          <h1 className="font-display text-3xl font-bold text-foreground">Bonjour, {user?.name}</h1>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); window.location.href = `/portail/pro/patientes?q=${encodeURIComponent(search)}`; }}
          className="relative w-full sm:w-80"
        >
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            data-testid="pro-quick-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une patiente..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </form>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Users, label: "Patientes suivies", value: kpis?.total_patients ?? "-", color: "text-primary bg-primary/10" },
          { icon: Activity, label: "Grossesses actives", value: kpis?.active_pregnancies ?? "-", color: "text-[#2D7D46] bg-[#2D7D46]/10" },
          { icon: TrendingUp, label: "Taux CPN4", value: kpis ? `${kpis.cpn4_rate}%` : "-", color: "text-[#E59500] bg-[#E59500]/10" },
          { icon: AlertTriangle, label: "Alertes actives", value: alerts.length, color: "text-destructive bg-destructive/10" },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white border border-border rounded-xl p-5" data-testid={`kpi-${c.label.replace(/\s/g, "-")}`}>
              <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${c.color}`}><Icon size={18} /></span>
              <p className="font-display text-3xl font-bold text-foreground mt-3">{loading ? "..." : c.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Patient list quick view */}
        <div className="lg:col-span-2 bg-white border border-border rounded-xl">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Mes patientes recentes</h2>
            <Link to="/portail/pro/patientes" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1" data-testid="pro-see-all-patients">
              Voir toutes <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {patients.length === 0 && !loading && <p className="p-5 text-sm text-muted-foreground">Aucune patiente.</p>}
            {patients.map(p => (
              <Link
                key={p.id}
                to={`/portail/pro/patientes/${p.id}`}
                className="flex items-center justify-between p-4 hover:bg-secondary/40 transition-colors"
                data-testid={`pro-patient-row-${p.id}`}
              >
                <div>
                  <p className="font-semibold text-foreground">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-muted-foreground">{p.age} ans · {p.phone}</p>
                </div>
                <div className="flex items-center gap-3">
                  {p.risk_score >= 4 && (
                    <span className="text-xs px-2 py-1 rounded-md bg-destructive/10 text-destructive font-semibold">Risque eleve</span>
                  )}
                  <ArrowRight size={16} className="text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white border border-border rounded-xl">
          <div className="p-5 border-b border-border">
            <h2 className="font-display text-lg font-bold flex items-center gap-2"><AlertTriangle size={16} className="text-destructive" /> Alertes</h2>
          </div>
          <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
            {alerts.length === 0 && !loading && <p className="p-5 text-sm text-muted-foreground">Aucune alerte active.</p>}
            {alerts.slice(0, 12).map(a => (
              <div key={a.id} className="p-4" data-testid={`pro-alert-${a.id}`}>
                <div className="flex items-start gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full mt-2 flex-shrink-0 ${a.severity === "urgent" ? "bg-destructive" : "bg-[#E59500]"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{a.message}</p>
                    <Link to={`/portail/pro/patientes/${a.patient_id}`} className="text-xs text-primary hover:underline">Voir la patiente</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
