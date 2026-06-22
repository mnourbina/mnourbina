import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Heart, Calendar, Baby, Stethoscope, MapPin } from "lucide-react";

export default function PatientDashboard() {
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);

  useEffect(() => {
    api.get("/patients").then(r => setPatient(r.data[0] || null)).catch(() => {});
  }, []);

  const pregnancy = patient?.pregnancies?.[0];
  const cpnCount = pregnancy ? 0 : 0; // simplified
  const eddDays = pregnancy?.lmp_date
    ? Math.max(0, 280 - Math.floor((Date.now() - new Date(pregnancy.lmp_date)) / (1000*60*60*24)))
    : null;

  return (
    <div className="space-y-8" data-testid="patient-dashboard">
      <header>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#C85A48]">Bienvenue</span>
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#3E2723] mt-2">
          Bonjour {user?.name?.split(" ")[0] || "maman"} ☀
        </h1>
        <p className="mt-2 text-[#795C55]">Voici votre suivi maternel et celui de votre bébé.</p>
      </header>

      <section className="bg-gradient-to-br from-[#C85A48] to-[#B34D3D] rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-[#F2C94C]/30 blur-2xl"></div>
        <div className="relative">
          <Heart size={28} />
          <h2 className="font-heading text-2xl font-semibold mt-4">Votre grossesse</h2>
          {pregnancy ? (
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs uppercase tracking-wider text-white/70">Date présumée d'accouchement</div>
                <div className="font-heading text-xl mt-1">~ {eddDays} jours restants</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-white/70">Statut</div>
                <div className="font-heading text-xl mt-1 capitalize">{pregnancy.status}</div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-white/80">Aucune grossesse enregistrée. Contactez votre sage-femme pour ouvrir votre dossier.</p>
          )}
        </div>
      </section>

      <div className="grid md:grid-cols-3 gap-5">
        <InfoCard icon={Calendar} label="Prochain rendez-vous" value="À planifier" />
        <InfoCard icon={Stethoscope} label="Sage-femme référente" value={user?.zone_id ? "Dr. Fatimé Hassan" : "Aucune"} />
        <InfoCard icon={MapPin} label="Zone sanitaire" value={patient?.zone_id ? "N'Djamena Centre" : "Non renseignée"} />
      </div>

      <section className="bg-white rounded-2xl p-7 border border-[#3E2723]/5">
        <h3 className="font-heading text-xl font-semibold text-[#3E2723] flex items-center gap-3">
          <Baby size={20} className="text-[#C85A48]" /> Mon bébé
        </h3>
        <p className="mt-3 text-[#795C55]">
          Une fois votre bébé né, vous pourrez consulter ici son carnet vaccinal et son suivi de croissance.
        </p>
      </section>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
      <div className="w-10 h-10 rounded-xl bg-[#C85A48]/10 text-[#C85A48] flex items-center justify-center">
        <Icon size={18} />
      </div>
      <div className="mt-4 text-xs uppercase tracking-wider text-[#795C55]">{label}</div>
      <div className="mt-1 font-heading font-semibold text-[#3E2723]">{value}</div>
    </div>
  );
}
