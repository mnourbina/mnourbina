import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Loader2, Lock, ShieldCheck } from "lucide-react";

const DELAYS = [
  { k: "delay1_recours", label: "1er retard — Recours aux soins (décision de la famille)" },
  { k: "delay2_acces",   label: "2ème retard — Accès à la structure de soins" },
  { k: "delay3_prise_charge", label: "3ème retard — Prise en charge médicale dans la structure" },
];

export default function MPDSRAuditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [death, setDeath] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    delay1_recours: false,
    delay2_acces: false,
    delay3_prise_charge: false,
    preventable: false,
    preventive_actions: "",
    audit_recommendations: "",
    audit_date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    api.get(`/auth/pending-audit`).then(r => {
      if (r.data.pending && r.data.pending.id === id) setDeath(r.data.pending);
      else setDeath(null);
    });
  }, [id]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/mpdsr/${id}/complete-audit`, form);
      toast.success("Audit MPDSR clôturé · accès rétabli");
      navigate("/app/soignant/mpdsr", { replace: true });
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="audit-page">
      <header className="bg-[#B83A2E]/10 border-l-4 border-[#B83A2E] rounded-xl p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#B83A2E] flex items-center justify-center text-white shrink-0">
          <Lock size={22} />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[#B83A2E]">Audit MPDSR obligatoire</h1>
          <p className="mt-1 text-[#3E2723] text-sm">
            Aucune autre action ne sera autorisée tant que cet audit ne sera pas clôturé. Le comité MPDSR utilisera ces données pour identifier les leviers d'amélioration.
          </p>
        </div>
      </header>

      {death ? (
        <section className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <Info label="Type" value={death.death_type} />
            <Info label="Date du décès" value={death.death_date} />
            <Info label="Lieu" value={death.place_of_death} />
          </div>
          <div className="mt-4">
            <Label className="text-xs uppercase text-[#795C55]">Cause médicale</Label>
            <p className="mt-1 text-[#3E2723]">{death.medical_cause}</p>
          </div>
        </section>
      ) : (
        <div className="text-[#795C55]">Chargement du dossier MPDSR…</div>
      )}

      <form onSubmit={submit} className="space-y-6" data-testid="audit-form">
        <div className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
          <h3 className="font-heading font-semibold text-[#3E2723] mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-[#B83A2E]" /> Modèle des 3 retards OMS
          </h3>
          <div className="space-y-2">
            {DELAYS.map(d => (
              <label key={d.k} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer ${form[d.k] ? "border-[#B83A2E] bg-[#B83A2E]/5" : "border-[#3E2723]/10 bg-[#F7F3EB]/40"}`}>
                <Checkbox checked={form[d.k]} onCheckedChange={(v) => setForm({...form, [d.k]: !!v})} data-testid={`audit-${d.k}`} />
                <span className="text-sm text-[#3E2723] font-medium">{d.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#3E2723]/5 space-y-4">
          <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer ${form.preventable ? "border-[#F2C94C] bg-[#F2C94C]/15" : "border-[#3E2723]/10 bg-[#F7F3EB]/40"}`}>
            <Checkbox checked={form.preventable} onCheckedChange={(v) => setForm({...form, preventable: !!v})} data-testid="audit-preventable" />
            <span className="font-medium text-[#3E2723]">Le comité estime ce décès évitable</span>
          </label>
          <div>
            <Label className="text-sm text-[#795C55] mb-1 block">Actions préventives recommandées *</Label>
            <Textarea
              required
              value={form.preventive_actions}
              onChange={e => setForm({...form, preventive_actions: e.target.value})}
              rows={4}
              placeholder="Décrire les actions correctives prioritaires (formation, équipement, organisation, référence…)"
              className="rounded-xl"
              data-testid="audit-preventive-actions"
            />
          </div>
          <div>
            <Label className="text-sm text-[#795C55] mb-1 block">Recommandations complémentaires du comité</Label>
            <Textarea value={form.audit_recommendations} onChange={e => setForm({...form, audit_recommendations: e.target.value})} rows={3} className="rounded-xl" />
          </div>
          <div>
            <Label className="text-sm text-[#795C55] mb-1 block">Date de la session d'audit</Label>
            <Input type="date" value={form.audit_date} onChange={e => setForm({...form, audit_date: e.target.value})} className="h-11 rounded-xl max-w-xs" />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading || !form.preventive_actions}
          className="w-full h-12 bg-[#4A7C59] hover:bg-[#3a6448] text-white rounded-xl font-medium"
          data-testid="audit-submit-btn"
        >
          {loading ? <Loader2 className="animate-spin" /> : <><ShieldCheck size={18} /> Clôturer l'audit & lever le blocage</>}
        </Button>
      </form>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-[#795C55]">{label}</div>
      <div className="font-medium text-[#3E2723] mt-0.5">{value || "—"}</div>
    </div>
  );
}
