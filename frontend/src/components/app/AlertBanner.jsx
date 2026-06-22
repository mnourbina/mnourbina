import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * MSP-grade critical alert banner.
 * Affiche les alertes CRITICAL non lues d'une grossesse en haut de page.
 */
export default function AlertBanner({ pregnancyId, onResolved }) {
  const [alerts, setAlerts] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!pregnancyId) return;
    api.get("/alerts", { params: { pregnancy_id: pregnancyId } })
      .then(r => setAlerts(r.data))
      .catch(() => {});
  }, [pregnancyId]);

  useEffect(() => { load(); }, [load]);

  const criticalAlerts = alerts.filter(a => a.severity === "CRITICAL" && !a.is_read && !a.resolved_at);
  if (criticalAlerts.length === 0) return null;

  const ack = async () => {
    setBusy(true);
    try {
      await Promise.all(criticalAlerts.map(a => api.patch(`/alerts/${a.id}`, { is_read: true })));
      toast.success("Alertes prises en charge");
      load();
      onResolved?.();
    } catch (e) { toast.error("Erreur"); }
    finally { setBusy(false); }
  };

  return (
    <div
      className="relative bg-[#B83A2E]/8 border-l-4 border-[#B83A2E] rounded-xl p-4 mb-4 shadow-md overflow-hidden"
      data-testid="alert-banner"
    >
      {/* Pulse ring */}
      <div className="absolute -left-2 -top-2 w-6 h-6 rounded-full bg-[#B83A2E]/30 animate-ping"></div>

      <div className="relative flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#B83A2E] flex items-center justify-center text-white shrink-0">
          <AlertTriangle size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-bold text-[#B83A2E] uppercase tracking-wider text-sm">
              Alerte urgence
            </h3>
            <span className="text-[11px] text-[#B83A2E] bg-[#B83A2E]/15 px-2 py-0.5 rounded-full font-semibold">
              {criticalAlerts.length} active{criticalAlerts.length > 1 ? "s" : ""}
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {criticalAlerts.map(a => (
              <li key={a.id} className="text-[#3E2723] text-sm leading-relaxed flex gap-2" data-testid={`banner-alert-${a.id}`}>
                <code className="text-[10px] text-[#795C55] font-mono uppercase tracking-wider mt-0.5 shrink-0">{a.type.slice(0, 18)}</code>
                <span>{a.message}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={ack}
            disabled={busy}
            data-testid="banner-ack-btn"
            className="mt-3 inline-flex items-center gap-2 text-xs bg-[#B83A2E] hover:bg-[#9c2f25] disabled:opacity-50 text-white px-3 py-2 rounded-lg font-medium"
          >
            <CheckCircle2 size={14} /> J'ai pris en charge
          </button>
        </div>
      </div>
    </div>
  );
}
