import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Calendar as CalendarIcon } from "lucide-react";

export default function SoignantAgenda() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get("/appointments").then(r => setItems(r.data)).catch(() => {});
  }, []);
  return (
    <div className="space-y-6" data-testid="soignant-agenda">
      <header>
        <h1 className="font-heading text-3xl font-semibold text-[#3E2723]">Agenda</h1>
        <p className="mt-2 text-[#795C55]">Vos rendez-vous et consultations programmées.</p>
      </header>
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-[#3E2723]/5 text-center text-[#795C55]">
          <CalendarIcon size={32} className="mx-auto mb-4 text-[#C85A48]/60" />
          Aucun rendez-vous programmé pour le moment.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map(a => (
            <li key={a.id} className="bg-white rounded-2xl p-5 border border-[#3E2723]/5 flex items-center justify-between">
              <div>
                <div className="font-heading font-semibold text-[#3E2723]">{a.type}</div>
                <div className="text-sm text-[#795C55]">{new Date(a.scheduled_at).toLocaleString("fr-FR")}</div>
              </div>
              <span className="text-xs uppercase px-3 py-1 rounded-full bg-[#F2C94C]/30 text-[#3E2723] font-medium">
                {a.status || "Prévu"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
