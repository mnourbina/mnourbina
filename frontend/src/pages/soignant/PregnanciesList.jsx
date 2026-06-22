import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import PregnancyCard from "@/components/app/PregnancyCard";
import { calculateGestationalAge, getNextCPNDate } from "@/lib/pregnancyCalc";
import { Activity, AlertTriangle, Filter, Heart, Plus } from "lucide-react";

const FILTERS = [
  { id: "all", label: "Toutes" },
  { id: "active", label: "En cours" },
  { id: "overdue", label: "CPN en retard" },
  { id: "ltfu", label: "Perdues de vue" },
];

export default function PregnanciesList() {
  const [pregnancies, setPregnancies] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/pregnancies").then(r => setPregnancies(r.data)).catch(() => {})
       .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { all: pregnancies.length, active: 0, overdue: 0, ltfu: 0 };
    pregnancies.forEach(p => {
      if (p.status === "perdue_vue") { c.ltfu++; return; }
      if (p.status === "en_cours" || p.status === "active") c.active++;
      const lastN = p.last_cpn?.visit_number || 0;
      const next = getNextCPNDate(p.lmp_date, lastN);
      const nd = next?.date instanceof Date ? next.date : null;
      if (nd && p.status !== "perdue_vue" && (Date.now() - nd.getTime()) / 86400000 > 7) c.overdue++;
    });
    return c;
  }, [pregnancies]);

  const filtered = useMemo(() => {
    return pregnancies.filter(p => {
      if (filter === "all") return true;
      if (filter === "ltfu") return p.status === "perdue_vue";
      if (filter === "active") return ["en_cours", "active"].includes(p.status) && p.status !== "perdue_vue";
      if (filter === "overdue") {
        if (p.status === "perdue_vue") return false;
        const lastN = p.last_cpn?.visit_number || 0;
        const next = getNextCPNDate(p.lmp_date, lastN);
        const nd = next?.date instanceof Date ? next.date : null;
        return nd && (Date.now() - nd.getTime()) / 86400000 > 7;
      }
      return true;
    });
  }, [pregnancies, filter]);

  return (
    <div className="space-y-6" data-testid="pregnancies-list">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#C85A48]">Suivi obstétrical</span>
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#3E2723] mt-2 flex items-center gap-3">
            <Heart className="text-[#C85A48]" size={28} /> Grossesses actives
          </h1>
          <p className="mt-2 text-[#795C55]">Calendrier OMS 8 contacts · alertes automatiques sur les retards de CPN.</p>
        </div>
        <Link to="/app/soignant/patients/new">
          <button className="inline-flex items-center gap-2 bg-[#C85A48] hover:bg-[#B34D3D] text-white px-5 h-11 rounded-xl font-medium">
            <Plus size={18} /> Nouvelle patiente
          </button>
        </Link>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="pregnancies-kpis">
        <Kpi icon={Heart} label="Total" value={counts.all} color="#C85A48" />
        <Kpi icon={Activity} label="En cours" value={counts.active} color="#4A7C59" />
        <Kpi icon={AlertTriangle} label="CPN en retard" value={counts.overdue} color="#F2C94C" textDark />
        <Kpi icon={AlertTriangle} label="Perdues de vue" value={counts.ltfu} color="#B83A2E" />
      </section>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2" data-testid="pregnancies-filters">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            data-testid={`filter-${f.id}`}
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
          Aucune grossesse correspondant à ce filtre.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => <PregnancyCard key={p.id} pregnancy={p} onUpdate={load} />)}
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color, textDark }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-[#3E2723]/5">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color, color: textDark ? "#3E2723" : "white" }}>
        <Icon size={16} />
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wider text-[#795C55]">{label}</div>
      <div className="font-heading text-2xl font-semibold text-[#3E2723] mt-0.5">{value}</div>
    </div>
  );
}
