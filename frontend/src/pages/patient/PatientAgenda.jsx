import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useI18n } from "@/i18n/I18nContext";
import { Calendar as CalendarIcon, Clock, Stethoscope } from "lucide-react";

export default function PatientAgenda() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get("/appointments").then(r => setItems(r.data)).catch(() => {});
  }, []);

  const now = Date.now();
  const upcoming = items.filter(a => new Date(a.scheduled_at).getTime() >= now);
  const past = items.filter(a => new Date(a.scheduled_at).getTime() < now);

  return (
    <div className="space-y-6" data-testid="patient-agenda">
      <header>
        <h1 className="font-heading text-3xl font-semibold text-[#3E2723]">{t("patient.appointments_title")}</h1>
        <p className="mt-2 text-[#795C55]">{t("patient.subtitle")}</p>
      </header>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-[#3E2723]/5 text-center text-[#795C55]">
          <CalendarIcon size={32} className="mx-auto mb-4 text-[#C85A48]/60" />
          {t("patient.no_appointments")}
        </div>
      ) : (
        <>
          <Section title={t("agenda.upcoming")} items={upcoming} t={t} />
          <Section title={t("agenda.past")} items={past} t={t} muted />
        </>
      )}
    </div>
  );
}

function Section({ title, items, t, muted }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="font-heading text-lg font-semibold text-[#3E2723] mb-3">{title}</h2>
      <ul className="space-y-3">
        {items.map(a => {
          const d = new Date(a.scheduled_at);
          return (
            <li key={a.id} className={`bg-white rounded-2xl p-5 border border-[#3E2723]/5 flex items-center gap-4 ${muted ? "opacity-75" : ""}`}>
              <div className="w-14 text-center">
                <div className="text-xs uppercase text-[#795C55]">
                  {d.toLocaleString(undefined, { month: "short" })}
                </div>
                <div className="font-heading text-2xl font-semibold text-[#3E2723] leading-none mt-1">
                  {d.getDate()}
                </div>
              </div>
              <div className="flex-1">
                <div className="font-heading font-semibold text-[#3E2723] flex items-center gap-2">
                  <Stethoscope size={16} className="text-[#C85A48]" /> {a.type}
                </div>
                <div className="text-sm text-[#795C55] flex items-center gap-1 mt-1">
                  <Clock size={12} /> {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </div>
                {a.notes && <div className="text-sm text-[#795C55] mt-1">{a.notes}</div>}
              </div>
              <span className="text-xs uppercase px-3 py-1 rounded-full bg-[#F2C94C]/30 text-[#3E2723] font-medium">
                {t(`agenda.status.${a.status || "scheduled"}`)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
