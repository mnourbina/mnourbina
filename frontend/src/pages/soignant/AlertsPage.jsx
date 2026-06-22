import React, { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { AlertTriangle, Bell, CheckCircle2, Eye, Filter, Phone } from "lucide-react";

const SEVERITY_COLORS = {
  CRITICAL: { bg: "bg-[#B83A2E]/10", text: "text-[#B83A2E]", border: "border-[#B83A2E]/40", label: "Critique" },
  WARNING:  { bg: "bg-[#F2C94C]/25", text: "text-[#3E2723]", border: "border-[#F2C94C]/60", label: "À surveiller" },
  INFO:     { bg: "bg-[#4A7C59]/10", text: "text-[#4A7C59]", border: "border-[#4A7C59]/30", label: "Info" },
};

const FILTERS = [
  { id: "all", label: "Toutes" },
  { id: "unread", label: "Non lues" },
  { id: "critical", label: "Critiques" },
  { id: "resolved", label: "Résolues" },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("unread");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/alerts").then(r => setAlerts(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    all: alerts.length,
    unread: alerts.filter(a => !a.is_read).length,
    critical: alerts.filter(a => a.severity === "CRITICAL" && !a.resolved_at).length,
    resolved: alerts.filter(a => !!a.resolved_at).length,
  }), [alerts]);

  const filtered = useMemo(() => alerts.filter(a => {
    if (filter === "all") return true;
    if (filter === "unread") return !a.is_read && !a.resolved_at;
    if (filter === "critical") return a.severity === "CRITICAL" && !a.resolved_at;
    if (filter === "resolved") return !!a.resolved_at;
    return true;
  }), [alerts, filter]);

  const markRead = async (a) => {
    try {
      await api.patch(`/alerts/${a.id}`, { is_read: true });
      load();
    } catch (e) { toast.error("Erreur"); }
  };
  const resolve = async (a) => {
    try {
      await api.patch(`/alerts/${a.id}`, { resolve: true });
      toast.success("Alerte résolue");
      load();
    } catch (e) { toast.error("Erreur"); }
  };

  return (
    <div className="space-y-6" data-testid="alerts-page">
      <header>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#C85A48]">Brique 3 · OMS</span>
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#3E2723] mt-2 flex items-center gap-3">
          <Bell className="text-[#C85A48]" size={28} /> Alertes cliniques
        </h1>
        <p className="mt-2 text-[#795C55]">
          Pré-éclampsie, anémie sévère, BCF anormal, protéinurie élevée — détectées automatiquement à la saisie CPN.
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Total" value={counts.all} color="#795C55" />
        <Kpi label="Non lues" value={counts.unread} color="#C85A48" />
        <Kpi label="Critiques actives" value={counts.critical} color="#B83A2E" icon={AlertTriangle} />
        <Kpi label="Résolues" value={counts.resolved} color="#4A7C59" icon={CheckCircle2} />
      </section>

      <div className="flex flex-wrap gap-2" data-testid="alert-filters">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            data-testid={`alert-filter-${f.id}`}
            className={`inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-medium border transition ${
              filter === f.id
                ? "bg-[#3E2723] text-white border-[#3E2723]"
                : "bg-white text-[#3E2723] border-[#3E2723]/15 hover:bg-[#F7F3EB]"
            }`}
          >
            {filter === f.id && <Filter size={14} />}
            {f.label}
            <span className="text-xs opacity-70">({counts[f.id] ?? 0})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-[#795C55]">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-[#795C55] border border-[#3E2723]/5">
          Aucune alerte ne correspond à ce filtre.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const palette = SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.INFO;
            const created = new Date(a.created_at);
            return (
              <article key={a.id} className={`bg-white rounded-2xl p-5 border-2 ${palette.border} ${a.resolved_at ? "opacity-60" : ""}`} data-testid={`alert-card-${a.id}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl ${palette.bg} flex items-center justify-center shrink-0`}>
                    <AlertTriangle size={18} className={palette.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${palette.bg} ${palette.text}`}>
                        {palette.label}
                      </span>
                      <code className="text-[11px] text-[#795C55] font-mono">{a.type}</code>
                      <span className="text-xs text-[#795C55] ml-auto">{created.toLocaleString("fr-FR")}</span>
                    </div>
                    {a.patient && (
                      <div className="text-sm font-medium text-[#3E2723]">
                        {a.patient.full_name}
                        {a.patient.phone && (
                          <a href={`tel:${a.patient.phone}`} className="ml-3 inline-flex items-center gap-1 text-[#C85A48] text-xs hover:underline">
                            <Phone size={12} /> {a.patient.phone}
                          </a>
                        )}
                      </div>
                    )}
                    <p className="mt-2 text-[#3E2723] leading-relaxed">{a.message}</p>
                    {a.resolved_at && (
                      <p className="mt-2 text-xs text-[#4A7C59] inline-flex items-center gap-1">
                        <CheckCircle2 size={12} /> Résolue le {new Date(a.resolved_at).toLocaleString("fr-FR")}
                      </p>
                    )}
                  </div>
                  {!a.resolved_at && (
                    <div className="flex flex-col gap-2 shrink-0">
                      {!a.is_read && (
                        <button onClick={() => markRead(a)} className="px-3 h-9 rounded-lg text-[#795C55] border border-[#3E2723]/15 hover:bg-[#F7F3EB] inline-flex items-center gap-1 text-xs" data-testid={`alert-read-${a.id}`}>
                          <Eye size={13} /> Lu
                        </button>
                      )}
                      <button onClick={() => resolve(a)} className="px-3 h-9 rounded-lg bg-[#4A7C59] hover:bg-[#3a6448] text-white inline-flex items-center gap-1 text-xs" data-testid={`alert-resolve-${a.id}`}>
                        <CheckCircle2 size={13} /> Résoudre
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, color, icon: Icon }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-[#3E2723]/5">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: color }}>
        {Icon ? <Icon size={16} /> : <Bell size={16} />}
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wider text-[#795C55]">{label}</div>
      <div className="font-heading text-2xl font-semibold text-[#3E2723] mt-0.5">{value}</div>
    </div>
  );
}
