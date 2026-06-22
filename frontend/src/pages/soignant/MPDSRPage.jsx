import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, Plus, Loader2 } from "lucide-react";

export default function MPDSRPage() {
  const [reports, setReports] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    death_type: "maternelle",
    death_date: new Date().toISOString().slice(0, 10),
    place_of_death: "",
    medical_cause: "",
    contributing: "",
    audit_recommendations: "",
    audit_status: "en_attente_audit",
    audit_date: "",
    delay1_recours: false,
    delay2_acces: false,
    delay3_prise_charge: false,
    preventable: false,
    preventive_actions: "",
    notes: "",
  });

  const load = () => api.get("/mpdsr").then(r => setReports(r.data));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/mpdsr", {
        death_type: form.death_type,
        death_date: form.death_date,
        place_of_death: form.place_of_death,
        medical_cause: form.medical_cause,
        contributing_factors: form.contributing.split(",").map(s => s.trim()).filter(Boolean),
        audit_recommendations: form.audit_recommendations,
        audit_status: form.audit_status,
        audit_date: form.audit_date || null,
        delay1_recours: form.delay1_recours,
        delay2_acces: form.delay2_acces,
        delay3_prise_charge: form.delay3_prise_charge,
        preventable: form.preventable,
        preventive_actions: form.preventive_actions,
        notes: form.notes,
      });
      toast.success("Rapport MPDSR enregistré");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6" data-testid="mpdsr-page">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-[#3E2723] flex items-center gap-3">
            <AlertTriangle className="text-[#B83A2E]" size={28} /> Surveillance MPDSR
          </h1>
          <p className="mt-2 text-[#795C55]">Maternal and Perinatal Death Surveillance and Response. Déclaration obligatoire.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="inline-flex items-center gap-2 bg-[#B83A2E] hover:bg-[#9c2f25] text-white px-5 h-11 rounded-xl font-medium" data-testid="new-mpdsr-btn">
              <Plus size={18} /> Nouveau rapport
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-white rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl text-[#3E2723]">Déclaration MPDSR</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4" data-testid="mpdsr-form">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-[#795C55] mb-1 block">Type de décès</Label>
                  <Select value={form.death_type} onValueChange={(v) => setForm({...form, death_type: v})}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maternelle">Mort maternelle</SelectItem>
                      <SelectItem value="neonatale">Mort néonatale</SelectItem>
                      <SelectItem value="foetal_in_utero">Mort fœtale in utero</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm text-[#795C55] mb-1 block">Date du décès</Label>
                  <Input type="date" required value={form.death_date} onChange={e => setForm({...form, death_date: e.target.value})} className="h-11 rounded-xl" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm text-[#795C55] mb-1 block">Lieu du décès</Label>
                  <Input required value={form.place_of_death} onChange={e => setForm({...form, place_of_death: e.target.value})} placeholder="Hôpital / Domicile / Trajet" className="h-11 rounded-xl" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm text-[#795C55] mb-1 block">Cause médicale précise</Label>
                  <Input required value={form.medical_cause} onChange={e => setForm({...form, medical_cause: e.target.value})} placeholder="Hémorragie post-partum, éclampsie, asphyxie…" className="h-11 rounded-xl" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm text-[#795C55] mb-1 block">Facteurs contributifs (séparés par virgule)</Label>
                  <Input value={form.contributing} onChange={e => setForm({...form, contributing: e.target.value})} placeholder="Retard de référence, manque de sang, ..." className="h-11 rounded-xl" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm text-[#795C55] mb-1 block">Recommandations d'audit</Label>
                  <Textarea value={form.audit_recommendations} onChange={e => setForm({...form, audit_recommendations: e.target.value})} rows={3} className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-sm text-[#795C55] mb-1 block">Statut audit (MPDSR)</Label>
                  <Select value={form.audit_status} onValueChange={(v) => setForm({...form, audit_status: v})}>
                    <SelectTrigger className="h-11 rounded-xl" data-testid="audit-status-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en_attente_audit">En attente d'audit</SelectItem>
                      <SelectItem value="audite_en_comite">Audité en comité</SelectItem>
                      <SelectItem value="cloture">Clôturé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm text-[#795C55] mb-1 block">Date audit</Label>
                  <Input type="date" value={form.audit_date} onChange={e => setForm({...form, audit_date: e.target.value})} className="h-11 rounded-xl" data-testid="audit-date-input" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm text-[#795C55] mb-2 block font-medium">3 retards OMS (cocher ceux applicables)</Label>
                  <div className="grid sm:grid-cols-3 gap-2" data-testid="three-delays">
                    {[
                      { k: "delay1_recours", label: "1er retard — Recours aux soins" },
                      { k: "delay2_acces",   label: "2ème retard — Accès à la structure" },
                      { k: "delay3_prise_charge", label: "3ème retard — Prise en charge" },
                    ].map(d => (
                      <label key={d.k} className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer text-sm ${form[d.k] ? "border-[#B83A2E] bg-[#B83A2E]/5" : "border-[#3E2723]/10 bg-[#F7F3EB]/40"}`}>
                        <input
                          type="checkbox"
                          checked={form[d.k]}
                          onChange={e => setForm({...form, [d.k]: e.target.checked})}
                          className="mt-0.5"
                          data-testid={`delay-${d.k}`}
                        />
                        <span className="font-medium text-[#3E2723]">{d.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${form.preventable ? "border-[#F2C94C] bg-[#F2C94C]/15" : "border-[#3E2723]/10 bg-[#F7F3EB]/40"}`}>
                    <input
                      type="checkbox"
                      checked={form.preventable}
                      onChange={e => setForm({...form, preventable: e.target.checked})}
                      data-testid="preventable-check"
                    />
                    <span className="font-medium text-[#3E2723]">Ce décès était évitable</span>
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm text-[#795C55] mb-1 block">Actions préventives recommandées</Label>
                  <Textarea
                    value={form.preventive_actions}
                    onChange={e => setForm({...form, preventive_actions: e.target.value})}
                    rows={3}
                    placeholder="Ex : Renforcer la formation des sages-femmes sur l'hémorragie du post-partum, sécuriser l'approvisionnement en ocytocine…"
                    className="rounded-xl"
                    data-testid="preventive-actions"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm text-[#795C55] mb-1 block">Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="rounded-xl" />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="bg-[#B83A2E] hover:bg-[#9c2f25] text-white rounded-xl w-full h-12" data-testid="mpdsr-submit">
                {loading ? <Loader2 className="animate-spin" /> : "Soumettre la déclaration"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <section className="bg-white rounded-2xl border border-[#3E2723]/5 overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-10 text-center text-[#795C55]">
            <AlertTriangle size={32} className="mx-auto text-[#B83A2E]/50 mb-3" />
            Aucun rapport déclaré dans votre zone. Espérons que cela continue.
          </div>
        ) : (
          <table className="w-full" data-testid="mpdsr-table">
            <thead className="bg-[#F7F3EB]">
              <tr className="text-left text-xs uppercase tracking-wider text-[#795C55]">
                <th className="px-6 py-3">Date décès</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Lieu</th>
                <th className="px-6 py-3">Cause</th>
                <th className="px-6 py-3">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3E2723]/5">
              {reports.map(r => (
                <tr key={r.id} className="text-sm">
                  <td className="px-6 py-4 text-[#3E2723]">{r.death_date}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.death_type === "maternelle" ? "bg-[#B83A2E]/15 text-[#B83A2E]" : "bg-[#D99A5A]/20 text-[#795C55]"}`}>
                      {r.death_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#795C55]">{r.place_of_death}</td>
                  <td className="px-6 py-4 text-[#3E2723]">{r.medical_cause}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      r.audit_status === "audite_en_comite" ? "bg-[#4A7C59]/15 text-[#4A7C59]" :
                      r.audit_status === "en_attente" ? "bg-[#F2C94C]/30 text-[#3E2723]" :
                      "bg-[#3E2723]/10 text-[#795C55]"
                    }`}>
                      {r.audit_status || "non_audite"}
                    </span>
                    {r.audit_date && <div className="text-xs text-[#795C55] mt-1">{r.audit_date}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
