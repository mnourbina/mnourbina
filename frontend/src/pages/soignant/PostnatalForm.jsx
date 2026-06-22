import React, { useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Baby, Loader2 } from "lucide-react";

const DANGER_SIGNS = [
  "Saignement abondant",
  "Fièvre persistante",
  "Douleur abdominale sévère",
  "Convulsions",
  "Difficulté à téter",
  "Ictère néonatal",
  "Respiration anormale du nouveau-né",
];

export default function PostnatalForm() {
  const { id: patientId } = useParams();
  const location = useLocation();
  const pregnancyId = location.state?.pregnancyId;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("6h");
  const [form, setForm] = useState({
    visit_date: new Date().toISOString().slice(0, 10),
    bleeding: "",
    uterine_tone: "",
    maternal_temp: "",
    first_breastfeed: false,
    wound_healing: "",
    lochia: "",
    milk_supply: "",
    neonatal_jaundice: false,
    cord_care: "",
    danger_signs: [],
    menstruation_return: false,
    maternal_mental_health: "",
    family_planning: "",
    infant_weight_kg: "",
    notes: "",
  });

  const update = (k, v) => setForm(s => ({ ...s, [k]: v }));
  const toggleDanger = (d) => setForm(s => ({
    ...s,
    danger_signs: s.danger_signs.includes(d) ? s.danger_signs.filter(x => x !== d) : [...s.danger_signs, d]
  }));

  const submit = async (e) => {
    e.preventDefault();
    if (!pregnancyId) return toast.error("Aucune grossesse sélectionnée");
    setLoading(true);
    try {
      const payload = {
        pregnancy_id: pregnancyId,
        stage,
        visit_date: form.visit_date,
        bleeding: form.bleeding || null,
        uterine_tone: form.uterine_tone || null,
        maternal_temp: form.maternal_temp ? Number(form.maternal_temp) : null,
        first_breastfeed: form.first_breastfeed,
        wound_healing: form.wound_healing || null,
        lochia: form.lochia || null,
        milk_supply: form.milk_supply || null,
        neonatal_jaundice: form.neonatal_jaundice,
        cord_care: form.cord_care || null,
        danger_signs: form.danger_signs,
        menstruation_return: form.menstruation_return,
        maternal_mental_health: form.maternal_mental_health || null,
        family_planning: form.family_planning || null,
        infant_weight_kg: form.infant_weight_kg ? Number(form.infant_weight_kg) : null,
        notes: form.notes,
      };
      const { data } = await api.post("/postnatal-visits", payload);
      if (data.alerts?.length) {
        toast.warning("Enregistré avec alertes", { description: data.alerts.join(" · ") });
      } else {
        toast.success("Visite postnatale enregistrée");
      }
      navigate(`/app/soignant/patients/${patientId}`);
    } catch (e) {
      toast.error("Erreur", { description: formatApiErrorDetail(e.response?.data?.detail) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl" data-testid="postnatal-form-page">
      <Link to={`/app/soignant/patients/${patientId}`} className="text-[#795C55] inline-flex items-center gap-2 text-sm hover:text-[#C85A48]">
        <ArrowLeft size={16} /> Retour
      </Link>
      <header>
        <h1 className="font-heading text-3xl font-semibold text-[#3E2723] flex items-center gap-3">
          <Baby className="text-[#C85A48]" size={28} /> Visite postnatale
        </h1>
        <p className="mt-2 text-[#795C55]">Trois fenêtres critiques : 6 heures, 6 jours, 6 semaines.</p>
      </header>

      <form onSubmit={submit} className="space-y-6" data-testid="postnatal-form">
        <div className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
          <Label className="text-sm font-medium text-[#795C55] mb-3 block">Étape</Label>
          <Tabs value={stage} onValueChange={setStage}>
            <TabsList className="grid grid-cols-3 bg-[#F7F3EB] p-1 rounded-xl h-12">
              <TabsTrigger value="6h" data-testid="stage-6h" className="rounded-lg data-[state=active]:bg-[#C85A48] data-[state=active]:text-white">6 heures</TabsTrigger>
              <TabsTrigger value="6j" data-testid="stage-6j" className="rounded-lg data-[state=active]:bg-[#C85A48] data-[state=active]:text-white">6 jours</TabsTrigger>
              <TabsTrigger value="6s" data-testid="stage-6s" className="rounded-lg data-[state=active]:bg-[#C85A48] data-[state=active]:text-white">6 semaines</TabsTrigger>
            </TabsList>
            <div className="mt-4">
              <Label className="text-sm font-medium text-[#795C55] mb-2 block">Date de la visite</Label>
              <Input type="date" value={form.visit_date} onChange={e => update("visit_date", e.target.value)} className="h-11 rounded-xl max-w-xs" />
            </div>
            <TabsContent value="6h" className="mt-5 grid sm:grid-cols-2 gap-5">
              <Field label="Saignement">
                <Select value={form.bleeding} onValueChange={(v) => update("bleeding", v)}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {["normal","abondant","severe"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tonus utérin">
                <Select value={form.uterine_tone} onValueChange={(v) => update("uterine_tone", v)}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ferme">Ferme</SelectItem>
                    <SelectItem value="mou">Mou</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Température maternelle (°C)">
                <Input type="number" step="0.1" value={form.maternal_temp} onChange={e => update("maternal_temp", e.target.value)} className="h-11 rounded-xl" />
              </Field>
              <CheckField label="Première mise au sein réalisée" checked={form.first_breastfeed} onChange={(v) => update("first_breastfeed", v)} />
            </TabsContent>
            <TabsContent value="6j" className="mt-5 grid sm:grid-cols-2 gap-5">
              <Field label="Cicatrisation (plaie/épisio)">
                <Input value={form.wound_healing} onChange={e => update("wound_healing", e.target.value)} placeholder="ex: en cours / propre / infectée" className="h-11 rounded-xl" />
              </Field>
              <Field label="Lochies">
                <Input value={form.lochia} onChange={e => update("lochia", e.target.value)} placeholder="normales / abondantes / fétides" className="h-11 rounded-xl" />
              </Field>
              <Field label="Production lactée">
                <Input value={form.milk_supply} onChange={e => update("milk_supply", e.target.value)} placeholder="suffisante / insuffisante" className="h-11 rounded-xl" />
              </Field>
              <Field label="Soin du cordon">
                <Input value={form.cord_care} onChange={e => update("cord_care", e.target.value)} placeholder="propre / sec / chute" className="h-11 rounded-xl" />
              </Field>
              <CheckField label="Ictère néonatal" checked={form.neonatal_jaundice} onChange={(v) => update("neonatal_jaundice", v)} />
              <div className="sm:col-span-2">
                <Label className="text-sm font-medium text-[#795C55] mb-2 block">Signes de danger observés</Label>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {DANGER_SIGNS.map(d => (
                    <label key={d} className={`flex items-center gap-2 p-3 rounded-xl border text-sm cursor-pointer ${form.danger_signs.includes(d) ? "border-[#B83A2E] bg-[#B83A2E]/5" : "border-[#3E2723]/10"}`}>
                      <Checkbox checked={form.danger_signs.includes(d)} onCheckedChange={() => toggleDanger(d)} />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="6s" className="mt-5 grid sm:grid-cols-2 gap-5">
              <CheckField label="Retour de couches" checked={form.menstruation_return} onChange={(v) => update("menstruation_return", v)} />
              <Field label="Santé mentale maternelle">
                <Select value={form.maternal_mental_health} onValueChange={(v) => update("maternal_mental_health", v)}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonne">Bonne</SelectItem>
                    <SelectItem value="baby_blues">Baby blues</SelectItem>
                    <SelectItem value="depression">Dépression suspectée</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Planning familial choisi">
                <Input value={form.family_planning} onChange={e => update("family_planning", e.target.value)} placeholder="DIU / Implant / Préservatif / Aucun" className="h-11 rounded-xl" />
              </Field>
              <Field label="Poids du bébé (kg)">
                <Input type="number" step="0.1" value={form.infant_weight_kg} onChange={e => update("infant_weight_kg", e.target.value)} className="h-11 rounded-xl" />
              </Field>
            </TabsContent>
          </Tabs>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
          <Label className="text-sm font-medium text-[#795C55] mb-2 block">Notes</Label>
          <Textarea value={form.notes} onChange={e => update("notes", e.target.value)} rows={4} className="rounded-xl" />
        </div>

        <Button type="submit" disabled={loading || !pregnancyId} className="bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl h-12 px-8" data-testid="postnatal-submit">
          {loading ? <Loader2 className="animate-spin" /> : `Enregistrer la visite ${stage}`}
        </Button>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return <div><Label className="text-sm font-medium text-[#795C55] mb-2 block">{label}</Label>{children}</div>;
}
function CheckField({ label, checked, onChange }) {
  return (
    <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer ${checked ? "border-[#C85A48] bg-[#C85A48]/5" : "border-[#3E2723]/10 bg-[#F7F3EB]/40"}`}>
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <span className="font-medium text-[#3E2723]">{label}</span>
    </label>
  );
}
