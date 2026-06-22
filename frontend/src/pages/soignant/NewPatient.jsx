import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
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
import { ArrowLeft, UserPlus, Loader2 } from "lucide-react";

export default function NewPatient() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    dob: "",
    phone: "",
    address: "",
    zone_id: user?.zone_id || "",
    blood_group: "",
    emergency_contact: "",
  });

  useEffect(() => {
    api.get("/zones").then(r => setZones(r.data));
  }, []);

  const update = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/patients", form);
      toast.success("Patiente créée");
      navigate(`/app/soignant/patients/${data.id}`);
    } catch (e) {
      toast.error("Erreur", { description: formatApiErrorDetail(e.response?.data?.detail) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="new-patient-page">
      <button onClick={() => navigate(-1)} className="text-[#795C55] inline-flex items-center gap-2 text-sm hover:text-[#C85A48]">
        <ArrowLeft size={16} /> Retour
      </button>
      <header>
        <h1 className="font-heading text-3xl font-semibold text-[#3E2723] flex items-center gap-3">
          <UserPlus className="text-[#C85A48]" size={28} /> Nouvelle patiente
        </h1>
        <p className="mt-2 text-[#795C55]">Enregistrez les informations administratives et démographiques.</p>
      </header>

      <form onSubmit={submit} className="bg-white rounded-2xl p-7 border border-[#3E2723]/5 space-y-5" data-testid="new-patient-form">
        <div className="grid md:grid-cols-2 gap-5">
          <Field label="Nom complet">
            <Input required value={form.full_name} onChange={e => update("full_name", e.target.value)} placeholder="Aïcha Mahamat" className="h-11 rounded-xl bg-[#F7F3EB]/40 border-[#3E2723]/15" data-testid="np-name" />
          </Field>
          <Field label="Date de naissance">
            <Input required type="date" value={form.dob} onChange={e => update("dob", e.target.value)} className="h-11 rounded-xl bg-[#F7F3EB]/40 border-[#3E2723]/15" data-testid="np-dob" />
          </Field>
          <Field label="Téléphone">
            <Input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+235 66 00 00 00" className="h-11 rounded-xl bg-[#F7F3EB]/40 border-[#3E2723]/15" data-testid="np-phone" />
          </Field>
          <Field label="Contact d'urgence">
            <Input value={form.emergency_contact} onChange={e => update("emergency_contact", e.target.value)} placeholder="+235 66 00 00 01" className="h-11 rounded-xl bg-[#F7F3EB]/40 border-[#3E2723]/15" data-testid="np-emergency" />
          </Field>
          <Field label="Adresse" full>
            <Input value={form.address} onChange={e => update("address", e.target.value)} placeholder="Quartier, ville" className="h-11 rounded-xl bg-[#F7F3EB]/40 border-[#3E2723]/15" data-testid="np-address" />
          </Field>
          <Field label="Zone sanitaire">
            <Select required value={form.zone_id} onValueChange={(v) => update("zone_id", v)}>
              <SelectTrigger className="h-11 rounded-xl bg-[#F7F3EB]/40 border-[#3E2723]/15" data-testid="np-zone">
                <SelectValue placeholder="Choisir une zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Groupe sanguin">
            <Select value={form.blood_group} onValueChange={(v) => update("blood_group", v)}>
              <SelectTrigger className="h-11 rounded-xl bg-[#F7F3EB]/40 border-[#3E2723]/15" data-testid="np-blood">
                <SelectValue placeholder="Optionnel" />
              </SelectTrigger>
              <SelectContent>
                {["O+","O-","A+","A-","B+","B-","AB+","AB-"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Button type="submit" disabled={loading} className="bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl h-12 px-7" data-testid="np-submit">
          {loading ? <Loader2 className="animate-spin" /> : "Enregistrer la patiente"}
        </Button>
      </form>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <Label className="mb-2 block text-sm font-medium text-[#795C55]">{label}</Label>
      {children}
    </div>
  );
}
