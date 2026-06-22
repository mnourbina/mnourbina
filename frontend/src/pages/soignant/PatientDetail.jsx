import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { ArrowLeft, Stethoscope, Baby, Syringe, FileText, Plus, AlertCircle, Phone, MapPin, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";

export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [pregnancy, setPregnancy] = useState(null);

  const load = () => api.get(`/patients/${id}`).then(r => {
    setPatient(r.data);
    setPregnancy(r.data.pregnancies?.[0] || null);
  });

  useEffect(() => { load(); }, [id]);

  const startPregnancy = async () => {
    const lmp = window.prompt("Date des dernières règles (AAAA-MM-JJ) :");
    if (!lmp) return;
    try {
      await api.post("/pregnancies", { patient_id: id, lmp_date: lmp, parity: 0, gravidity: 1 });
      toast.success("Grossesse ouverte");
      load();
    } catch (e) {
      toast.error("Erreur lors de l'ouverture du dossier");
    }
  };

  if (!patient) return <div className="text-[#795C55]">Chargement…</div>;

  return (
    <div className="space-y-6" data-testid="patient-detail">
      <Link to="/app/soignant/patients" className="text-[#795C55] inline-flex items-center gap-2 text-sm hover:text-[#C85A48]">
        <ArrowLeft size={16} /> Retour aux patientes
      </Link>

      <header className="bg-white rounded-2xl p-7 border border-[#3E2723]/5 flex flex-wrap items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#C85A48]/20 to-[#D99A5A]/30 flex items-center justify-center text-[#C85A48] font-heading font-semibold text-2xl">
          {patient.full_name?.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-2xl font-semibold text-[#3E2723]">{patient.full_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-[#795C55]">
            {patient.dob && <span><CalendarIcon size={14} className="inline mr-1" />{patient.dob}</span>}
            {patient.phone && <span><Phone size={14} className="inline mr-1" />{patient.phone}</span>}
            {patient.address && <span><MapPin size={14} className="inline mr-1" />{patient.address}</span>}
            {patient.blood_group && <span className="text-[#B83A2E] font-medium">{patient.blood_group}</span>}
          </div>
        </div>
      </header>

      {pregnancy ? (
        <PregnancyView pregnancy={pregnancy} patientId={id} onUpdate={load} />
      ) : (
        <div className="bg-[#F2C94C]/15 border-2 border-dashed border-[#F2C94C] rounded-2xl p-8 text-center">
          <AlertCircle size={28} className="mx-auto text-[#C85A48] mb-3" />
          <h3 className="font-heading text-xl font-semibold text-[#3E2723]">Aucune grossesse active</h3>
          <p className="mt-2 text-[#795C55]">Ouvrez un dossier de grossesse pour commencer les CPN.</p>
          <button onClick={startPregnancy} className="mt-5 inline-flex items-center gap-2 bg-[#C85A48] hover:bg-[#B34D3D] text-white px-5 h-11 rounded-xl font-medium" data-testid="open-pregnancy-btn">
            <Plus size={18} /> Ouvrir une grossesse
          </button>
        </div>
      )}
    </div>
  );
}

function PregnancyView({ pregnancy, patientId, onUpdate }) {
  const cpn = pregnancy.cpn_visits || [];
  const postnatal = pregnancy.postnatal_visits || [];
  const eddDays = pregnancy.lmp_date
    ? 280 - Math.floor((Date.now() - new Date(pregnancy.lmp_date)) / (1000*60*60*24))
    : null;

  return (
    <div className="space-y-6">
      <section className="bg-gradient-to-br from-[#C85A48]/10 to-[#D99A5A]/20 rounded-2xl p-6 border border-[#C85A48]/15">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#795C55]">Grossesse en cours</div>
            <div className="font-heading text-xl text-[#3E2723] mt-1">DDR : {pregnancy.lmp_date}</div>
            {eddDays !== null && (
              <div className="text-sm text-[#795C55] mt-1">
                ~ {eddDays > 0 ? `${eddDays} jours avant l'accouchement` : "Accouchement attendu ou dépassé"}
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to={`/app/soignant/patients/${patientId}/cpn`} state={{ pregnancyId: pregnancy.id }} data-testid="action-cpn">
              <ActionBtn icon={Stethoscope}>Nouvelle CPN</ActionBtn>
            </Link>
            <Link to={`/app/soignant/patients/${patientId}/postnatal`} state={{ pregnancyId: pregnancy.id }} data-testid="action-postnatal">
              <ActionBtn icon={Baby}>Postnatal</ActionBtn>
            </Link>
            <Link to={`/app/soignant/patients/${patientId}/vaccination`} state={{ pregnancyId: pregnancy.id, patientId }} data-testid="action-vaccination">
              <ActionBtn icon={Syringe}>Vaccination</ActionBtn>
            </Link>
          </div>
        </div>
      </section>

      <Section title="Consultations prénatales (CPN)" icon={Stethoscope}>
        {cpn.length === 0 ? (
          <Empty msg="Aucune CPN enregistrée. Démarrez la CPN 1." />
        ) : (
          <ul className="divide-y divide-[#3E2723]/5">
            {cpn.map(v => (
              <li key={v.id} className="py-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-[#3E2723]">CPN n° {v.visit_number} · {v.visit_date}</div>
                  <div className="text-sm text-[#795C55] mt-1">
                    {v.weight_kg && `${v.weight_kg} kg · `}
                    {v.bp_systolic && `TA ${v.bp_systolic}/${v.bp_diastolic} · `}
                    {v.uterine_height_cm && `HU ${v.uterine_height_cm} cm · `}
                    {v.fetal_heart_rate && `BCF ${v.fetal_heart_rate}`}
                  </div>
                </div>
                {v.alerts?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {v.alerts.map((a, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-full bg-[#B83A2E]/15 text-[#B83A2E] font-medium">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Suivi postnatal" icon={Baby}>
        {postnatal.length === 0 ? (
          <Empty msg="Aucun suivi postnatal enregistré." />
        ) : (
          <ul className="divide-y divide-[#3E2723]/5">
            {postnatal.map(v => (
              <li key={v.id} className="py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-[#3E2723]">Étape {v.stage} · {v.visit_date}</div>
                  <div className="text-sm text-[#795C55]">{v.notes || ""}</div>
                </div>
                {v.alerts?.length > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-[#B83A2E]/15 text-[#B83A2E] font-medium">
                    {v.alerts[0]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <section className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
      <h3 className="font-heading text-lg font-semibold text-[#3E2723] flex items-center gap-2 mb-3">
        <Icon size={18} className="text-[#C85A48]" /> {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ msg }) {
  return <div className="py-6 text-center text-sm text-[#795C55]">{msg}</div>;
}

function ActionBtn({ icon: Icon, children }) {
  return (
    <button className="inline-flex items-center gap-2 bg-white border border-[#C85A48]/30 text-[#C85A48] hover:bg-[#C85A48] hover:text-white px-4 h-10 rounded-xl font-medium text-sm transition">
      <Icon size={16} /> {children}
    </button>
  );
}
