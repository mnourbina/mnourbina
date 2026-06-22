import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Users, Stethoscope, Baby, Syringe, AlertTriangle, Activity, Heart,
} from "lucide-react";

const COLORS = ["#C85A48", "#D99A5A", "#F2C94C", "#4A7C59", "#795C55"];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/analytics/overview").then(r => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="text-[#795C55]">Chargement du tableau de bord…</div>;
  const t = data.totals;

  return (
    <div className="space-y-8" data-testid="admin-dashboard">
      <header>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#C85A48]">Tableau de bord</span>
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#3E2723] mt-2">
          Indicateurs de santé maternelle & infantile
        </h1>
        <p className="mt-2 text-[#795C55]">Vue d'ensemble nationale — République du Tchad.</p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Users} label="Patientes" value={t.patients} color="#C85A48" />
        <Kpi icon={Heart} label="Grossesses actives" value={t.active_pregnancies} color="#D99A5A" />
        <Kpi icon={Stethoscope} label="CPN totales" value={t.cpn_visits} color="#4A7C59" />
        <Kpi icon={Baby} label="Visites postnatales" value={t.postnatal_visits} color="#795C55" />
        <Kpi icon={Syringe} label="Vaccinations" value={t.vaccinations} color="#F2C94C" />
        <Kpi icon={AlertTriangle} label="Morts maternelles" value={t.maternal_deaths} color="#B83A2E" />
        <Kpi icon={AlertTriangle} label="Morts néonatales" value={t.neonatal_deaths} color="#B83A2E" />
        <Kpi icon={Activity} label="Couverture CPN4+" value={`${data.cpn4_coverage_percent}%`} color="#C85A48" />
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
          <h3 className="font-heading text-lg font-semibold text-[#3E2723] mb-5">Patientes par zone sanitaire</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_zone}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(62,39,35,0.08)" />
                <XAxis dataKey="zone" tick={{ fill: "#795C55", fontSize: 12 }} />
                <YAxis tick={{ fill: "#795C55", fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid rgba(62,39,35,0.1)", borderRadius: "12px" }} />
                <Bar dataKey="patients" fill="#C85A48" radius={[8, 8, 0, 0]} />
                <Bar dataKey="pregnancies" fill="#D99A5A" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
          <h3 className="font-heading text-lg font-semibold text-[#3E2723] mb-5">Top complications observées (CPN)</h3>
          <div className="h-72">
            {data.top_complications.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#795C55] text-sm">
                Aucune complication signalée pour le moment.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.top_complications}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={40}
                    paddingAngle={2}
                  >
                    {data.top_complications.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-[#3E2723] to-[#5d3b35] rounded-2xl p-8 text-white">
        <h3 className="font-heading text-xl font-semibold">État de la mission</h3>
        <p className="mt-3 text-white/80">
          {t.patients} patiente(s) enregistrée(s), {t.cpn_visits} CPN délivrées et {data.cpn4_coverage_percent}% des grossesses ont bénéficié d'au moins 4 consultations prénatales — l'objectif OMS est de 8 contacts.
        </p>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#3E2723]/5">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: color }}>
        <Icon size={18} />
      </div>
      <div className="mt-4 text-xs uppercase tracking-wider text-[#795C55]">{label}</div>
      <div className="font-heading text-2xl font-semibold text-[#3E2723] mt-1">{value}</div>
    </div>
  );
}
