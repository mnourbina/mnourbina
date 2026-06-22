import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Baby, Syringe } from "lucide-react";

export default function PatientBaby() {
  const [children, setChildren] = useState([]);
  useEffect(() => {
    api.get("/patients").then(r => {
      const patient = r.data[0];
      if (patient) {
        api.get("/children", { params: { patient_id: patient.id } }).then(c => setChildren(c.data));
      }
    });
  }, []);
  return (
    <div className="space-y-6" data-testid="patient-baby">
      <header>
        <h1 className="font-heading text-3xl font-semibold text-[#3E2723]">Mon bébé</h1>
        <p className="mt-2 text-[#795C55]">Carnet vaccinal et suivi.</p>
      </header>
      {children.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-[#3E2723]/5 text-center text-[#795C55]">
          <Baby size={32} className="mx-auto mb-4 text-[#C85A48]/60" />
          Aucun bébé enregistré pour le moment.
        </div>
      ) : (
        children.map(c => (
          <div key={c.id} className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
            <div className="flex items-center gap-3 mb-3">
              <Baby size={20} className="text-[#C85A48]" />
              <h3 className="font-heading text-xl font-semibold">{c.full_name || "Bébé"}</h3>
            </div>
            <div className="text-sm text-[#795C55]">Né le {c.dob} · {c.sex === "F" ? "Fille" : "Garçon"}</div>
          </div>
        ))
      )}
    </div>
  );
}
