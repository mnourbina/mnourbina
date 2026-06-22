import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Users, Stethoscope, AlertTriangle, Calendar, Plus, ArrowUpRight } from "lucide-react";

export default function SoignantDashboard() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [cpnCount, setCpnCount] = useState(0);
  const [mpdsr, setMpdsr] = useState([]);

  useEffect(() => {
    api.get("/patients").then(r => setPatients(r.data)).catch(() => {});
    api.get("/mpdsr").then(r => setMpdsr(r.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-8" data-testid="soignant-dashboard">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#C85A48]">
            {user?.profession || "Soignant"} · {user?.zone_id ? "Zone N'Djamena Centre" : "Zone non assignée"}
          </span>
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#3E2723] mt-2">
            Bonjour {user?.name?.split(" ")[0]}
          </h1>
          <p className="mt-2 text-[#795C55]">Voici l'activité de votre zone de responsabilité.</p>
        </div>
        <Link to="/app/soignant/patients/new" data-testid="dash-new-patient-btn">
          <button className="inline-flex items-center gap-2 bg-[#C85A48] hover:bg-[#B34D3D] text-white px-5 h-12 rounded-xl font-medium shadow-md shadow-[#C85A48]/20">
            <Plus size={18} /> Nouvelle patiente
          </button>
        </Link>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Patientes suivies" value={patients.length} accent="#C85A48" />
        <StatCard icon={Stethoscope} label="CPN ce mois" value={cpnCount} accent="#D99A5A" />
        <StatCard icon={Calendar} label="RDV à venir" value="—" accent="#F2C94C" />
        <StatCard icon={AlertTriangle} label="MPDSR ouverts" value={mpdsr.length} accent="#B83A2E" />
      </div>

      <section className="bg-white rounded-2xl border border-[#3E2723]/5 overflow-hidden">
        <div className="px-6 py-5 border-b border-[#3E2723]/5 flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-[#3E2723]">Dernières patientes</h2>
          <Link to="/app/soignant/patients" className="text-sm text-[#C85A48] hover:underline font-medium inline-flex items-center gap-1" data-testid="dash-see-all-patients">
            Voir toutes <ArrowUpRight size={14} />
          </Link>
        </div>
        {patients.length === 0 ? (
          <div className="p-10 text-center text-[#795C55]">
            Aucune patiente dans votre zone pour le moment.
          </div>
        ) : (
          <ul className="divide-y divide-[#3E2723]/5">
            {patients.slice(0, 6).map(p => (
              <li key={p.id} className="px-6 py-4 flex items-center justify-between hover:bg-[#F7F3EB]/60 transition">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C85A48]/20 to-[#D99A5A]/30 flex items-center justify-center text-[#C85A48] font-semibold">
                    {p.full_name?.slice(0, 1) || "?"}
                  </div>
                  <div>
                    <div className="font-medium text-[#3E2723]">{p.full_name}</div>
                    <div className="text-sm text-[#795C55]">{p.phone || "Téléphone non renseigné"}</div>
                  </div>
                </div>
                <Link
                  to={`/app/soignant/patients/${p.id}`}
                  className="text-sm font-medium text-[#C85A48] hover:underline"
                  data-testid={`patient-row-${p.id}`}
                >
                  Ouvrir
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#3E2723]/5">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: accent }}>
        <Icon size={18} />
      </div>
      <div className="mt-4 text-xs uppercase tracking-wider text-[#795C55]">{label}</div>
      <div className="font-heading text-2xl font-semibold text-[#3E2723] mt-1">{value}</div>
    </div>
  );
}
