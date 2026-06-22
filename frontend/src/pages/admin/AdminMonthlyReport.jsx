import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Printer, Download, AlertTriangle, Search, FileBarChart } from "lucide-react";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const YEARS = [2026, 2025, 2024];

export default function AdminMonthlyReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get("/reports/district", { params: { month, year } })
      .then(r => setReport(r.data))
      .finally(() => setLoading(false));
  }, [month, year]);

  if (loading || !report) return <div className="text-[#795C55]">Génération du rapport…</div>;

  const ind = report.indicators;
  const cr = report.coverageRates;
  const tg = report.targets;

  const cards = [
    { dhis2: "ANC_Registered", label: "Femmes enceintes suivies", value: ind.totalPregnancies },
    { dhis2: "ANC1_Visits", label: "CPN1 réalisées", value: ind.cpn1, rate: cr.cpn1 },
    { dhis2: "ANC4_Visits", label: "CPN4 complétées", value: ind.cpn4, rate: cr.cpn4 },
    { dhis2: "Deliveries_Facility", label: "Accouchements assistés", value: ind.assistedBirths, rate: cr.assistedBirth },
    { dhis2: "Anemia_Screened", label: "Dépistage anémie", value: ind.anemiaScreened },
    { dhis2: "Anemia_Cases", label: "Cas anémie Hb<11", value: ind.anemiaCases },
    { dhis2: "HIV_Tested", label: "Tests VIH réalisés", value: ind.hivTested },
    { dhis2: "HIV_Positive", label: "VIH+ détectés", value: ind.hivPositive },
    { dhis2: "Maternal_Deaths", label: "Décès maternels", value: ind.maternalDeaths },
    { dhis2: "Neonatal_Deaths", label: "Décès néonatals", value: ind.neonatalDeaths },
  ];

  const rateColor = (r) => r >= 80 ? "text-[#4A7C59]" : r >= 60 ? "text-[#D99A5A]" : "text-[#B83A2E]";
  const pendingAudits = ind.maternalDeaths - ind.auditsCompleted;
  const auditRate = ind.maternalDeaths > 0 ? (ind.auditsCompleted / ind.maternalDeaths * 100) : null;

  return (
    <div className="space-y-6 print:p-0" data-testid="admin-monthly-report">
      <header className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#C85A48]">Rapport mensuel</span>
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#3E2723] mt-2 flex items-center gap-3">
            <FileBarChart className="text-[#C85A48]" size={28} /> Rapport district {MONTHS[month-1]} {year}
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 bg-[#C85A48] hover:bg-[#B34D3D] text-white px-4 h-11 rounded-xl font-medium" data-testid="print-btn">
            <Printer size={16} /> Imprimer / PDF
          </button>
          <button onClick={async () => {
            const blob = await api.get("/analytics/dhis2-indicators/export.csv", { params: { period: `${year}${String(month).padStart(2,'0')}` }, responseType: "blob" }).then(r => r.data);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `district_${year}${String(month).padStart(2,'0')}.csv`; a.click();
          }} className="inline-flex items-center gap-2 bg-[#3E2723] hover:bg-[#2a1c1a] text-white px-4 h-11 rounded-xl font-medium" data-testid="export-dhis2-btn">
            <Download size={16} /> Export CSV
          </button>
          <button onClick={async () => {
            const { data } = await api.get("/reports/dhis2", { params: { month, year } });
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
            const a = document.createElement("a");
            a.href = url; a.download = `DHIS2_District_${month}_${year}.json`; a.click();
          }} className="inline-flex items-center gap-2 bg-[#4A7C59] hover:bg-[#3a6448] text-white px-4 h-11 rounded-xl font-medium" data-testid="export-dhis2-json-btn">
            <Download size={16} /> Export DHIS2 JSON
          </button>
        </div>
      </header>

      <section className="flex gap-3 print:hidden" data-testid="report-filters">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="h-11 rounded-xl bg-white max-w-[200px]" data-testid="month-select"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="h-11 rounded-xl bg-white max-w-[120px]" data-testid="year-select"><SelectValue /></SelectTrigger>
          <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </section>

      {pendingAudits > 0 && (
        <div className="bg-[#B83A2E]/10 border-l-4 border-[#B83A2E] rounded-xl p-4 flex items-center gap-3" data-testid="alert-pending-audits">
          <AlertTriangle className="text-[#B83A2E]" size={20} />
          <div className="text-[#3E2723] text-sm">
            <strong>{pendingAudits} décès maternel{pendingAudits > 1 ? "s" : ""}</strong> en attente d'audit MPDSR ce mois.
          </div>
        </div>
      )}
      {report.ltfuCount > 0 && (
        <div className="bg-[#F2C94C]/25 border-l-4 border-[#D99A5A] rounded-xl p-4 flex items-center gap-3" data-testid="alert-ltfu">
          <Search className="text-[#D99A5A]" size={20} />
          <div className="text-[#3E2723] text-sm">
            <strong>{report.ltfuCount} femme{report.ltfuCount > 1 ? "s" : ""} enceinte{report.ltfuCount > 1 ? "s" : ""}</strong> perdue{report.ltfuCount > 1 ? "s" : ""} de vue ce mois.
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="indicator-cards">
        {cards.map(c => (
          <div key={c.dhis2} className="bg-white rounded-2xl p-4 border border-[#3E2723]/5 shadow-sm">
            <code className="text-[10px] uppercase tracking-wider text-[#795C55] font-mono">{c.dhis2}</code>
            <div className="font-heading text-2xl font-semibold text-[#3E2723] mt-2">{c.value}</div>
            <div className="text-xs text-[#795C55] mt-1 leading-tight">{c.label}</div>
            {c.rate !== undefined && (
              <div className={`font-heading text-lg font-semibold mt-2 ${rateColor(c.rate)}`}>{c.rate.toFixed(1)}%</div>
            )}
          </div>
        ))}
      </section>

      <section className="bg-white rounded-2xl border border-[#3E2723]/5 overflow-hidden" data-testid="targets-table">
        <div className="px-6 py-4 border-b border-[#3E2723]/5">
          <h2 className="font-heading text-lg font-semibold text-[#3E2723]">Cibles OMS · Écart de couverture</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F7F3EB]">
            <tr className="text-left text-xs uppercase tracking-wider text-[#795C55]">
              <th className="px-6 py-3">Indicateur</th>
              <th className="px-6 py-3 text-center">Valeur</th>
              <th className="px-6 py-3 text-center">Cible OMS</th>
              <th className="px-6 py-3 text-center">Écart</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3E2723]/5">
            <TargetRow label="CPN1 — Couverture 1er contact" value={cr.cpn1} target={tg.cpn1} />
            <TargetRow label="CPN4 — Couverture 4 contacts" value={cr.cpn4} target={tg.cpn4} />
            <TargetRow label="Accouchements assistés en formation sanitaire" value={cr.assistedBirth} target={tg.assistedBirth} />
            <TargetRow label="Audit décès maternels (<30 j)" value={auditRate} target={tg.auditCoverage} naIfNull />
          </tbody>
        </table>
      </section>
    </div>
  );
}

function TargetRow({ label, value, target, naIfNull }) {
  const isNA = naIfNull && (value === null || value === undefined);
  const gap = isNA ? null : (target - (value || 0));
  return (
    <tr>
      <td className="px-6 py-3 text-[#3E2723]">{label}</td>
      <td className="px-6 py-3 text-center font-medium">{isNA ? "N/A" : `${(value || 0).toFixed(1)}%`}</td>
      <td className="px-6 py-3 text-center text-[#795C55]">{target}%</td>
      <td className={`px-6 py-3 text-center font-semibold ${isNA ? "text-[#795C55]" : gap <= 0 ? "text-[#4A7C59]" : gap < 10 ? "text-[#D99A5A]" : "text-[#B83A2E]"}`}>
        {isNA ? "—" : (gap <= 0 ? "Atteint" : `-${gap.toFixed(1)} pts`)}
      </td>
    </tr>
  );
}
