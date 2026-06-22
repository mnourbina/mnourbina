import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, User2, ListChecks, Filter } from "lucide-react";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({ action: "", entity: "", user_id: "" });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const [a, b] = await Promise.all([
        api.get("/audit-logs", { params: { ...params, limit: 200 } }),
        api.get("/audit-logs/summary"),
      ]);
      setLogs(a.data);
      setSummary(b.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters]);

  const actions = useMemo(() => (summary?.by_action || []).map(x => x.action), [summary]);
  const entities = useMemo(() => (summary?.by_entity || []).map(x => x.entity), [summary]);

  return (
    <div className="space-y-6" data-testid="admin-audit-logs">
      <header>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#C85A48]">Traçabilité</span>
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#3E2723] mt-2 flex items-center gap-3">
          <History size={28} /> Journal d'audit
        </h1>
        <p className="mt-2 text-[#795C55]">Toutes les actions sensibles (CREATE / UPDATE / EXPORT / ASSIGNED_LTFU / MARKED_FOUND…).</p>
      </header>

      {summary && (
        <section className="grid sm:grid-cols-3 gap-4">
          <StatCard label="Total enregistrements" value={summary.total} />
          <StatCard label="Actions distinctes" value={summary.by_action.length} />
          <StatCard label="Entités distinctes" value={summary.by_entity.length} />
        </section>
      )}

      <section className="bg-white rounded-2xl border border-[#3E2723]/5 p-4 grid sm:grid-cols-3 gap-3" data-testid="audit-filters">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#795C55] flex items-center gap-1 mb-1"><Filter size={12}/> Action</label>
          <Select value={filters.action || "all"} onValueChange={(v) => setFilters(f => ({ ...f, action: v === "all" ? "" : v }))}>
            <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Toutes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#795C55] flex items-center gap-1 mb-1"><ListChecks size={12}/> Entité</label>
          <Select value={filters.entity || "all"} onValueChange={(v) => setFilters(f => ({ ...f, entity: v === "all" ? "" : v }))}>
            <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Toutes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {entities.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#795C55] flex items-center gap-1 mb-1"><User2 size={12}/> User ID</label>
          <Input value={filters.user_id} onChange={(e) => setFilters(f => ({ ...f, user_id: e.target.value }))} placeholder="user_id" className="h-10 rounded-lg" />
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-[#3E2723]/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F3EB]">
            <tr className="text-left text-xs uppercase tracking-wider text-[#795C55]">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entité</th>
              <th className="px-4 py-3">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3E2723]/5" data-testid="audit-rows">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-[#795C55]">Chargement…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-[#795C55]">Aucune entrée correspondante.</td></tr>
            ) : logs.map(l => (
              <tr key={l.id} data-testid={`audit-row-${l.id}`}>
                <td className="px-4 py-2 text-[#795C55] whitespace-nowrap">{new Date(l.created_at).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-2">
                  <div className="text-[#3E2723]">{l.user_email || "—"}</div>
                  <div className="text-xs text-[#795C55] capitalize">{l.user_role || ""}</div>
                </td>
                <td className="px-4 py-2"><code className="text-xs bg-[#F7F3EB] px-2 py-0.5 rounded">{l.action}</code></td>
                <td className="px-4 py-2 text-[#3E2723]">{l.entity}</td>
                <td className="px-4 py-2 font-mono text-[10px] text-[#795C55] break-all">{l.entity_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-[#3E2723]/5 p-4">
      <div className="text-xs uppercase tracking-wider text-[#795C55]">{label}</div>
      <div className="font-heading text-3xl font-semibold text-[#3E2723] mt-1">{value}</div>
    </div>
  );
}
