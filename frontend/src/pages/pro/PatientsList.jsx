import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { api, formatApiError } from "@/lib/api";
import { Search, Plus, UserPlus, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";

const NAV = [
  { to: "/portail/pro", label: "Tableau de bord", end: true },
  { to: "/portail/pro/patientes", label: "Patientes" },
];

export default function PatientsList() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [facilities, setFacilities] = useState([]);

  const fetchPatients = (query = "") => {
    setLoading(true);
    api.get(`/patients${query ? `?q=${encodeURIComponent(query)}` : ""}`)
      .then(r => setPatients(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPatients(q); }, []); // initial
  useEffect(() => { api.get("/facilities").then(r => setFacilities(r.data)); }, []);

  const onSearch = (e) => {
    e.preventDefault();
    setParams(q ? { q } : {});
    fetchPatients(q);
  };

  return (
    <Layout title="Patientes" nav={NAV}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground">Patientes</h1>
        <button
          onClick={() => setShowCreate(true)}
          data-testid="patient-create-btn"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
        >
          <UserPlus size={16} /> Nouvelle patiente
        </button>
      </div>

      <form onSubmit={onSearch} className="relative max-w-md mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          data-testid="patient-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom, telephone, prenom..."
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </form>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Patiente</th>
                <th className="px-4 py-3 font-semibold">ID Khalaba</th>
                <th className="px-4 py-3 font-semibold">Age</th>
                <th className="px-4 py-3 font-semibold">Telephone</th>
                <th className="px-4 py-3 font-semibold">District</th>
                <th className="px-4 py-3 font-semibold">Parite</th>
                <th className="px-4 py-3 font-semibold">Risque</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Chargement...</td></tr>}
            {!loading && patients.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Aucune patiente trouvee.</td></tr>
            )}
            {patients.map(p => (
              <tr key={p.id} className="hover:bg-secondary/40 transition-colors" data-testid={`patient-row-${p.id}`}>
                <td className="px-4 py-3">
                  <Link to={`/portail/pro/patientes/${p.id}`} className="font-semibold text-foreground hover:text-primary">
                    {p.first_name} {p.last_name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-primary">{p.khalaba_id}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.age} ans</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.phone}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.district || "-"}</td>
                <td className="px-4 py-3 text-muted-foreground">G{p.parity}</td>
                <td className="px-4 py-3">
                  {p.risk_score >= 4 ? (
                    <span className="text-xs px-2 py-1 rounded-md bg-destructive/10 text-destructive font-semibold">Eleve</span>
                  ) : p.risk_score >= 2 ? (
                    <span className="text-xs px-2 py-1 rounded-md bg-[#E59500]/10 text-[#E59500] font-semibold">Modere</span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-md bg-[#2D7D46]/10 text-[#2D7D46] font-semibold">Faible</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/portail/pro/patientes/${p.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    Ouvrir <ArrowRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreatePatientModal facilities={facilities} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchPatients(q); toast.success("Patiente creee"); }} />
      )}
    </Layout>
  );
}

function CreatePatientModal({ onClose, onCreated, facilities }) {
  const [form, setForm] = useState({
    first_name: "", last_name: "", date_of_birth: "", phone: "",
    district: "", address: "", blood_group: "O+", parity: 0,
    facility_id: facilities[0]?.id || "",
  });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/patients", { ...form, parity: Number(form.parity) });
      onCreated();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4" data-testid="patient-create-modal">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Nouvelle patiente</h2>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-md" data-testid="patient-create-close"><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit} className="p-5 grid grid-cols-2 gap-4">
          <Field label="Prenom" required value={form.first_name} onChange={v => setForm({ ...form, first_name: v })} testid="form-first-name" />
          <Field label="Nom" required value={form.last_name} onChange={v => setForm({ ...form, last_name: v })} testid="form-last-name" />
          <Field type="date" label="Date de naissance" required value={form.date_of_birth} onChange={v => setForm({ ...form, date_of_birth: v })} testid="form-dob" />
          <Field label="Telephone" required value={form.phone} onChange={v => setForm({ ...form, phone: v })} testid="form-phone" />
          <Field label="District" value={form.district} onChange={v => setForm({ ...form, district: v })} testid="form-district" />
          <Field label="Adresse" value={form.address} onChange={v => setForm({ ...form, address: v })} testid="form-address" />
          <Field label="Groupe sanguin" value={form.blood_group} onChange={v => setForm({ ...form, blood_group: v })} testid="form-blood" />
          <Field type="number" label="Parite" value={form.parity} onChange={v => setForm({ ...form, parity: v })} testid="form-parity" />
          <div className="col-span-2">
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-muted-foreground">Structure sanitaire</label>
            <select
              required
              value={form.facility_id}
              onChange={(e) => setForm({ ...form, facility_id: e.target.value })}
              data-testid="form-facility"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-white"
            >
              <option value="">-- Choisir --</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary">Annuler</button>
            <button type="submit" disabled={submitting} data-testid="form-submit-patient" className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
              {submitting ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, value, onChange, type = "text", testid }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-muted-foreground">{label}{required && <span className="text-destructive ml-1">*</span>}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testid}
        className="w-full px-3 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}
