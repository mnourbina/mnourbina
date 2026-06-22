import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Search, RefreshCw, Phone, MapPin, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export default function AdminLTFUPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/ltfu");
      setCases(data);
    } catch (e) {
      toast.error("Erreur lors du chargement des perdues de vue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runScan = async () => {
    setScanning(true);
    try {
      const { data } = await api.post("/admin/check-ltfu");
      setLastScan(data);
      toast.success(
        `Scan terminé — ${data.flagged_count} cas ouverts, ${data.newly_flagged.length} nouvelles détections`
      );
      await load();
    } catch (e) {
      toast.error("Erreur lors du scan");
    } finally {
      setScanning(false);
    }
  };

  const markFound = async (pregnancyId) => {
    try {
      await api.post(`/pregnancies/${pregnancyId}/found`, { notes: "Patiente retrouvée à domicile" });
      toast.success("Patiente marquée retrouvée");
      setCases(cs => cs.filter(c => c.pregnancy_id !== pregnancyId));
    } catch (e) {
      toast.error("Erreur");
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-ltfu-page">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#C85A48]">Suivi communautaire</span>
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#3E2723] mt-2 flex items-center gap-3">
            <Search size={28} /> Perdues de vue
          </h1>
          <p className="mt-2 text-[#795C55] max-w-2xl">
            Détection automatique des grossesses dont le calendrier OMS est en retard de plus de 2 semaines.
            Scan quotidien automatique à 07:00 — ou lancement manuel ci-contre.
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="bg-[#C85A48] hover:bg-[#B34D3D] disabled:opacity-50 text-white px-5 py-3 rounded-xl font-medium inline-flex items-center gap-2"
          data-testid="ltfu-scan-btn"
        >
          <RefreshCw size={16} className={scanning ? "animate-spin" : ""} />
          {scanning ? "Scan en cours…" : "Lancer un scan"}
        </button>
      </header>

      {lastScan && (
        <div className="bg-white rounded-xl border border-[#3E2723]/5 p-4 text-sm flex items-center gap-3 flex-wrap" data-testid="ltfu-last-scan">
          <span className="inline-flex items-center gap-1.5 text-[#795C55]">
            <Clock size={14} /> Dernier scan : {new Date(lastScan.scanned_at).toLocaleString("fr-FR")}
          </span>
          <span className="px-2 py-0.5 bg-[#F2C94C]/30 text-[#3E2723] rounded-full text-xs font-medium">
            {lastScan.flagged_count} cas ouverts
          </span>
          <span className="px-2 py-0.5 bg-[#B83A2E]/10 text-[#B83A2E] rounded-full text-xs font-medium">
            +{lastScan.newly_flagged.length} nouvelles détections
          </span>
        </div>
      )}

      {loading ? (
        <div className="text-[#795C55]">Chargement…</div>
      ) : cases.length === 0 ? (
        <div className="bg-[#4A7C59]/10 border border-[#4A7C59]/30 rounded-2xl p-8 text-center" data-testid="ltfu-empty">
          <CheckCircle2 size={36} className="text-[#4A7C59] mx-auto mb-3" />
          <h3 className="font-heading text-lg font-semibold text-[#3E2723]">
            Aucune perdue de vue en cours
          </h3>
          <p className="text-[#795C55] mt-1 text-sm">
            Toutes les grossesses actives sont à jour de leur calendrier OMS.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="ltfu-list">
          {cases.map(c => <LTFUCard key={c.alert_id} c={c} onFound={markFound} />)}
        </div>
      )}
    </div>
  );
}

function LTFUCard({ c, onFound }) {
  const patient = c.patient || {};
  return (
    <article
      data-testid={`ltfu-card-${c.pregnancy_id}`}
      className="bg-[#B83A2E]/5 border-2 border-[#B83A2E]/30 rounded-2xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading font-semibold text-[#3E2723]">
          {patient.full_name || "Patiente inconnue"}
        </h3>
        <span className="shrink-0 inline-flex items-center gap-1 bg-[#B83A2E] text-white text-[11px] font-semibold px-2 py-1 rounded-full">
          <AlertTriangle size={12} /> {c.weeks_late} sem retard
        </span>
      </div>

      <div className="text-sm text-[#795C55] space-y-1">
        {patient.phone && (
          <a href={`tel:${patient.phone}`} className="flex items-center gap-1.5 hover:text-[#C85A48]">
            <Phone size={13} /> {patient.phone}
          </a>
        )}
        {patient.address && (
          <div className="flex items-start gap-1.5">
            <MapPin size={13} className="mt-0.5 shrink-0" />
            <span>{patient.address}</span>
          </div>
        )}
      </div>

      <p className="text-xs text-[#B83A2E] font-medium bg-white/60 rounded-lg p-2">
        {c.message}
      </p>

      <button
        onClick={() => onFound(c.pregnancy_id)}
        className="w-full bg-[#4A7C59] hover:bg-[#3a6448] text-white py-2.5 rounded-xl font-medium text-sm inline-flex items-center justify-center gap-2"
        data-testid={`ltfu-mark-found-${c.pregnancy_id}`}
      >
        <CheckCircle2 size={16} /> Marquer comme retrouvée
      </button>
    </article>
  );
}
