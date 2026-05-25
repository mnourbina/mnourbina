import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { listPending, deleteEntry, markStatus } from "@/lib/localDb";
import { drainQueue } from "@/lib/syncQueue";
import { useNetwork } from "@/lib/network";
import { RefreshCw, Trash2, AlertCircle, CheckCircle2, Clock, Database } from "lucide-react";
import { toast } from "sonner";

const NAV = [
  { to: "/portail/admin", label: "Tableau de bord", end: true },
  { to: "/portail/admin/mpdsr", label: "Audits MPDSR" },
  { to: "/portail/admin/sync", label: "Synchronisation" },
  { to: "/portail/admin/utilisateurs", label: "Utilisateurs" },
  { to: "/portail/admin/exports", label: "Exports" },
];

const STATUS_META = {
  pending: { label: "En attente", icon: Clock, cls: "text-[#E59500] bg-[#E59500]/10" },
  syncing: { label: "Sync en cours", icon: RefreshCw, cls: "text-primary bg-primary/10" },
  synced: { label: "Synchronise", icon: CheckCircle2, cls: "text-[#2D7D46] bg-[#2D7D46]/10" },
  failed: { label: "Echec", icon: AlertCircle, cls: "text-destructive bg-destructive/10" },
};

export default function AdminSync() {
  const [items, setItems] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const isOnline = useNetwork((s) => s.isOnline);

  const refresh = async () => setItems(await listPending());
  useEffect(() => { refresh(); const iv = setInterval(refresh, 4000); return () => clearInterval(iv); }, []);

  const forceSync = async () => {
    setSyncing(true);
    try {
      const { sent, failed } = await drainQueue();
      toast.success(`${sent} synchronisee(s), ${failed} echec(s)`);
      await refresh();
    } finally { setSyncing(false); }
  };

  const remove = async (id) => { await deleteEntry(id); refresh(); toast.success("Entree supprimee"); };
  const retry = async (id) => { await markStatus(id, "pending"); refresh(); };

  return (
    <Layout title="Synchronisation" nav={NAV}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Interoperabilite & resilience</p>
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
            <Database className="text-primary" size={28} /> File de synchronisation
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">Saisies effectuees hors-ligne, en attente de remontee vers le serveur. La synchronisation se declenche automatiquement au retour du reseau ou peut etre forcee.</p>
        </div>
        <button
          onClick={forceSync}
          disabled={!isOnline || syncing || items.length === 0}
          data-testid="admin-force-sync-btn"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Synchronisation..." : "Forcer la synchronisation"}
        </button>
      </div>

      <DevOfflineToggle />

      <div className="grid sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total en file" value={items.length} testid="sync-total" />
        <StatCard label="En attente" value={items.filter(i => i.status === "pending").length} accent="amber" testid="sync-pending" />
        <StatCard label="Echecs" value={items.filter(i => i.status === "failed").length} accent="red" testid="sync-failed" />
        <StatCard label="Reseau" value={isOnline ? "En ligne" : "Hors-ligne"} accent={isOnline ? "green" : "red"} testid="sync-network" />
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-display text-lg font-bold">Journal des actions</h2>
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground" data-testid="sync-empty">
            Aucune action en attente. Toutes les saisies sont synchronisees.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Endpoint</th>
                <th className="px-4 py-3 font-semibold">Methode</th>
                <th className="px-4 py-3 font-semibold">Cree le</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map(it => {
                const meta = STATUS_META[it.status] || STATUS_META.pending;
                const Icon = meta.icon;
                return (
                  <tr key={it.id} data-testid={`sync-row-${it.id}`}>
                    <td className="px-4 py-3 font-medium">{it.kind || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{it.endpoint}</td>
                    <td className="px-4 py-3 text-muted-foreground">{it.method}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(it.createdAt).toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-semibold ${meta.cls}`}>
                        <Icon size={12} className={it.status === "syncing" ? "animate-spin" : ""} />
                        {meta.label}
                      </span>
                      {it.lastError && <p className="text-xs text-destructive mt-1 max-w-xs truncate" title={it.lastError}>{it.lastError}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {it.status === "failed" && (
                        <button onClick={() => retry(it.id)} data-testid={`sync-retry-${it.id}`} className="text-xs font-semibold text-primary hover:underline mr-3">Reessayer</button>
                      )}
                      <button onClick={() => remove(it.id)} data-testid={`sync-delete-${it.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}

function StatCard({ label, value, accent, testid }) {
  const tone = accent === "amber" ? "text-[#E59500]" : accent === "red" ? "text-destructive" : accent === "green" ? "text-[#2D7D46]" : "text-foreground";
  return (
    <div className="bg-white border border-border rounded-xl p-4" data-testid={testid}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

function DevOfflineToggle() {
  const { manualOverride, isOnline, setManualOverride } = useNetwork();
  const toggle = () => {
    if (manualOverride) {
      setManualOverride(false, navigator.onLine);
    } else {
      setManualOverride(true, false);
    }
  };
  return (
    <div className="bg-secondary/50 border border-border rounded-lg p-3 mb-5 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">Simulation reseau (dev / demo)</p>
        <p className="text-xs text-muted-foreground">Force le mode hors-ligne pour tester la file. {manualOverride ? "(override actif)" : "(suit le navigateur)"}</p>
      </div>
      <button
        onClick={toggle}
        data-testid="dev-offline-toggle"
        className={`px-3 py-1.5 rounded-md text-xs font-semibold ${isOnline ? "bg-[#2D7D46] text-white" : "bg-[#FFB300] text-foreground"}`}
      >
        {isOnline ? "En ligne — couper" : "Hors-ligne — retablir"}
      </button>
    </div>
  );
}
