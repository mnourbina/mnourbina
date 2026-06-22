import React, { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import api, { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Download, FileJson, Copy, FileText, Activity, Loader2 } from "lucide-react";

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function defaultPeriod() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminIndicators() {
  const [data, setData] = useState(null);
  const [zones, setZones] = useState([]);
  const [zoneId, setZoneId] = useState("");
  const [period, setPeriod] = useState(defaultPeriod());
  const [loading, setLoading] = useState(false);
  const [jsonPreview, setJsonPreview] = useState(null);

  const fetchIndicators = async () => {
    setLoading(true);
    try {
      const params = { period };
      if (zoneId) params.zone_id = zoneId;
      const { data } = await api.get("/analytics/dhis2-indicators", { params });
      setData(data);
      setZones(data.zones);
    } catch (e) {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIndicators(); }, [zoneId, period]);

  const downloadCsv = async () => {
    try {
      const params = new URLSearchParams({ period });
      if (zoneId) params.set("zone_id", zoneId);
      const resp = await fetch(`${API_BASE}/analytics/dhis2-indicators/export.csv?${params.toString()}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Download failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `khalaba_dhis2_${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } catch (e) { toast.error("Échec téléchargement CSV"); }
  };

  const previewJson = async () => {
    try {
      const params = { period };
      if (zoneId) params.zone_id = zoneId;
      const { data } = await api.get("/analytics/dhis2-export", { params });
      setJsonPreview(data);
      toast.success("Payload DHIS2 généré · audit log enregistré");
    } catch (e) {
      const msg = e.response?.data?.detail || "Erreur";
      toast.error(typeof msg === "string" ? msg : "Erreur");
    }
  };

  const downloadJson = async () => {
    await previewJson();
    if (!jsonPreview) {
      try {
        const params = { period };
        if (zoneId) params.zone_id = zoneId;
        const { data } = await api.get("/analytics/dhis2-export", { params });
        triggerJsonDownload(data);
      } catch (e) { toast.error("Erreur"); }
    } else {
      triggerJsonDownload(jsonPreview);
    }
  };

  const triggerJsonDownload = (payload) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `khalaba_dhis2_${payload.period}_${payload.orgUnit || "national"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON DHIS2 téléchargé");
  };

  const copyJson = async () => {
    if (!jsonPreview) await previewJson();
    const payload = jsonPreview;
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success("Payload copié dans le presse-papiers");
    } catch (e) { toast.error("Copie impossible"); }
  };

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.indicators.map(i => ({ name: i.code.replace("DE_", ""), value: i.value }));
  }, [data]);

  return (
    <div className="space-y-6" data-testid="admin-indicators">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#C85A48]">DHIS2 · Ministère de la Santé Publique</span>
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#3E2723] mt-2 flex items-center gap-3">
            <Activity className="text-[#C85A48]" size={28} /> 10 Indicateurs MSP couverts
          </h1>
          <p className="mt-2 text-[#795C55]">Données KHALABA agrégées au format DHIS2 DataValueSet — prêtes pour l'API du Ministère.</p>
        </div>
      </header>

      {/* Filters */}
      <section className="bg-white rounded-2xl p-5 border border-[#3E2723]/5 grid sm:grid-cols-3 gap-4" data-testid="indicators-filters">
        <div>
          <Label className="text-sm text-[#795C55] mb-1 block">Période (YYYYMM)</Label>
          <Input
            value={period}
            onChange={(e) => setPeriod(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="202610"
            className="h-11 rounded-xl"
            data-testid="period-input"
          />
          <div className="text-xs text-[#795C55] mt-1">
            {period.length === 6 ? `${MONTHS_FR[parseInt(period.slice(4))-1] || "?"} ${period.slice(0,4)}` : "Format YYYYMM"}
          </div>
        </div>
        <div>
          <Label className="text-sm text-[#795C55] mb-1 block">Zone (orgUnit)</Label>
          <Select value={zoneId || "ALL"} onValueChange={(v) => setZoneId(v === "ALL" ? "" : v)}>
            <SelectTrigger className="h-11 rounded-xl" data-testid="zone-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes zones (National)</SelectItem>
              {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={downloadCsv} variant="outline" className="rounded-xl h-11 border-[#3E2723]/15" data-testid="export-csv-btn">
            <FileText size={16} /> CSV
          </Button>
          <Button onClick={previewJson} className="bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl h-11" data-testid="export-json-btn">
            <FileJson size={16} /> JSON DHIS2
          </Button>
        </div>
      </section>

      {/* Indicators table */}
      <section className="bg-white rounded-2xl border border-[#3E2723]/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#3E2723]/5 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-[#3E2723]">Tableau des indicateurs</h2>
          {loading && <Loader2 size={16} className="animate-spin text-[#795C55]" />}
        </div>
        {data ? (
          <table className="w-full" data-testid="indicators-table">
            <thead className="bg-[#F7F3EB]">
              <tr className="text-left text-xs uppercase tracking-wider text-[#795C55]">
                <th className="px-6 py-3">Indicateur DHIS2</th>
                <th className="px-6 py-3">Source Khalaba</th>
                <th className="px-6 py-3">Code</th>
                <th className="px-6 py-3 text-right">Valeur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3E2723]/5">
              {data.indicators.map(i => (
                <tr key={i.code} className="text-sm" data-testid={`indicator-row-${i.code}`}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-[#3E2723]">{i.label}</div>
                    <div className="text-xs text-[#795C55]">{i.category}</div>
                  </td>
                  <td className="px-6 py-4 text-[#795C55] font-mono text-xs">{i.formula}</td>
                  <td className="px-6 py-4">
                    <code className="text-[11px] px-2 py-1 rounded bg-[#3E2723]/5 text-[#3E2723] font-mono">{i.code}</code>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-heading text-xl font-semibold text-[#C85A48]" data-testid={`indicator-value-${i.code}`}>{i.value}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-10 text-center text-[#795C55]">Chargement…</div>
        )}
      </section>

      {/* Chart */}
      {data && (
        <section className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
          <h3 className="font-heading text-lg font-semibold text-[#3E2723] mb-5">Distribution des indicateurs</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 50, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(62,39,35,0.08)" />
                <XAxis dataKey="name" tick={{ fill: "#795C55", fontSize: 11 }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fill: "#795C55", fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid rgba(62,39,35,0.1)", borderRadius: 12 }} />
                <Bar dataKey="value" fill="#C85A48" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* JSON preview */}
      {jsonPreview && (
        <section className="bg-[#3E2723] rounded-2xl p-6 text-[#F7F3EB]" data-testid="json-preview">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold text-[#F2C94C] flex items-center gap-2">
              <FileJson size={18} /> Payload DHIS2 DataValueSet
            </h3>
            <div className="flex gap-2">
              <button onClick={copyJson} className="inline-flex items-center gap-2 px-3 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm" data-testid="copy-json-btn">
                <Copy size={14} /> Copier
              </button>
              <button onClick={() => triggerJsonDownload(jsonPreview)} className="inline-flex items-center gap-2 px-3 h-9 rounded-lg bg-[#F2C94C] hover:bg-[#F2C94C]/80 text-[#3E2723] text-sm font-medium" data-testid="download-json-btn">
                <Download size={14} /> Télécharger .json
              </button>
            </div>
          </div>
          <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono text-[#F7F3EB]/90 leading-relaxed">
            {JSON.stringify(jsonPreview, null, 2)}
          </pre>
          <p className="mt-4 text-xs text-[#F7F3EB]/60">
            Ce payload est conforme au format <code>DataValueSet</code> de DHIS2. Il peut être envoyé tel quel à <code>POST {`{DHIS2_URL}`}/api/dataValueSets</code> par le Ministère.
          </p>
        </section>
      )}
    </div>
  );
}
