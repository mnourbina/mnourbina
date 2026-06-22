import React, { useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Stethoscope, Loader2, AlertTriangle } from "lucide-react";

const COMPLICATIONS = [
  "Diabète gestationnel",
  "Anémie",
  "HTA gravidique",
  "Pré-éclampsie",
  "Placenta praevia",
  "Hémorragie",
  "Infection urinaire",
  "Paludisme",
];

export default function CPNForm() {
  const { id: patientId } = useParams();
  const location = useLocation();
  const pregnancyId = location.state?.pregnancyId;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    visit_number: 1,
    visit_date: new Date().toISOString().slice(0, 10),
    gestational_age_weeks: "",
    weight_kg: "",
    bp_systolic: "",
    bp_diastolic: "",
    uterine_height_cm: "",
    fetal_heart_rate: "",
    hemoglobin: "",
    proteinuria: "",
    hiv_status: "",
    syphilis_status: "",
    hepb_status: "",
    iron_folic: false,
    deworming: false,
    tetanus_dose: "",
    malaria_prophylaxis: false,
    complications: [],
    notes: "",
  });

  const update = (k, v) => setForm(s => ({ ...s, [k]: v }));
  const toggleComp = (c) => setForm(s => ({
    ...s,
    complications: s.complications.includes(c)
      ? s.complications.filter(x => x !== c)
      : [...s.complications, c],
  }));

  const submit = async (e) => {
    e.preventDefault();
    if (!pregnancyId) {
      toast.error("Aucune grossesse active sélectionnée");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        pregnancy_id: pregnancyId,
        visit_number: Number(form.visit_number),
        visit_date: form.visit_date,
        gestational_age_weeks: form.gestational_age_weeks ? Number(form.gestational_age_weeks) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        bp_systolic: form.bp_systolic ? Number(form.bp_systolic) : null,
        bp_diastolic: form.bp_diastolic ? Number(form.bp_diastolic) : null,
        uterine_height_cm: form.uterine_height_cm ? Number(form.uterine_height_cm) : null,
        fetal_heart_rate: form.fetal_heart_rate ? Number(form.fetal_heart_rate) : null,
        hemoglobin: form.hemoglobin ? Number(form.hemoglobin) : null,
        proteinuria: form.proteinuria || null,
        hiv_status: form.hiv_status || null,
        syphilis_status: form.syphilis_status || null,
        hepb_status: form.hepb_status || null,
        iron_folic: form.iron_folic,
        deworming: form.deworming,
        tetanus_dose: form.tetanus_dose ? Number(form.tetanus_dose) : null,
        malaria_prophylaxis: form.malaria_prophylaxis,
        complications: form.complications,
        notes: form.notes,
      };
      const { data } = await api.post("/cpn-visits", payload);
      if (data.alerts?.length) {
        toast.warning("CPN enregistrée avec alertes", { description: data.alerts.join(" · ") });
      } else {
        toast.success("CPN enregistrée");
      }
      navigate(`/app/soignant/patients/${patientId}`);
    } catch (e) {
      toast.error("Erreur", { description: formatApiErrorDetail(e.response?.data?.detail) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl" data-testid="cpn-form-page">
      <Link to={`/app/soignant/patients/${patientId}`} className="text-[#795C55] inline-flex items-center gap-2 text-sm hover:text-[#C85A48]">
        <ArrowLeft size={16} /> Retour au dossier
      </Link>
      <header>
        <h1 className="font-heading text-3xl font-semibold text-[#3E2723] flex items-center gap-3">
          <Stethoscope className="text-[#C85A48]" size={28} /> Consultation prénatale
        </h1>
        <p className="mt-2 text-[#795C55]">CPN selon les normes OMS — alertes automatiques sur les valeurs critiques.</p>
      </header>

      {!pregnancyId && (
        <div className="bg-[#B83A2E]/10 border border-[#B83A2E]/30 rounded-xl p-4 text-[#B83A2E] flex items-center gap-2">
          <AlertTriangle size={18} /> Veuillez ouvrir un dossier de grossesse avant de saisir une CPN.
        </div>
      )}

      <form onSubmit={submit} className="space-y-6" data-testid="cpn-form">
        {/* Section : identification */}
        <Card title="Identification">
          <Grid cols={3}>
            <Field label="N° de CPN (1-8)">
              <Input required type="number" min={1} max={8} value={form.visit_number} onChange={e => update("visit_number", e.target.value)} className="h-11 rounded-xl" data-testid="cpn-visit-number" />
            </Field>
            <Field label="Date de la consultation">
              <Input required type="date" value={form.visit_date} onChange={e => update("visit_date", e.target.value)} className="h-11 rounded-xl" data-testid="cpn-visit-date" />
            </Field>
            <Field label="Âge gestationnel (sem.)">
              <Input type="number" step="0.1" value={form.gestational_age_weeks} onChange={e => update("gestational_age_weeks", e.target.value)} className="h-11 rounded-xl" />
            </Field>
          </Grid>
        </Card>

        <Card title="Constantes cliniques">
          <Grid cols={3}>
            <Field label="Poids (kg)">
              <Input type="number" step="0.1" value={form.weight_kg} onChange={e => update("weight_kg", e.target.value)} className="h-11 rounded-xl" data-testid="cpn-weight" />
            </Field>
            <Field label="TA systolique (mmHg)">
              <Input type="number" value={form.bp_systolic} onChange={e => update("bp_systolic", e.target.value)} className="h-11 rounded-xl" data-testid="cpn-bp-sys" />
            </Field>
            <Field label="TA diastolique (mmHg)">
              <Input type="number" value={form.bp_diastolic} onChange={e => update("bp_diastolic", e.target.value)} className="h-11 rounded-xl" data-testid="cpn-bp-dia" />
            </Field>
            <Field label="Hauteur utérine (cm)">
              <Input type="number" step="0.1" value={form.uterine_height_cm} onChange={e => update("uterine_height_cm", e.target.value)} className="h-11 rounded-xl" />
            </Field>
            <Field label="BCF (battements/min)">
              <Input type="number" value={form.fetal_heart_rate} onChange={e => update("fetal_heart_rate", e.target.value)} className="h-11 rounded-xl" />
            </Field>
          </Grid>
        </Card>

        <Card title="Bilans biologiques">
          <Grid cols={3}>
            <Field label="Hémoglobine (g/dL)">
              <Input type="number" step="0.1" value={form.hemoglobin} onChange={e => update("hemoglobin", e.target.value)} className="h-11 rounded-xl" data-testid="cpn-hb" />
            </Field>
            <Field label="Protéinurie">
              <Select value={form.proteinuria} onValueChange={(v) => update("proteinuria", v)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {["negative","+","++","+++"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <StatusField label="VIH" value={form.hiv_status} onChange={(v) => update("hiv_status", v)} />
            <StatusField label="Syphilis" value={form.syphilis_status} onChange={(v) => update("syphilis_status", v)} />
            <StatusField label="Hépatite B" value={form.hepb_status} onChange={(v) => update("hepb_status", v)} />
          </Grid>
        </Card>

        <Card title="Paquets préventifs">
          <Grid cols={2}>
            <CheckField label="Fer + acide folique" checked={form.iron_folic} onChange={(v) => update("iron_folic", v)} />
            <CheckField label="Déparasitage" checked={form.deworming} onChange={(v) => update("deworming", v)} />
            <Field label="Dose de VAT (0-5)">
              <Input type="number" min={0} max={5} value={form.tetanus_dose} onChange={e => update("tetanus_dose", e.target.value)} className="h-11 rounded-xl" />
            </Field>
            <CheckField label="Prophylaxie antipaludique" checked={form.malaria_prophylaxis} onChange={(v) => update("malaria_prophylaxis", v)} />
          </Grid>
        </Card>

        <Card title="Complications observées">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {COMPLICATIONS.map(c => (
              <label key={c} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                form.complications.includes(c)
                  ? "border-[#C85A48] bg-[#C85A48]/5"
                  : "border-[#3E2723]/10 bg-[#F7F3EB]/40"
              }`}>
                <Checkbox checked={form.complications.includes(c)} onCheckedChange={() => toggleComp(c)} />
                <span className="text-sm">{c}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card title="Notes cliniques">
          <Textarea value={form.notes} onChange={e => update("notes", e.target.value)} placeholder="Observations, traitements, recommandations…" rows={4} className="rounded-xl" />
        </Card>

        <Button type="submit" disabled={loading || !pregnancyId} className="bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl h-12 px-8" data-testid="cpn-submit">
          {loading ? <Loader2 className="animate-spin" /> : "Enregistrer la CPN"}
        </Button>
      </form>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-[#795C55] mb-5">{title}</h3>
      {children}
    </div>
  );
}
function Grid({ cols = 3, children }) {
  return <div className={`grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-${cols}`}>{children}</div>;
}
function Field({ label, children }) {
  return <div><Label className="text-sm font-medium text-[#795C55] mb-2 block">{label}</Label>{children}</div>;
}
function StatusField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="negatif">Négatif</SelectItem>
          <SelectItem value="positif">Positif</SelectItem>
          <SelectItem value="non_realise">Non réalisé</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}
function CheckField({ label, checked, onChange }) {
  return (
    <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition ${checked ? "border-[#C85A48] bg-[#C85A48]/5" : "border-[#3E2723]/10 bg-[#F7F3EB]/40"}`}>
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <span className="font-medium text-[#3E2723]">{label}</span>
    </label>
  );
}
