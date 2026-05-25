import React, { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { api, formatApiError } from "@/lib/api";
import VaccineTimeline from "@/components/VaccineTimeline";
import { ArrowLeft, Plus, Phone, MapPin, CalendarDays, Activity, AlertTriangle, Heart, X, MessageCircle, PhoneCall, Baby, AlertOctagon, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const NAV = [
  { to: "/portail/pro", label: "Tableau de bord", end: true },
  { to: "/portail/pro/patientes", label: "Patientes" },
];

const TABS = [
  { key: "pregnancy", label: "Grossesse & CPN" },
  { key: "complications", label: "Complications" },
  { key: "postnatal", label: "Postnatal & nouveau-ne" },
  { key: "vaccines", label: "Vaccins" },
  { key: "mpdsr", label: "Audit deces" },
  { key: "profile", label: "Profil" },
];

const COMPLICATION_PRESETS = [
  "Diabete gestationnel",
  "HTA gravidique",
  "Pre-eclampsie",
  "Anemie severe",
  "Placenta praevia",
  "Menace accouchement premature",
  "Diabete type 2 preexistant",
  "Hepatite B",
  "VIH",
  "Autre",
];

const DEATH_CAUSES = [
  "Hemorragie",
  "Eclampsie",
  "Septicemie",
  "Avortement complique",
  "Travail dystocique",
  "Asphyxie neonatale",
  "Prematurite",
  "Infection neonatale",
  "Malformation",
  "Autre",
];

export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [pregnancies, setPregnancies] = useState([]);
  const [cpns, setCpns] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [complications, setComplications] = useState([]);
  const [postnatal, setPostnatal] = useState([]);
  const [newborn, setNewborn] = useState(null);
  const [deathAudits, setDeathAudits] = useState([]);
  const [directLogs, setDirectLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("pregnancy");
  const [showCpnForm, setShowCpnForm] = useState(false);
  const [showPregnancyModal, setShowPregnancyModal] = useState(false);
  const [showComplicationModal, setShowComplicationModal] = useState(false);
  const [showPostnatalModal, setShowPostnatalModal] = useState(false);
  const [showNewbornModal, setShowNewbornModal] = useState(false);
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);

  const reload = useCallback(async () => {
    const [pRes, pregsRes, vRes, dRes, chanRes] = await Promise.all([
      api.get(`/patients/${id}`),
      api.get(`/pregnancies?patient_id=${id}`),
      api.get(`/vaccines?patient_id=${id}`),
      api.get(`/death-audits?patient_id=${id}`),
      api.get(`/direct-channel?patient_id=${id}`),
    ]);
    setPatient(pRes.data);
    setPregnancies(pregsRes.data);
    setVaccines(vRes.data);
    setDeathAudits(dRes.data);
    setDirectLogs(chanRes.data);
    const active = pregsRes.data.find(p => p.status === "active") || pregsRes.data[0];
    if (active) {
      const [cRes, compRes, pnRes, nbRes] = await Promise.all([
        api.get(`/cpn?pregnancy_id=${active.id}`),
        api.get(`/complications?pregnancy_id=${active.id}`),
        api.get(`/postnatal?pregnancy_id=${active.id}`),
        api.get(`/newborns?pregnancy_id=${active.id}`),
      ]);
      setCpns(cRes.data);
      setComplications(compRes.data);
      setPostnatal(pnRes.data);
      setNewborn(nbRes.data[0] || null);
    } else {
      setCpns([]); setComplications([]); setPostnatal([]); setNewborn(null);
    }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  if (!patient) {
    return <Layout title="Patiente" nav={NAV}><div className="text-muted-foreground">Chargement...</div></Layout>;
  }

  const activePreg = pregnancies.find(p => p.status === "active") || pregnancies[0];

  const onAdminister = async (dose) => {
    try {
      await api.post(`/vaccines/${dose.id}/administer`, { administered_date: new Date().toISOString().slice(0, 10) });
      toast.success("Vaccin marque comme administre");
      reload();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <Layout title="Patiente" nav={NAV} density="wide">
      <Link to="/portail/pro/patientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="patient-back">
        <ArrowLeft size={14} /> Retour aux patientes
      </Link>

      {/* Patient header */}
      <div className="bg-white border border-border rounded-2xl p-6 mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-3xl font-bold text-foreground" data-testid="patient-detail-name">
                {patient.first_name} {patient.last_name}
              </h1>
              {patient.khalaba_id && (
                <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-primary/10 text-primary font-semibold" data-testid="patient-khalaba-id">
                  {patient.khalaba_id}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> {patient.age} ans</span>
              <span className="inline-flex items-center gap-1"><Phone size={14} /> {patient.phone}</span>
              {patient.district && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {patient.district}</span>}
              <span className="inline-flex items-center gap-1"><Heart size={14} /> Groupe {patient.blood_group}</span>
              <span>G{patient.parity}</span>
            </div>
            {/* Direct channel actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setShowChannelModal(true)}
                data-testid="direct-channel-btn"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
              >
                <PhoneCall size={14} /> Canal direct
              </button>
              <a
                href={`tel:${patient.phone}`}
                data-testid="direct-call-link"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/70 transition-colors"
              >
                <Phone size={14} /> Appeler
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {patient.risk_score >= 4 && (
              <div className="px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                <p className="text-xs font-semibold uppercase tracking-wider">Risque eleve</p>
                <p className="font-display text-2xl font-bold">{patient.risk_score}</p>
              </div>
            )}
            {activePreg && (
              <div className="px-4 py-2 rounded-lg bg-primary/10 text-primary">
                <p className="text-xs font-semibold uppercase tracking-wider">Grossesse</p>
                <p className="font-display text-2xl font-bold">{activePreg.gestational_age_weeks} SA</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-5">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              data-testid={`tab-${t.key}`}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {activeTab === "profile" && (
        <div className="bg-white border border-border rounded-xl p-6 grid sm:grid-cols-2 gap-4 text-sm">
          <InfoRow label="Adresse" value={patient.address || "-"} />
          <InfoRow label="District" value={patient.district || "-"} />
          <InfoRow label="Groupe sanguin" value={patient.blood_group} />
          <InfoRow label="Parite" value={`G${patient.parity}`} />
          <InfoRow label="Structure de rattachement" value={patient.facility_id} />
          <InfoRow label="Cree le" value={new Date(patient.created_at).toLocaleDateString("fr-FR")} />
        </div>
      )}

      {activeTab === "pregnancy" && (
        <div>
          {!activePreg ? (
            <div className="bg-white border border-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground mb-4">Aucune grossesse enregistree.</p>
              <button onClick={() => setShowPregnancyModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm" data-testid="create-pregnancy-btn">
                <Plus size={16} /> Enregistrer une grossesse
              </button>
            </div>
          ) : (
            <>
              <div className="bg-white border border-border rounded-xl p-5 mb-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-6">
                  <Stat label="Age gestationnel" value={`${activePreg.gestational_age_weeks} SA`} />
                  <Stat label="DDR" value={new Date(activePreg.lmp_date).toLocaleDateString("fr-FR")} />
                  <Stat label="DPA" value={new Date(activePreg.expected_delivery_date).toLocaleDateString("fr-FR")} />
                  <Stat label="Contacts CPN" value={`${cpns.length} / 8`} />
                  <Stat label="Score de risque" value={activePreg.risk_score} />
                </div>
                <button onClick={() => setShowCpnForm(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90" data-testid="add-cpn-btn">
                  <Plus size={16} /> Ajouter un contact CPN
                </button>
              </div>

              <div className="bg-white border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="font-display text-lg font-bold flex items-center gap-2"><Activity size={16} /> Historique des CPN</h3>
                </div>
                {cpns.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Aucun contact CPN enregistre.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground text-left">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">#</th>
                          <th className="px-4 py-2.5 font-semibold">Date</th>
                          <th className="px-4 py-2.5 font-semibold">Poids</th>
                          <th className="px-4 py-2.5 font-semibold">TA</th>
                          <th className="px-4 py-2.5 font-semibold">Hb</th>
                          <th className="px-4 py-2.5 font-semibold">Decision</th>
                          <th className="px-4 py-2.5 font-semibold">Alertes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {cpns.map(c => (
                          <tr key={c.id} data-testid={`cpn-row-${c.id}`}>
                            <td className="px-4 py-2.5 font-semibold">CPN {c.contact_number}</td>
                            <td className="px-4 py-2.5">{new Date(c.contact_date).toLocaleDateString("fr-FR")}</td>
                            <td className="px-4 py-2.5">{c.weight_kg ?? "-"} kg</td>
                            <td className="px-4 py-2.5">{c.bp_systolic ?? "-"}/{c.bp_diastolic ?? "-"}</td>
                            <td className="px-4 py-2.5">{c.hemoglobin ?? "-"}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs px-2 py-0.5 rounded font-semibold ${c.decision === "urgence" ? "bg-destructive/10 text-destructive" : c.decision === "reference" ? "bg-[#E59500]/10 text-[#E59500]" : "bg-[#2D7D46]/10 text-[#2D7D46]"}`}>
                                {c.decision}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {c.alerts?.length > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs text-destructive font-semibold">
                                  <AlertTriangle size={12} /> {c.alerts.length}
                                </span>
                              ) : <span className="text-xs text-muted-foreground">-</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "vaccines" && (
        <div className="bg-white border border-border rounded-xl p-6 max-w-3xl">
          <VaccineTimeline doses={vaccines} onAdminister={onAdminister} />
        </div>
      )}

      {activeTab === "complications" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display text-xl font-bold">Complications de grossesse</h2>
            {activePreg && (
              <button onClick={() => setShowComplicationModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90" data-testid="add-complication-btn">
                <Plus size={16} /> Signaler une complication
              </button>
            )}
          </div>
          {complications.length === 0 ? (
            <div className="bg-white border border-border rounded-xl p-8 text-center text-muted-foreground" data-testid="complications-empty">
              Aucune complication enregistree.
            </div>
          ) : (
            <div className="space-y-3">
              {complications.map(c => (
                <div key={c.id} className={`bg-white border-l-4 ${c.severity === "severe" ? "border-l-destructive" : c.severity === "moderate" ? "border-l-[#E59500]" : "border-l-[#2D7D46]"} border border-border rounded-lg p-4`} data-testid={`complication-${c.id}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display font-semibold text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">Detectee le {new Date(c.detected_at).toLocaleDateString("fr-FR")} · gravite : {c.severity}</p>
                      {c.notes && <p className="text-sm mt-2 text-foreground">{c.notes}</p>}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-semibold uppercase ${c.severity === "severe" ? "bg-destructive/10 text-destructive" : c.severity === "moderate" ? "bg-[#E59500]/10 text-[#E59500]" : "bg-[#2D7D46]/10 text-[#2D7D46]"}`}>
                      {c.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "postnatal" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display text-xl font-bold">Suivi postnatal (6h, 6j, 6s) & nouveau-ne</h2>
            {activePreg && (
              <div className="flex gap-2">
                {!newborn && <button onClick={() => setShowNewbornModal(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/70" data-testid="add-newborn-btn"><Baby size={16} /> Enregistrer accouchement</button>}
                <button onClick={() => setShowPostnatalModal(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90" data-testid="add-postnatal-btn"><Plus size={16} /> Visite postnatale</button>
              </div>
            )}
          </div>

          {newborn && (
            <div className="bg-white border border-border rounded-xl p-5 mb-4" data-testid="newborn-card">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center"><Baby size={20} /></span>
                <h3 className="font-display text-lg font-bold">Nouveau-ne</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Stat label="Date" value={new Date(newborn.birth_date).toLocaleDateString("fr-FR")} />
                <Stat label="Sexe" value={newborn.gender === "M" ? "Garcon" : "Fille"} />
                <Stat label="Poids" value={`${newborn.birth_weight_g} g`} />
                <Stat label="Apgar 1' / 5'" value={`${newborn.apgar_1 ?? "-"} / ${newborn.apgar_5 ?? "-"}`} />
              </div>
              {newborn.is_low_birth_weight && (
                <div className="mt-3 text-xs px-3 py-2 rounded bg-destructive/10 text-destructive font-semibold inline-block">Faible poids de naissance</div>
              )}
            </div>
          )}

          {postnatal.length === 0 ? (
            <div className="bg-white border border-border rounded-xl p-8 text-center text-muted-foreground" data-testid="postnatal-empty">
              Aucune visite postnatale enregistree.
            </div>
          ) : (
            <div className="space-y-3">
              {postnatal.map(v => (
                <div key={v.id} className="bg-white border border-border rounded-lg p-4" data-testid={`postnatal-${v.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-display font-semibold text-foreground">
                      Contact {v.step} — {v.step === 1 ? "6 heures" : v.step === 2 ? "6 jours" : "6 semaines"}
                    </p>
                    <span className="text-xs text-muted-foreground">{new Date(v.visit_date).toLocaleDateString("fr-FR")}</span>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3 text-sm">
                    {v.maternal_temp != null && <span>T° mere: <b>{v.maternal_temp}°C</b></span>}
                    {v.maternal_bleeding && <span>Saignement: <b>{v.maternal_bleeding}</b></span>}
                    {v.breastfeeding_status && <span>Allaitement: <b>{v.breastfeeding_status}</b></span>}
                    {v.newborn_jaundice != null && <span>Ictere: <b>{v.newborn_jaundice ? "oui" : "non"}</b></span>}
                    {v.newborn_cord_status && <span>Cordon: <b>{v.newborn_cord_status}</b></span>}
                  </div>
                  {v.alerts?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {v.alerts.map((a, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "mpdsr" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2"><AlertOctagon className="text-destructive" size={20} /> Audit MPDSR</h2>
              <p className="text-sm text-muted-foreground">Surveillance des deces maternels et neonataux — riposte coordonnee</p>
            </div>
            <button onClick={() => setShowDeathModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90" data-testid="add-death-audit-btn">
              <ShieldAlert size={16} /> Declarer un deces
            </button>
          </div>

          {deathAudits.length === 0 ? (
            <div className="bg-white border border-border rounded-xl p-8 text-center text-muted-foreground" data-testid="mpdsr-empty">
              Aucun audit MPDSR enregistre.
            </div>
          ) : (
            <div className="space-y-3">
              {deathAudits.map(d => (
                <div key={d.id} className="bg-white border-l-4 border-l-destructive border border-border rounded-lg p-5" data-testid={`mpdsr-${d.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-display font-bold text-foreground text-lg">{d.primary_cause}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Deces {d.death_type === "maternal" ? "maternel" : "neonatal"} · {new Date(d.death_date).toLocaleDateString("fr-FR")} · {d.location || "non precise"}
                      </p>
                      {d.contributing_factors && <p className="text-sm mt-2"><span className="font-semibold">Facteurs contributifs : </span>{d.contributing_factors}</p>}
                      {d.audit_recommendations && (
                        <div className="mt-3 p-3 rounded bg-primary/5 border border-primary/15">
                          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Recommandations du comite</p>
                          <p className="text-sm text-foreground">{d.audit_recommendations}</p>
                        </div>
                      )}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded font-semibold uppercase ${d.status === "audited" || d.status === "closed" ? "bg-[#2D7D46]/10 text-[#2D7D46]" : "bg-[#E59500]/10 text-[#E59500]"}`}>
                      {d.status === "pending_audit" ? "En attente audit" : d.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {directLogs.length > 0 && (
            <div className="mt-6">
              <h3 className="font-display font-bold mb-2 text-sm uppercase tracking-wider text-muted-foreground">Historique canal direct</h3>
              <div className="bg-white border border-border rounded-xl divide-y divide-border">
                {directLogs.slice(0, 5).map(l => (
                  <div key={l.id} className="px-4 py-3 text-sm flex items-center gap-3">
                    {l.channel === "call" ? <PhoneCall size={14} className="text-primary" /> : <MessageCircle size={14} className="text-primary" />}
                    <div className="flex-1">
                      <p className="font-medium">{l.purpose.replace("_", " ")}</p>
                      {l.notes && <p className="text-xs text-muted-foreground">{l.notes}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("fr-FR")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCpnForm && activePreg && (
        <CpnFormModal
          pregnancy={activePreg}
          nextContactNumber={cpns.length + 1}
          onClose={() => setShowCpnForm(false)}
          onSaved={() => { setShowCpnForm(false); reload(); toast.success("Contact CPN enregistre"); }}
        />
      )}
      {showPregnancyModal && (
        <PregnancyModal patientId={id} onClose={() => setShowPregnancyModal(false)} onSaved={() => { setShowPregnancyModal(false); reload(); toast.success("Grossesse enregistree"); }} />
      )}
      {showComplicationModal && activePreg && (
        <ComplicationModal pregnancyId={activePreg.id} onClose={() => setShowComplicationModal(false)} onSaved={() => { setShowComplicationModal(false); reload(); toast.success("Complication enregistree"); }} />
      )}
      {showPostnatalModal && activePreg && (
        <PostnatalModal pregnancyId={activePreg.id} nextStep={Math.min(3, postnatal.length + 1)} onClose={() => setShowPostnatalModal(false)} onSaved={() => { setShowPostnatalModal(false); reload(); toast.success("Visite postnatale enregistree"); }} />
      )}
      {showNewbornModal && activePreg && (
        <NewbornModal pregnancyId={activePreg.id} onClose={() => setShowNewbornModal(false)} onSaved={() => { setShowNewbornModal(false); reload(); toast.success("Accouchement enregistre"); }} />
      )}
      {showDeathModal && (
        <DeathAuditModal patientId={id} pregnancyId={activePreg?.id} onClose={() => setShowDeathModal(false)} onSaved={() => { setShowDeathModal(false); reload(); toast.success("Deces declare — audit MPDSR a planifier"); }} />
      )}
      {showChannelModal && (
        <DirectChannelModal patientId={id} onClose={() => setShowChannelModal(false)} onSaved={() => { setShowChannelModal(false); reload(); toast.success("Action canal direct enregistree"); }} />
      )}
    </Layout>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-foreground font-medium mt-0.5">{value}</p>
    </div>
  );
}
function Stat({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function PregnancyModal({ patientId, onClose, onSaved }) {
  const [lmp, setLmp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/pregnancies", { patient_id: patientId, lmp_date: lmp });
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Nouvelle grossesse" onClose={onClose}>
      <form onSubmit={onSubmit} className="p-5">
        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-muted-foreground">Date des dernieres regles (DDR)</label>
        <input type="date" required value={lmp} onChange={(e) => setLmp(e.target.value)} data-testid="pregnancy-lmp-input" className="w-full px-3 py-2.5 rounded-lg border border-border bg-white" />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-medium">Annuler</button>
          <button type="submit" disabled={submitting} data-testid="pregnancy-submit" className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Enregistrer</button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-md"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

const CPN_SECTIONS = [
  { key: "clinical", label: "Examen clinique" },
  { key: "biology", label: "Biologie" },
  { key: "prevention", label: "Prevention" },
  { key: "vaccination", label: "Vaccination" },
  { key: "danger", label: "Signes de danger" },
  { key: "decision", label: "Decision" },
];

function CpnFormModal({ pregnancy, nextContactNumber, onClose, onSaved }) {
  const [form, setForm] = useState({
    pregnancy_id: pregnancy.id,
    contact_number: nextContactNumber,
    contact_date: new Date().toISOString().slice(0, 10),
    weight_kg: "", bp_systolic: "", bp_diastolic: "", fundal_height_cm: "", fetal_heart_rate: "",
    hemoglobin: "", urine_protein: "negative", hiv_status: "negative", syphilis_status: "negative", hepatitis_b_status: "negative",
    iron_folate_given: true, deworming_given: false, tpi_dose: "", mosquito_net_given: false, vat_dose_given: "",
    danger_bleeding: false, danger_headache: false, danger_edema: false, danger_convulsions: false,
    decision: "normal", next_appointment: "", notes: "",
  });
  const [open, setOpen] = useState({ clinical: true, biology: false, prevention: false, vaccination: false, danger: true, decision: true });
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => setForm({ ...form, [k]: v });

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form };
      ["weight_kg", "bp_systolic", "bp_diastolic", "fundal_height_cm", "fetal_heart_rate", "hemoglobin", "tpi_dose", "vat_dose_given", "contact_number"].forEach(k => {
        payload[k] = payload[k] === "" ? null : Number(payload[k]);
      });
      payload.contact_number = Number(form.contact_number);
      if (!payload.next_appointment) delete payload.next_appointment;
      await api.post("/cpn", payload);
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={`Contact CPN ${nextContactNumber}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Numero CPN (1-8)" type="number" value={form.contact_number} onChange={v => set("contact_number", v)} testid="cpn-contact-number" />
          <Input label="Date du contact" type="date" value={form.contact_date} onChange={v => set("contact_date", v)} testid="cpn-contact-date" required />
        </div>

        {CPN_SECTIONS.map(sec => (
          <details key={sec.key} open={open[sec.key]} onToggle={(e) => setOpen({ ...open, [sec.key]: e.currentTarget.open })} className="border border-border rounded-lg">
            <summary className="cursor-pointer px-4 py-3 font-display font-semibold text-foreground hover:bg-secondary/40 select-none" data-testid={`cpn-section-${sec.key}`}>{sec.label}</summary>
            <div className="p-4 pt-2 border-t border-border">
              {sec.key === "clinical" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Input label="Poids (kg)" type="number" step="0.1" value={form.weight_kg} onChange={v => set("weight_kg", v)} testid="cpn-weight" />
                  <Input label="TA systolique" type="number" value={form.bp_systolic} onChange={v => set("bp_systolic", v)} testid="cpn-bp-sys" />
                  <Input label="TA diastolique" type="number" value={form.bp_diastolic} onChange={v => set("bp_diastolic", v)} testid="cpn-bp-dia" />
                  <Input label="Hauteur uterine (cm)" type="number" step="0.1" value={form.fundal_height_cm} onChange={v => set("fundal_height_cm", v)} testid="cpn-fundal" />
                  <Input label="BCF (/min)" type="number" value={form.fetal_heart_rate} onChange={v => set("fetal_heart_rate", v)} testid="cpn-bcf" />
                </div>
              )}
              {sec.key === "biology" && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Hemoglobine (g/dL)" type="number" step="0.1" value={form.hemoglobin} onChange={v => set("hemoglobin", v)} testid="cpn-hb" />
                  <Select label="Albuminurie" value={form.urine_protein} onChange={v => set("urine_protein", v)} options={["negative", "trace", "+", "++", "+++"]} testid="cpn-urine" />
                  <Select label="HIV" value={form.hiv_status} onChange={v => set("hiv_status", v)} options={["negative", "positive", "unknown"]} testid="cpn-hiv" />
                  <Select label="Syphilis" value={form.syphilis_status} onChange={v => set("syphilis_status", v)} options={["negative", "positive", "unknown"]} testid="cpn-syphilis" />
                  <Select label="Hepatite B" value={form.hepatitis_b_status} onChange={v => set("hepatitis_b_status", v)} options={["negative", "positive", "unknown"]} testid="cpn-hepb" />
                </div>
              )}
              {sec.key === "prevention" && (
                <div className="grid grid-cols-2 gap-4">
                  <Checkbox label="Fer + folate" value={form.iron_folate_given} onChange={v => set("iron_folate_given", v)} testid="cpn-iron" />
                  <Checkbox label="Deparasitage (Albendazole)" value={form.deworming_given} onChange={v => set("deworming_given", v)} testid="cpn-deworm" />
                  <Checkbox label="Moustiquaire imprégnée" value={form.mosquito_net_given} onChange={v => set("mosquito_net_given", v)} testid="cpn-net" />
                  <Input label="TPI (dose)" type="number" value={form.tpi_dose} onChange={v => set("tpi_dose", v)} testid="cpn-tpi" />
                </div>
              )}
              {sec.key === "vaccination" && (
                <Input label="VAT dose donnee" type="number" value={form.vat_dose_given} onChange={v => set("vat_dose_given", v)} testid="cpn-vat" />
              )}
              {sec.key === "danger" && (
                <div className="grid grid-cols-2 gap-3">
                  <Checkbox label="Saignement" value={form.danger_bleeding} onChange={v => set("danger_bleeding", v)} testid="cpn-danger-bleeding" />
                  <Checkbox label="Cephalees" value={form.danger_headache} onChange={v => set("danger_headache", v)} testid="cpn-danger-headache" />
                  <Checkbox label="Oedemes" value={form.danger_edema} onChange={v => set("danger_edema", v)} testid="cpn-danger-edema" />
                  <Checkbox label="Convulsions" value={form.danger_convulsions} onChange={v => set("danger_convulsions", v)} testid="cpn-danger-convulsions" />
                </div>
              )}
              {sec.key === "decision" && (
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Decision" value={form.decision} onChange={v => set("decision", v)} options={["normal", "reference", "urgence"]} testid="cpn-decision" />
                  <Input label="Prochain RDV" type="date" value={form.next_appointment} onChange={v => set("next_appointment", v)} testid="cpn-next-rdv" />
                </div>
              )}
            </div>
          </details>
        ))}

        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-muted-foreground">Notes</label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-white" data-testid="cpn-notes" />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-medium">Annuler</button>
          <button type="submit" disabled={submitting} data-testid="cpn-submit-btn" className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">
            {submitting ? "Enregistrement..." : "Enregistrer le contact CPN"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function Input({ label, value, onChange, type = "text", step, required, testid }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} step={step} required={required} value={value ?? ""} onChange={(e) => onChange(e.target.value)} data-testid={testid} className="w-full px-3 py-2 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
    </div>
  );
}
function Select({ label, value, onChange, options, testid }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid} className="w-full px-3 py-2 rounded-lg border border-border bg-white">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function Checkbox({ label, value, onChange, testid }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} data-testid={testid} className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30" />
      <span className="text-sm">{label}</span>
    </label>
  );
}


function ComplicationModal({ pregnancyId, onClose, onSaved }) {
  const [form, setForm] = useState({ pregnancy_id: pregnancyId, name: "HTA gravidique", severity: "moderate", notes: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/complications", form); onSaved(); }
    catch (err) { toast.error(formatApiError(err)); }
    finally { setBusy(false); }
  };
  return (
    <ModalShell title="Signaler une complication" onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <Select label="Type de complication" value={form.name} onChange={v => setForm({ ...form, name: v })} options={COMPLICATION_PRESETS} testid="comp-name" />
        <Select label="Gravite" value={form.severity} onChange={v => setForm({ ...form, severity: v })} options={["mild", "moderate", "severe"]} testid="comp-severity" />
        <div>
          <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">Notes cliniques</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} data-testid="comp-notes" className="w-full px-3 py-2 rounded-lg border border-border bg-white" />
        </div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm">Annuler</button><button type="submit" disabled={busy} data-testid="comp-submit" className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Enregistrer</button></div>
      </form>
    </ModalShell>
  );
}

function NewbornModal({ pregnancyId, onClose, onSaved }) {
  const [form, setForm] = useState({ pregnancy_id: pregnancyId, birth_date: new Date().toISOString().slice(0, 10), birth_weight_g: 3000, gender: "F", apgar_1: 8, apgar_5: 9, early_breastfeeding: true, notes: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const payload = { ...form, birth_weight_g: Number(form.birth_weight_g), apgar_1: Number(form.apgar_1), apgar_5: Number(form.apgar_5) };
      await api.post("/newborns", payload);
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); } finally { setBusy(false); }
  };
  return (
    <ModalShell title="Enregistrer un accouchement" onClose={onClose}>
      <form onSubmit={submit} className="p-5 grid grid-cols-2 gap-4">
        <Input label="Date de naissance" type="date" value={form.birth_date} onChange={v => setForm({ ...form, birth_date: v })} testid="nb-date" required />
        <Input label="Poids (grammes)" type="number" value={form.birth_weight_g} onChange={v => setForm({ ...form, birth_weight_g: v })} testid="nb-weight" />
        <Select label="Sexe" value={form.gender} onChange={v => setForm({ ...form, gender: v })} options={["F", "M"]} testid="nb-gender" />
        <Input label="Apgar 1'" type="number" value={form.apgar_1} onChange={v => setForm({ ...form, apgar_1: v })} testid="nb-apgar1" />
        <Input label="Apgar 5'" type="number" value={form.apgar_5} onChange={v => setForm({ ...form, apgar_5: v })} testid="nb-apgar5" />
        <Checkbox label="Mise au sein dans l'heure" value={form.early_breastfeeding} onChange={v => setForm({ ...form, early_breastfeeding: v })} testid="nb-breastfeed" />
        <div className="col-span-2 flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm">Annuler</button><button type="submit" disabled={busy} data-testid="nb-submit" className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Enregistrer</button></div>
      </form>
    </ModalShell>
  );
}

function PostnatalModal({ pregnancyId, nextStep, onClose, onSaved }) {
  const [form, setForm] = useState({
    pregnancy_id: pregnancyId, step: nextStep || 1,
    visit_date: new Date().toISOString().slice(0, 10),
    maternal_bleeding: "none", uterine_tonus: "firm",
    maternal_temp: "", maternal_pulse: "", has_micturition: true,
    breastfeeding_status: "exclusive",
    newborn_breastfed_early: true, newborn_jaundice: false, newborn_cord_status: "dry",
    newborn_weight_kg: "", newborn_temp: "",
    contraception_plan: "", maternal_mental_health: "normal",
    decision: "normal", notes: "",
  });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const payload = { ...form, step: Number(form.step) };
      ["maternal_temp", "maternal_pulse", "newborn_weight_kg", "newborn_temp"].forEach(k => { payload[k] = payload[k] === "" ? null : Number(payload[k]); });
      await api.post("/postnatal", payload);
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); } finally { setBusy(false); }
  };
  return (
    <ModalShell title={`Visite postnatale ${nextStep}`} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Select label="Etape" value={form.step} onChange={v => setForm({ ...form, step: v })} options={[1, 2, 3]} testid="pn-step" />
          <Input label="Date visite" type="date" value={form.visit_date} onChange={v => setForm({ ...form, visit_date: v })} testid="pn-date" required />
        </div>
        <details open className="border border-border rounded-lg">
          <summary className="cursor-pointer px-4 py-3 font-display font-semibold select-none">Surveillance maternelle</summary>
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3 border-t border-border">
            <Select label="Saignement" value={form.maternal_bleeding} onChange={v => setForm({ ...form, maternal_bleeding: v })} options={["none", "mild", "moderate", "heavy"]} testid="pn-bleeding" />
            <Select label="Tonus uterin" value={form.uterine_tonus} onChange={v => setForm({ ...form, uterine_tonus: v })} options={["firm", "soft", "absent"]} testid="pn-tonus" />
            <Input label="Temperature (°C)" type="number" step="0.1" value={form.maternal_temp} onChange={v => setForm({ ...form, maternal_temp: v })} testid="pn-temp" />
            <Input label="Pouls" type="number" value={form.maternal_pulse} onChange={v => setForm({ ...form, maternal_pulse: v })} testid="pn-pulse" />
            <Select label="Allaitement" value={form.breastfeeding_status} onChange={v => setForm({ ...form, breastfeeding_status: v })} options={["exclusive", "mixed", "none"]} testid="pn-breast" />
            <Select label="Sante mentale" value={form.maternal_mental_health} onChange={v => setForm({ ...form, maternal_mental_health: v })} options={["normal", "moderate", "severe"]} testid="pn-mh" />
          </div>
        </details>
        <details open className="border border-border rounded-lg">
          <summary className="cursor-pointer px-4 py-3 font-display font-semibold select-none">Surveillance nouveau-ne</summary>
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3 border-t border-border">
            <Input label="Poids (kg)" type="number" step="0.01" value={form.newborn_weight_kg} onChange={v => setForm({ ...form, newborn_weight_kg: v })} testid="pn-nb-weight" />
            <Input label="Temperature NN (°C)" type="number" step="0.1" value={form.newborn_temp} onChange={v => setForm({ ...form, newborn_temp: v })} testid="pn-nb-temp" />
            <Select label="Cordon" value={form.newborn_cord_status} onChange={v => setForm({ ...form, newborn_cord_status: v })} options={["dry", "wet", "infected"]} testid="pn-nb-cord" />
            <Checkbox label="Ictere neonatal" value={form.newborn_jaundice} onChange={v => setForm({ ...form, newborn_jaundice: v })} testid="pn-nb-jaundice" />
            <Checkbox label="Mise au sein precoce" value={form.newborn_breastfed_early} onChange={v => setForm({ ...form, newborn_breastfed_early: v })} testid="pn-nb-breastfed" />
          </div>
        </details>
        <div>
          <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-white" data-testid="pn-notes" />
        </div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm">Annuler</button><button type="submit" disabled={busy} data-testid="pn-submit" className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Enregistrer</button></div>
      </form>
    </ModalShell>
  );
}

function DeathAuditModal({ patientId, pregnancyId, onClose, onSaved }) {
  const [form, setForm] = useState({
    patient_id: patientId, pregnancy_id: pregnancyId || null,
    death_type: "maternal",
    death_date: new Date().toISOString().slice(0, 10),
    primary_cause: "Hemorragie",
    contributing_factors: "",
    location: "facility",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/death-audits", form); onSaved(); }
    catch (err) { toast.error(formatApiError(err)); } finally { setBusy(false); }
  };
  return (
    <ModalShell title="Declarer un deces — Audit MPDSR" onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
          Cette declaration declenche une procedure d'audit obligatoire en comite de district.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type de deces" value={form.death_type} onChange={v => setForm({ ...form, death_type: v })} options={["maternal", "neonatal"]} testid="dth-type" />
          <Input label="Date du deces" type="date" value={form.death_date} onChange={v => setForm({ ...form, death_date: v })} testid="dth-date" required />
          <Select label="Cause medicale primaire" value={form.primary_cause} onChange={v => setForm({ ...form, primary_cause: v })} options={DEATH_CAUSES} testid="dth-cause" />
          <Select label="Lieu" value={form.location} onChange={v => setForm({ ...form, location: v })} options={["facility", "home", "transport", "other"]} testid="dth-location" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">Facteurs contributifs</label>
          <textarea value={form.contributing_factors} onChange={(e) => setForm({ ...form, contributing_factors: e.target.value })} rows={2} data-testid="dth-factors" className="w-full px-3 py-2 rounded-lg border border-border bg-white" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} data-testid="dth-notes" className="w-full px-3 py-2 rounded-lg border border-border bg-white" />
        </div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm">Annuler</button><button type="submit" disabled={busy} data-testid="dth-submit" className="px-5 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-60">Declarer le deces</button></div>
      </form>
    </ModalShell>
  );
}

function DirectChannelModal({ patientId, onClose, onSaved }) {
  const [form, setForm] = useState({
    patient_id: patientId, channel: "call", direction: "pro_to_patient",
    purpose: "confirm_appointment", notes: "",
  });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/direct-channel", form); onSaved(); }
    catch (err) { toast.error(formatApiError(err)); } finally { setBusy(false); }
  };
  return (
    <ModalShell title="Canal direct sage-femme / patiente" onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">Tracez l'echange avec la patiente : confirmation de RDV, demande de decalage, conseil medical, signalement de signe de danger.</p>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Canal" value={form.channel} onChange={v => setForm({ ...form, channel: v })} options={["call", "sms", "in_app"]} testid="ch-channel" />
          <Select label="Direction" value={form.direction} onChange={v => setForm({ ...form, direction: v })} options={["pro_to_patient", "patient_to_pro"]} testid="ch-direction" />
        </div>
        <Select label="Motif" value={form.purpose} onChange={v => setForm({ ...form, purpose: v })} options={["confirm_appointment", "reschedule_request", "advice", "danger_report", "other"]} testid="ch-purpose" />
        <div>
          <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">Notes / contenu</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} data-testid="ch-notes" className="w-full px-3 py-2 rounded-lg border border-border bg-white" />
        </div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm">Annuler</button><button type="submit" disabled={busy} data-testid="ch-submit" className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Enregistrer l'echange</button></div>
      </form>
    </ModalShell>
  );
}
