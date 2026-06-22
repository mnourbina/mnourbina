import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useI18n } from "@/i18n/I18nContext";
import { Search, Phone, MapPin, CheckCircle2, AlertTriangle, Navigation, RefreshCw } from "lucide-react";

export default function AscLTFUPage() {
  const { t } = useI18n();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/ltfu");
      setCases(data);
    } catch (e) {
      toast.error(t("loading"));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const markFound = async (pregnancyId) => {
    try {
      await api.post(`/pregnancies/${pregnancyId}/found`, { notes: t("ltfu.found_note") });
      toast.success(t("ltfu.mark_found"));
      setCases(cs => cs.filter(c => c.pregnancy_id !== pregnancyId));
    } catch (e) {
      toast.error("Error");
    }
  };

  return (
    <div className="space-y-4" data-testid="asc-ltfu-page">
      <header className="flex items-start justify-between gap-3 sticky top-0 bg-[#F7F3EB] -mx-4 px-4 py-3 z-10 border-b border-[#3E2723]/5 md:static md:bg-transparent md:border-0 md:px-0 md:py-0">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#C85A48]">ASC</span>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-[#3E2723] mt-1 flex items-center gap-2">
            <Search size={24}/> {t("ltfu.title")}
          </h1>
        </div>
        <button
          onClick={load}
          className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl border-2 border-[#3E2723]/15 hover:bg-white"
          aria-label={t("ltfu.refresh_aria")}
          data-testid="asc-refresh"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""}/>
        </button>
      </header>

      <p className="text-sm text-[#795C55] md:block">{t("ltfu.subtitle_asc")}</p>

      {loading ? (
        <div className="text-[#795C55] text-sm">{t("loading")}</div>
      ) : cases.length === 0 ? (
        <div className="bg-[#4A7C59]/10 border border-[#4A7C59]/30 rounded-2xl p-6 text-center" data-testid="asc-ltfu-empty">
          <CheckCircle2 size={36} className="text-[#4A7C59] mx-auto mb-3"/>
          <h3 className="font-heading text-lg font-semibold text-[#3E2723]">{t("ltfu.empty_asc")}</h3>
          <p className="text-[#795C55] text-sm mt-1">{t("ltfu.empty_asc_sub")}</p>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="asc-ltfu-list">
          {cases.map(c => <LTFUCardMobile key={c.alert_id} c={c} onFound={markFound} t={t}/>)}
        </ul>
      )}
    </div>
  );
}

function LTFUCardMobile({ c, onFound, t }) {
  const patient = c.patient || {};
  const address = patient.address || "";
  const lat = patient.latitude;
  const lng = patient.longitude;
  const mapsUrl = (lat && lng)
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`
    : address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : null;

  return (
    <li
      data-testid={`asc-ltfu-card-${c.pregnancy_id}`}
      className="bg-white rounded-2xl border-l-4 border-[#B83A2E] shadow-sm p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-heading font-semibold text-[#3E2723] truncate">{patient.full_name || "—"}</h3>
          <div className="text-xs text-[#795C55] mt-0.5">{c.expected_cpn_label}</div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 bg-[#B83A2E] text-white text-[11px] font-semibold px-2 py-1 rounded-full">
          <AlertTriangle size={11}/> {t("ltfu.weeks_late_badge", { n: c.weeks_late })}
        </span>
      </div>

      {address && (
        <div className="bg-[#F7F3EB] rounded-lg p-2.5 flex items-start gap-2 text-sm">
          <MapPin size={14} className="text-[#795C55] mt-0.5 shrink-0"/>
          <span className="text-[#3E2723]">{address}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {patient.phone ? (
          <a
            href={`tel:${patient.phone}`}
            className="inline-flex items-center justify-center gap-2 bg-[#C85A48] hover:bg-[#B34D3D] text-white py-3 rounded-xl font-medium text-sm"
            data-testid={`asc-call-${c.pregnancy_id}`}
          >
            <Phone size={16}/> {t("ltfu.call")}
          </a>
        ) : (
          <div className="inline-flex items-center justify-center gap-2 bg-[#F7F3EB] text-[#795C55] py-3 rounded-xl text-sm">
            <Phone size={16}/> {t("ltfu.no_phone")}
          </div>
        )}
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center justify-center gap-2 bg-[#3E2723] hover:bg-[#2a1c1a] text-white py-3 rounded-xl font-medium text-sm"
            data-testid={`asc-navigate-${c.pregnancy_id}`}
          >
            <Navigation size={16}/> {t("ltfu.navigate")}
          </a>
        ) : (
          <div className="inline-flex items-center justify-center gap-2 bg-[#F7F3EB] text-[#795C55] py-3 rounded-xl text-sm">
            <Navigation size={16}/> {t("ltfu.no_address")}
          </div>
        )}
      </div>

      <button
        onClick={() => onFound(c.pregnancy_id)}
        className="w-full inline-flex items-center justify-center gap-2 bg-[#4A7C59] hover:bg-[#3a6448] text-white py-3 rounded-xl font-medium text-sm"
        data-testid={`asc-mark-found-${c.pregnancy_id}`}
      >
        <CheckCircle2 size={16}/> {t("ltfu.mark_found")}
      </button>
    </li>
  );
}
