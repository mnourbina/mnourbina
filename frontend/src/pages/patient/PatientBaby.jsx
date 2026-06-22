import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useI18n } from "@/i18n/I18nContext";
import { Baby, Syringe, CheckCircle2 } from "lucide-react";

export default function PatientBaby() {
  const { t } = useI18n();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/patient/me/timeline").then(r => setData(r.data)).catch(() => setData({}));
  }, []);

  if (!data) return <div className="text-[#795C55]">{t("loading")}</div>;
  const children = data.children || [];

  return (
    <div className="space-y-6" data-testid="patient-baby">
      <header>
        <h1 className="font-heading text-3xl font-semibold text-[#3E2723]">{t("patient.baby_title")}</h1>
        <p className="mt-2 text-[#795C55]">{t("patient.vaccinations")}</p>
      </header>

      {children.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-[#3E2723]/5 text-center text-[#795C55]">
          <Baby size={32} className="mx-auto mb-4 text-[#C85A48]/60" />
          {t("patient.no_baby")}
        </div>
      ) : (
        children.map(c => (
          <article key={c.id} className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
            <header className="flex flex-wrap items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#C85A48]/20 to-[#F2C94C]/30 flex items-center justify-center text-[#C85A48]">
                <Baby size={26} />
              </div>
              <div>
                <h2 className="font-heading text-2xl font-semibold text-[#3E2723]">{c.full_name || "Bébé"}</h2>
                <div className="text-sm text-[#795C55] mt-1">
                  {c.dob} · {c.sex === "F" ? "Fille" : "Garçon"}
                  {c.birth_weight_kg ? ` · ${c.birth_weight_kg} kg` : ""}
                </div>
              </div>
            </header>

            <div className="border-t border-[#3E2723]/5 pt-5">
              <h3 className="font-heading text-lg font-semibold text-[#3E2723] flex items-center gap-2 mb-4">
                <Syringe size={18} className="text-[#C85A48]" /> {t("patient.vaccinations")}
              </h3>
              {(c.vaccinations || []).length === 0 ? (
                <p className="text-[#795C55] text-sm">{t("patient.no_vaccinations")}</p>
              ) : (
                <ul className="grid sm:grid-cols-2 gap-3" data-testid={`vaccinations-${c.id}`}>
                  {c.vaccinations.map(v => (
                    <li key={v.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F7F3EB]">
                      <CheckCircle2 size={20} className="text-[#4A7C59] shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-[#3E2723] truncate">{v.vaccine_name} · Dose {v.dose_number}</div>
                        <div className="text-xs text-[#795C55]">{v.date_given}{v.batch_number ? ` · Lot ${v.batch_number}` : ""}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );
}
