import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Search, Plus, Phone } from "lucide-react";

export default function PatientList() {
  const [patients, setPatients] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/patients").then(r => setPatients(r.data)).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    if (!term) return patients;
    return patients.filter(p =>
      (p.full_name || "").toLowerCase().includes(term) ||
      (p.phone || "").includes(term)
    );
  }, [q, patients]);

  return (
    <div className="space-y-6" data-testid="patient-list">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-[#3E2723]">Mes patientes</h1>
          <p className="text-[#795C55] mt-1">{patients.length} patientes dans votre zone</p>
        </div>
        <Link to="/app/soignant/patients/new" data-testid="list-new-patient-btn">
          <button className="inline-flex items-center gap-2 bg-[#C85A48] hover:bg-[#B34D3D] text-white px-5 h-11 rounded-xl font-medium">
            <Plus size={18} /> Nouvelle patiente
          </button>
        </Link>
      </header>

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#795C55]" />
        <Input
          placeholder="Rechercher une patiente…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-11 h-12 bg-white border-[#3E2723]/15 rounded-xl"
          data-testid="patient-search"
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <Link
            key={p.id}
            to={`/app/soignant/patients/${p.id}`}
            className="bg-white rounded-2xl p-5 border border-[#3E2723]/5 hover:border-[#C85A48]/40 hover:shadow-[0_8px_30px_rgba(62,39,35,0.06)] transition"
            data-testid={`patient-card-${p.id}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C85A48]/20 to-[#D99A5A]/30 flex items-center justify-center text-[#C85A48] font-semibold text-lg">
                {p.full_name?.slice(0, 1) || "?"}
              </div>
              <div className="min-w-0">
                <div className="font-heading font-semibold text-[#3E2723] truncate">{p.full_name}</div>
                <div className="text-sm text-[#795C55] flex items-center gap-1 mt-0.5">
                  <Phone size={12} /> {p.phone || "—"}
                </div>
              </div>
            </div>
            {p.address && (
              <div className="mt-4 text-xs text-[#795C55] truncate">{p.address}</div>
            )}
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl p-10 text-center text-[#795C55] border border-[#3E2723]/5">
            Aucune patiente trouvée.
          </div>
        )}
      </div>
    </div>
  );
}
