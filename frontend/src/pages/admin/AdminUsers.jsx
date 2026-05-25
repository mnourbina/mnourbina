import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, formatApiError } from "@/lib/api";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";

const NAV = [
  { to: "/portail/admin", label: "Tableau de bord", end: true },
  { to: "/portail/admin/mpdsr", label: "Audits MPDSR" },
  { to: "/portail/admin/sync", label: "Synchronisation" },
  { to: "/portail/admin/utilisateurs", label: "Utilisateurs" },
  { to: "/portail/admin/exports", label: "Exports" },
];

const ROLE_LABEL = {
  admin: "Administrateur",
  gynecologist: "Gynecologue",
  midwife: "Sage-femme",
  patient: "Patiente",
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => api.get("/admin/users").then(r => setUsers(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); api.get("/facilities").then(r => setFacilities(r.data)); }, []);

  return (
    <Layout title="Utilisateurs" nav={NAV}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground">Utilisateurs</h1>
        <button onClick={() => setShow(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm" data-testid="user-create-btn">
          <UserPlus size={16} /> Nouvel utilisateur
        </button>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Nom</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Structure</th>
              <th className="px-4 py-3 font-semibold">Cree le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Chargement...</td></tr>}
            {users.map(u => (
              <tr key={u.id} data-testid={`user-row-${u.id}`}>
                <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary font-semibold">{ROLE_LABEL[u.role]}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {facilities.find(f => f.id === u.facility_id)?.name || "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && <CreateUserModal facilities={facilities} onClose={() => setShow(false)} onCreated={() => { setShow(false); load(); toast.success("Utilisateur cree"); }} />}
    </Layout>
  );
}

function CreateUserModal({ onClose, onCreated, facilities }) {
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "midwife", facility_id: facilities[0]?.id || "", phone: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/admin/users", form);
      onCreated();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Nouvel utilisateur</h2>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-md"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 grid grid-cols-2 gap-4">
          <Inp label="Nom complet" value={form.name} onChange={v => setForm({ ...form, name: v })} required testid="user-form-name" />
          <Inp label="Email" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} required testid="user-form-email" />
          <Inp label="Mot de passe" type="password" value={form.password} onChange={v => setForm({ ...form, password: v })} required testid="user-form-password" />
          <div>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">Role</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} data-testid="user-form-role" className="w-full px-3 py-2.5 rounded-lg border border-border bg-white">
              <option value="midwife">Sage-femme</option>
              <option value="gynecologist">Gynecologue</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">Structure</label>
            <select value={form.facility_id} onChange={e => setForm({ ...form, facility_id: e.target.value })} data-testid="user-form-facility" className="w-full px-3 py-2.5 rounded-lg border border-border bg-white">
              <option value="">-- Aucune --</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-medium">Annuler</button>
            <button type="submit" disabled={busy} data-testid="user-form-submit" className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">{busy ? "..." : "Creer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
function Inp({ label, value, onChange, type = "text", required, testid }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid} className="w-full px-3 py-2.5 rounded-lg border border-border bg-white" />
    </div>
  );
}
