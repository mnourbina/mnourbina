import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { api, formatApiError } from "@/lib/api";
import { AlertOctagon, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

const NAV = [
  { to: "/portail/admin", label: "Tableau de bord", end: true },
  { to: "/portail/admin/mpdsr", label: "Audits MPDSR" },
  { to: "/portail/admin/sync", label: "Synchronisation" },
  { to: "/portail/admin/utilisateurs", label: "Utilisateurs" },
  { to: "/portail/admin/exports", label: "Exports" },
];

const STATUS_LABEL = {
  pending_audit: "En attente d'audit",
  audited: "Audite",
  closed: "Cloture",
};

export default function AdminMpdsr() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auditTarget, setAuditTarget] = useState(null);

  const load = () => api.get("/death-audits").then(r => setAudits(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const pending = audits.filter(a => a.status === "pending_audit");

  return (
    <Layout title="Administration · MPDSR" nav={NAV}>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Surveillance epidemiologique</p>
        <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
          <AlertOctagon className="text-destructive" size={28} /> Audit des deces maternels et neonataux
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">Module MPDSR — chaque deces declenche un audit obligatoire pour identifier les causes systemiques et formuler des recommandations applicables a la zone.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card label="Total deces declares" value={audits.length} testid="mpdsr-total" />
        <Card label="En attente d'audit" value={pending.length} accent testid="mpdsr-pending" />
        <Card label="Audites" value={audits.length - pending.length} testid="mpdsr-audited" />
      </div>

      {loading ? <p className="text-muted-foreground">Chargement...</p> : audits.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-10 text-center text-muted-foreground" data-testid="mpdsr-list-empty">
          Aucun deces enregistre. Tant mieux.
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Cause primaire</th>
                <th className="px-4 py-3 font-semibold">Lieu</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {audits.map(a => (
                <tr key={a.id} data-testid={`mpdsr-row-${a.id}`}>
                  <td className="px-4 py-3">{new Date(a.death_date).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${a.death_type === "maternal" ? "bg-destructive/10 text-destructive" : "bg-[#E59500]/10 text-[#E59500]"}`}>
                      {a.death_type === "maternal" ? "Maternel" : "Neonatal"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{a.primary_cause}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{a.location || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${a.status === "pending_audit" ? "bg-[#E59500]/10 text-[#E59500]" : "bg-[#2D7D46]/10 text-[#2D7D46]"}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a.status === "pending_audit" ? (
                      <button onClick={() => setAuditTarget(a)} className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1" data-testid={`mpdsr-audit-${a.id}`}>
                        <ShieldAlert size={12} /> Lancer audit
                      </button>
                    ) : (
                      <Link to={`/portail/pro/patientes/${a.patient_id}`} className="text-xs text-muted-foreground hover:text-primary">Dossier</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {auditTarget && (
        <AuditModal audit={auditTarget} onClose={() => setAuditTarget(null)} onSaved={() => { setAuditTarget(null); load(); toast.success("Audit enregistre"); }} />
      )}
    </Layout>
  );
}

function Card({ label, value, accent, testid }) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? "border-destructive/30 bg-destructive/5" : "border-border bg-white"}`} data-testid={testid}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`font-display text-3xl font-bold mt-1 ${accent ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function AuditModal({ audit, onClose, onSaved }) {
  const [recommendations, setRecommendations] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.patch(`/death-audits/${audit.id}`, { audit_recommendations: recommendations, status: "audited" });
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Audit du deces — {audit.primary_cause}</h2>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-md"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</p><p className="font-medium">{audit.death_type}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</p><p className="font-medium">{new Date(audit.death_date).toLocaleDateString("fr-FR")}</p></div>
            <div className="col-span-2"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Facteurs contributifs</p><p className="font-medium">{audit.contributing_factors || "—"}</p></div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-muted-foreground">Recommandations du comite de district</label>
            <textarea required value={recommendations} onChange={(e) => setRecommendations(e.target.value)} rows={5} data-testid="audit-recommendations-input"
              placeholder="Causes systemiques identifiees + recommandations applicables pour eviter d'autres drames..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-medium">Annuler</button>
            <button type="submit" disabled={busy} data-testid="audit-submit-btn" className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">
              Cloturer l'audit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
