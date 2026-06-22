import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { Heart, Stethoscope, AlertTriangle, Calendar, MapPin, Baby } from "lucide-react";

export default function PatientDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/patient/me/timeline").then(r => setData(r.data)).catch(() => setData({}));
  }, []);

  if (!data) return <div className="text-[#795C55]">{t("loading")}</div>;
  const pregnancy = data.pregnancies?.[0];
  const cpnVisits = pregnancy?.cpn_visits || [];
  const postnatal = pregnancy?.postnatal_visits || [];
  const eddDays = pregnancy?.lmp_date
    ? Math.max(0, 280 - Math.floor((Date.now() - new Date(pregnancy.lmp_date)) / (1000*60*60*24)))
    : null;

  return (
    <div className="space-y-8" data-testid="patient-dashboard">
      <header>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#C85A48]">{t("patient.welcome")}</span>
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#3E2723] mt-2">
          {t("patient.greeting", { name: user?.name?.split(" ")[0] || "" })}
        </h1>
        <p className="mt-2 text-[#795C55]">{t("patient.subtitle")}</p>
      </header>

      <section className="bg-gradient-to-br from-[#C85A48] to-[#B34D3D] rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-[#F2C94C]/30 blur-2xl"></div>
        <div className="relative">
          <Heart size={28} />
          <h2 className="font-heading text-2xl font-semibold mt-4">{t("patient.pregnancy")}</h2>
          {pregnancy ? (
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs uppercase tracking-wider text-white/70">DDR</div>
                <div className="font-heading text-xl mt-1">{pregnancy.lmp_date}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-white/70">EDD</div>
                <div className="font-heading text-xl mt-1">{t("patient.edd_days", { days: eddDays })}</div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-white/80">{t("patient.no_pregnancy")}</p>
          )}
        </div>
      </section>

      {pregnancy && (
        <section className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
          <h3 className="font-heading text-xl font-semibold text-[#3E2723] flex items-center gap-3">
            <Stethoscope size={20} className="text-[#C85A48]" /> {t("patient.cpn_history")}
          </h3>
          {cpnVisits.length === 0 ? (
            <p className="mt-4 text-[#795C55]">{t("patient.no_cpn")}</p>
          ) : (
            <ol className="mt-6 relative border-l-2 border-[#C85A48]/20 ml-3 space-y-6" data-testid="patient-cpn-list">
              {cpnVisits.map(v => (
                <li key={v.id} className="ml-6">
                  <div className="absolute -left-[11px] w-5 h-5 rounded-full bg-[#C85A48] border-4 border-white flex items-center justify-center text-[10px] font-bold text-white">
                    {v.visit_number}
                  </div>
                  <div className="bg-[#F7F3EB] rounded-xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-[#3E2723]">CPN n° {v.visit_number} · {v.visit_date}</div>
                      {v.alerts?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {v.alerts.map((a, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[#B83A2E]/15 text-[#B83A2E] font-medium">
                              <AlertTriangle size={10} /> {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-[#795C55] flex flex-wrap gap-x-4 gap-y-1">
                      {v.weight_kg && <span>{v.weight_kg} kg</span>}
                      {v.bp_systolic && <span>TA {v.bp_systolic}/{v.bp_diastolic}</span>}
                      {v.uterine_height_cm && <span>HU {v.uterine_height_cm} cm</span>}
                      {v.fetal_heart_rate && <span>BCF {v.fetal_heart_rate}</span>}
                      {v.hemoglobin && <span>Hb {v.hemoglobin}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {pregnancy && (
        <section className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
          <h3 className="font-heading text-xl font-semibold text-[#3E2723] flex items-center gap-3">
            <Baby size={20} className="text-[#C85A48]" /> {t("patient.postnatal_history")}
          </h3>
          {postnatal.length === 0 ? (
            <p className="mt-4 text-[#795C55]">{t("patient.no_postnatal")}</p>
          ) : (
            <ul className="mt-4 divide-y divide-[#3E2723]/5" data-testid="patient-postnatal-list">
              {postnatal.map(p => (
                <li key={p.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-[#3E2723]">Étape {p.stage} · {p.visit_date}</div>
                    {p.notes && <div className="text-sm text-[#795C55] mt-1">{p.notes}</div>}
                  </div>
                  {p.alerts?.length > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full bg-[#B83A2E]/15 text-[#B83A2E] font-medium">{p.alerts[0]}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
