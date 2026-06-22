import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Syringe, Loader2, Plus } from "lucide-react";

const VACCINES = [
  "BCG", "HepB naissance", "Polio 0", "DTC-HepB-Hib 1", "DTC-HepB-Hib 2", "DTC-HepB-Hib 3",
  "Polio 1", "Polio 2", "Polio 3", "Polio inactivé (VPI)", "Pneumo 1", "Pneumo 2", "Pneumo 3",
  "Rota 1", "Rota 2", "ROR", "Fièvre jaune",
];

export default function VaccinationForm() {
  const { id: patientId } = useParams();
  const location = useLocation();
  const pregnancyId = location.state?.pregnancyId;
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [child, setChild] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState({
    full_name: "",
    dob: new Date().toISOString().slice(0, 10),
    sex: "F",
    birth_weight_kg: "",
  });
  const [vac, setVac] = useState({
    vaccine_name: "",
    dose_number: 1,
    date_given: new Date().toISOString().slice(0, 10),
    batch_number: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pregnancyId) {
      api.get("/children", { params: { pregnancy_id: pregnancyId } }).then(r => {
        setChildren(r.data);
        if (r.data[0]) setChild(r.data[0]);
      });
    } else {
      api.get("/children", { params: { patient_id: patientId } }).then(r => {
        setChildren(r.data);
        if (r.data[0]) setChild(r.data[0]);
      });
    }
  }, [pregnancyId, patientId]);

  const createChild = async () => {
    if (!pregnancyId) return toast.error("Aucune grossesse sélectionnée");
    setLoading(true);
    try {
      const { data } = await api.post("/children", {
        pregnancy_id: pregnancyId,
        full_name: creating.full_name || null,
        dob: creating.dob,
        sex: creating.sex,
        birth_weight_kg: creating.birth_weight_kg ? Number(creating.birth_weight_kg) : null,
      });
      toast.success("Enfant enregistré");
      setChildren([data, ...children]);
      setChild(data);
      setShowCreate(false);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  const addVaccination = async (e) => {
    e.preventDefault();
    if (!child) return toast.error("Sélectionnez un enfant");
    setLoading(true);
    try {
      await api.post("/vaccinations", {
        child_id: child.id,
        vaccine_name: vac.vaccine_name,
        dose_number: Number(vac.dose_number),
        date_given: vac.date_given,
        batch_number: vac.batch_number || null,
      });
      toast.success("Vaccination enregistrée");
      setVac({ ...vac, vaccine_name: "", batch_number: "" });
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="vaccination-form-page">
      <Link to={`/app/soignant/patients/${patientId}`} className="text-[#795C55] inline-flex items-center gap-2 text-sm hover:text-[#C85A48]">
        <ArrowLeft size={16} /> Retour
      </Link>
      <header>
        <h1 className="font-heading text-3xl font-semibold text-[#3E2723] flex items-center gap-3">
          <Syringe className="text-[#C85A48]" size={28} /> Carnet vaccinal
        </h1>
      </header>

      <div className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
        <Label className="text-sm font-medium text-[#795C55] mb-3 block">Enfant suivi</Label>
        {children.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {children.map(c => (
              <button key={c.id} type="button" onClick={() => setChild(c)}
                className={`px-4 h-10 rounded-xl text-sm font-medium border ${child?.id === c.id ? "bg-[#C85A48] text-white border-[#C85A48]" : "bg-white text-[#3E2723] border-[#3E2723]/15"}`}>
                {c.full_name || `Bébé né le ${c.dob}`}
              </button>
            ))}
            <button type="button" onClick={() => setShowCreate(true)} className="px-4 h-10 rounded-xl text-sm font-medium border border-dashed border-[#C85A48] text-[#C85A48] inline-flex items-center gap-1">
              <Plus size={14} /> Nouvel enfant
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowCreate(true)} className="px-4 h-10 rounded-xl text-sm font-medium bg-[#C85A48] text-white inline-flex items-center gap-1">
            <Plus size={14} /> Enregistrer un nouveau-né
          </button>
        )}

        {showCreate && (
          <div className="mt-5 p-5 rounded-xl bg-[#F7F3EB] border border-[#3E2723]/10 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-[#795C55] mb-1 block">Prénom</Label>
                <Input value={creating.full_name} onChange={e => setCreating({...creating, full_name: e.target.value})} className="h-10 rounded-lg" />
              </div>
              <div>
                <Label className="text-sm text-[#795C55] mb-1 block">Date de naissance</Label>
                <Input type="date" value={creating.dob} onChange={e => setCreating({...creating, dob: e.target.value})} className="h-10 rounded-lg" />
              </div>
              <div>
                <Label className="text-sm text-[#795C55] mb-1 block">Sexe</Label>
                <Select value={creating.sex} onValueChange={(v) => setCreating({...creating, sex: v})}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">Fille</SelectItem>
                    <SelectItem value="M">Garçon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-[#795C55] mb-1 block">Poids à la naissance (kg)</Label>
                <Input type="number" step="0.1" value={creating.birth_weight_kg} onChange={e => setCreating({...creating, birth_weight_kg: e.target.value})} className="h-10 rounded-lg" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={createChild} disabled={loading} className="bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-lg">
                {loading ? <Loader2 className="animate-spin" size={16}/> : "Enregistrer"}
              </Button>
              <Button type="button" onClick={() => setShowCreate(false)} variant="outline" className="rounded-lg border-[#3E2723]/15">Annuler</Button>
            </div>
          </div>
        )}
      </div>

      {child && (
        <>
          <form onSubmit={addVaccination} className="bg-white rounded-2xl p-6 border border-[#3E2723]/5 space-y-4">
            <h3 className="font-heading text-lg font-semibold text-[#3E2723]">Ajouter une vaccination</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-[#795C55] mb-1 block">Vaccin</Label>
                <Select value={vac.vaccine_name} onValueChange={(v) => setVac({...vac, vaccine_name: v})}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {VACCINES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-[#795C55] mb-1 block">Dose n°</Label>
                <Input type="number" min={1} value={vac.dose_number} onChange={e => setVac({...vac, dose_number: e.target.value})} className="h-11 rounded-xl" />
              </div>
              <div>
                <Label className="text-sm text-[#795C55] mb-1 block">Date d'administration</Label>
                <Input type="date" value={vac.date_given} onChange={e => setVac({...vac, date_given: e.target.value})} className="h-11 rounded-xl" />
              </div>
              <div>
                <Label className="text-sm text-[#795C55] mb-1 block">N° de lot</Label>
                <Input value={vac.batch_number} onChange={e => setVac({...vac, batch_number: e.target.value})} className="h-11 rounded-xl" />
              </div>
            </div>
            <Button type="submit" disabled={loading || !vac.vaccine_name} className="bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl">
              {loading ? <Loader2 className="animate-spin" /> : "Ajouter au carnet"}
            </Button>
          </form>

          <VaccinationLog childId={child.id} />
        </>
      )}
    </div>
  );
}

function VaccinationLog({ childId }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get("/vaccinations", { params: { child_id: childId } }).then(r => setItems(r.data));
  }, [childId]);
  return (
    <div className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
      <h3 className="font-heading text-lg font-semibold text-[#3E2723]">Historique vaccinal</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[#795C55]">Aucune vaccination enregistrée.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#3E2723]/5">
          {items.map(v => (
            <li key={v.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-[#3E2723]">{v.vaccine_name} · Dose {v.dose_number}</div>
                <div className="text-sm text-[#795C55]">{v.date_given}{v.batch_number ? ` · Lot ${v.batch_number}` : ""}</div>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-[#4A7C59]/15 text-[#4A7C59] font-medium">Administré</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
