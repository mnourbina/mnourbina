import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { calculateGestationalAge, calculateDDR, getNextCPN, isCPNOverdue, formatDateFr } from "@/lib/pregnancyCalc";
import { AlertTriangle, Phone, FileText, Plus, Clock, CheckCircle2, MapPin } from "lucide-react";

const STATUS_COLORS = {
  en_cours:      { bg: "bg-[#4A7C59]/10", text: "text-[#4A7C59]", border: "border-[#4A7C59]/30", label: "En cours" },
  active:        { bg: "bg-[#4A7C59]/10", text: "text-[#4A7C59]", border: "border-[#4A7C59]/30", label: "En cours" },
  perdue_vue:    { bg: "bg-[#B83A2E]/10", text: "text-[#B83A2E]", border: "border-[#B83A2E]/30", label: "Perdue de vue" },
  accouche:      { bg: "bg-[#795C55]/10", text: "text-[#795C55]", border: "border-[#795C55]/30", label: "Accouchée" },
  fausse_couche: { bg: "bg-[#3E2723]/10", text: "text-[#795C55]", border: "border-[#3E2723]/15", label: "Fausse couche" },
  ivg:           { bg: "bg-[#3E2723]/10", text: "text-[#795C55]", border: "border-[#3E2723]/15", label: "IVG" },
  transfere:     { bg: "bg-[#D99A5A]/10", text: "text-[#D99A5A]", border: "border-[#D99A5A]/30", label: "Transférée" },
};

export default function PregnancyCard({ pregnancy, onUpdate }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const patient = pregnancy.patient || {};
  const lmp = pregnancy.lmp_date;
  const ga = calculateGestationalAge(lmp);
  const ddr = calculateDDR(lmp);
  const lastCpn = pregnancy.last_cpn;
  const lastCpnNum = lastCpn?.visit_number || 0;
  const doneCpns = pregnancy.done_cpns || (lastCpnNum ? Array.from({ length: lastCpnNum }, (_, i) => i + 1) : []);
  const cpnCount = pregnancy.cpn_count ?? doneCpns.length;
  const nextCpn = getNextCPN(lmp, doneCpns);
  const nextCpnDate = nextCpn?.recommendedDate || null;
  const nextCpnLabel = nextCpn?.label;
  const daysLate = nextCpn?.daysLate || 0;
  const isOverdue = isCPNOverdue(nextCpn);
  const isUrgent = nextCpn && nextCpn.daysLate > 14;

  const status = pregnancy.status || "en_cours";
  const isLTFU = status === "perdue_vue";
  const palette = STATUS_COLORS[status] || STATUS_COLORS.en_cours;
  const cardBorder = isLTFU ? "border-2 border-[#B83A2E]/50" : isUrgent ? "border-2 border-[#F2C94C]" : "border border-[#3E2723]/5";

  const markFound = async () => {
    setLoading(true);
    try {
      await api.post(`/pregnancies/${pregnancy.id}/found`);
      toast.success("Patiente marquée retrouvée");
      onUpdate?.();
    } catch (e) { toast.error("Erreur"); }
    finally { setLoading(false); }
  };

  const markLTFU = async () => {
    setLoading(true);
    try {
      await api.patch(`/pregnancies/${pregnancy.id}`, { status: "perdue_vue" });
      toast.warning("Grossesse marquée perdue de vue");
      onUpdate?.();
    } catch (e) { toast.error("Erreur"); }
    finally { setLoading(false); }
  };

  const isAnemia = lastCpn?.hemoglobin && lastCpn.hemoglobin < 11;

  return (
    <article className={`bg-white rounded-2xl shadow-sm p-5 ${cardBorder}`} data-testid={`pregnancy-card-${pregnancy.id}`}>
      {/* Header */}
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-heading font-semibold text-[#3E2723] truncate">{patient.full_name || "Patiente"}</h3>
          {patient.phone && (
            <a href={`tel:${patient.phone}`} className="text-sm text-[#795C55] inline-flex items-center gap-1 hover:text-[#C85A48]">
              <Phone size={12} /> {patient.phone}
            </a>
          )}
        </div>
        <span className={`shrink-0 px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-semibold border ${palette.bg} ${palette.text} ${palette.border}`} data-testid={`status-badge-${pregnancy.id}`}>
          {palette.label}
        </span>
      </header>

      {/* Overdue banner */}
      {!isLTFU && isOverdue && nextCpnLabel && (
        <div className={`p-3 rounded-xl mb-3 ${isUrgent ? "bg-[#B83A2E]/10 border border-[#B83A2E]/30" : "bg-[#F2C94C]/20 border border-[#F2C94C]/40"}`} data-testid="overdue-banner">
          <div className="flex items-center gap-2">
            {isUrgent ? <AlertTriangle size={18} className="text-[#B83A2E]" /> : <Clock size={18} className="text-[#795C55]" />}
            <div className="min-w-0">
              <div className={`font-semibold text-sm ${isUrgent ? "text-[#B83A2E]" : "text-[#3E2723]"}`}>
                {nextCpnLabel.split(" — ")[0]} en retard de {Math.floor(daysLate / 7)} semaine(s)
              </div>
              <div className="text-xs text-[#795C55]">Date recommandée : {formatDateFr(nextCpnDate)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Clinical summary */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <Info label="Âge gestationnel" value={ga ? `${ga.weeks} SA + ${ga.days}j` : "—"} accent="#3E2723" />
        <Info label="DPA (Naegele)" value={ddr ? ddr.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"} accent="#C85A48" />
        <Info label="Dernière CPN" value={lastCpn ? `CPN${lastCpnNum}` : "Aucune"} />
        <Info
          label="Prochaine CPN"
          value={nextCpnLabel ? nextCpnLabel.split(" — ")[0] : "Fin du suivi"}
          accent={isOverdue ? "#B83A2E" : "#4A7C59"}
        />
      </div>

      {/* Address */}
      {patient.address && (
        <div className="bg-[#F7F3EB] rounded-lg p-2.5 mb-3 flex items-start gap-2">
          <MapPin size={14} className="text-[#795C55] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] text-[#795C55] uppercase tracking-wider">Adresse</div>
            <div className="text-sm text-[#3E2723]">{patient.address}</div>
          </div>
        </div>
      )}

      {/* CPN progress bar (Brique 6 — WHO 8 contacts) */}
      <div className="mt-1 mb-4" data-testid={`cpn-progress-${pregnancy.id}`}>
        <div className="flex justify-between text-[11px] text-[#795C55] mb-1">
          <span className="uppercase tracking-wider">Progression CPN</span>
          <span className="font-semibold text-[#3E2723]">{Math.min(cpnCount, 8)} / 8</span>
        </div>
        <div className="w-full bg-[#F7F3EB] rounded-full h-2 overflow-hidden">
          <div
            className="bg-[#C85A48] h-2 rounded-full transition-all"
            style={{ width: `${Math.min((cpnCount / 8) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {isLTFU ? (
          <>
            <button onClick={markFound} disabled={loading} className="flex-1 bg-[#4A7C59] hover:bg-[#3a6448] text-white py-3 rounded-xl font-medium text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50" data-testid={`mark-found-${pregnancy.id}`}>
              <CheckCircle2 size={16} /> Marquer retrouvée
            </button>
            {patient.phone && (
              <a href={`tel:${patient.phone}`} className="px-4 py-3 bg-[#C85A48] text-white rounded-xl font-medium text-sm inline-flex items-center gap-2" data-testid={`call-${pregnancy.id}`}>
                <Phone size={16} /> Appeler
              </a>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => navigate(`/app/soignant/patients/${pregnancy.patient_id}/cpn`, { state: { pregnancyId: pregnancy.id } })}
              className="flex-1 bg-[#C85A48] hover:bg-[#B34D3D] text-white py-3 rounded-xl font-medium text-sm inline-flex items-center justify-center gap-2"
              data-testid={`new-cpn-${pregnancy.id}`}
            >
              <Plus size={16} /> Nouvelle CPN
            </button>
            <button
              onClick={() => navigate(`/app/soignant/patients/${pregnancy.patient_id}`)}
              className="px-4 py-3 border-2 border-[#3E2723]/15 text-[#3E2723] hover:bg-[#F7F3EB] rounded-xl font-medium text-sm inline-flex items-center gap-2"
              data-testid={`open-dossier-${pregnancy.id}`}
            >
              <FileText size={16} /> Dossier
            </button>
            {isUrgent && (
              <button
                onClick={markLTFU}
                className="px-3 py-3 text-[#B83A2E] border-2 border-[#B83A2E]/30 hover:bg-[#B83A2E]/5 rounded-xl text-xs font-medium"
                title="Marquer perdue de vue"
                data-testid={`mark-ltfu-${pregnancy.id}`}
              >
                LTFU
              </button>
            )}
          </>
        )}
      </div>

      {/* Anemia callout */}
      {isAnemia && (
        <div className="mt-3 px-3 py-2 bg-[#B83A2E]/10 border border-[#B83A2E]/30 rounded-lg text-xs text-[#B83A2E] font-medium inline-flex items-center gap-1" data-testid={`anemia-${pregnancy.id}`}>
          <AlertTriangle size={12} /> Anémie Hb {lastCpn.hemoglobin} g/dL
        </div>
      )}
    </article>
  );
}

function Info({ label, value, accent }) {
  return (
    <div>
      <div className="text-[11px] text-[#795C55] uppercase tracking-wider">{label}</div>
      <div className="font-semibold mt-0.5" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}
