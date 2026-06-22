import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Calendar as CalendarIcon, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const TYPES = ["CPN", "postnatal", "vaccination", "consultation"];

export default function SoignantAgenda() {
  const { t } = useI18n();
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    patient_id: "",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    type: "CPN",
    notes: "",
  });

  const load = () => {
    api.get("/appointments").then(r => setAppointments(r.data)).catch(() => {});
    api.get("/patients").then(r => setPatients(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString();
      await api.post("/appointments", {
        patient_id: form.patient_id,
        scheduled_at: scheduledAt,
        type: form.type,
        notes: form.notes,
      });
      toast.success(t("agenda.create"));
      setOpen(false);
      setForm({ ...form, patient_id: "", notes: "" });
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/appointments/${id}`, { status });
      toast.success("OK");
      load();
    } catch (e) {
      toast.error("Erreur");
    }
  };

  const apptsByDay = useMemo(() => {
    const map = {};
    appointments.forEach(a => {
      const k = a.scheduled_at.slice(0, 10);
      if (!map[k]) map[k] = [];
      map[k].push(a);
    });
    return map;
  }, [appointments]);

  const selectedKey = selectedDate?.toISOString().slice(0, 10);
  const dayAppts = (apptsByDay[selectedKey] || []).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  const patientName = (pid) => patients.find(p => p.id === pid)?.full_name || "—";

  return (
    <div className="space-y-6" data-testid="soignant-agenda">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-[#3E2723]">{t("agenda.title")}</h1>
          <p className="mt-2 text-[#795C55]">{appointments.length} {t("agenda.title").toLowerCase()}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="inline-flex items-center gap-2 bg-[#C85A48] hover:bg-[#B34D3D] text-white px-5 h-11 rounded-xl font-medium" data-testid="new-appt-btn">
              <Plus size={18} /> {t("agenda.new")}
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-lg bg-white rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl text-[#3E2723]">{t("agenda.new")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4" data-testid="new-appt-form">
              <div>
                <Label className="text-sm text-[#795C55] mb-1 block">{t("agenda.patient")}</Label>
                <Select required value={form.patient_id} onValueChange={(v) => setForm({...form, patient_id: v})}>
                  <SelectTrigger className="h-11 rounded-xl" data-testid="appt-patient-select"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {patients.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm text-[#795C55] mb-1 block">{t("date")}</Label>
                  <Input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="h-11 rounded-xl" data-testid="appt-date" />
                </div>
                <div>
                  <Label className="text-sm text-[#795C55] mb-1 block">Heure</Label>
                  <Input required type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} className="h-11 rounded-xl" data-testid="appt-time" />
                </div>
              </div>
              <div>
                <Label className="text-sm text-[#795C55] mb-1 block">{t("agenda.consult_type")}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({...form, type: v})}>
                  <SelectTrigger className="h-11 rounded-xl" data-testid="appt-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-[#795C55] mb-1 block">{t("notes")}</Label>
                <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="rounded-xl" />
              </div>
              <Button type="submit" disabled={loading || !form.patient_id} className="bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl w-full h-11" data-testid="appt-submit">
                {loading ? <Loader2 className="animate-spin" /> : t("agenda.create")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid lg:grid-cols-[auto,1fr] gap-6">
        <div className="bg-white rounded-2xl p-4 border border-[#3E2723]/5 self-start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && setSelectedDate(d)}
            modifiers={{
              hasAppt: (day) => !!apptsByDay[day.toISOString().slice(0, 10)],
            }}
            modifiersClassNames={{
              hasAppt: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-[#C85A48] relative",
            }}
            className="rounded-md"
          />
        </div>

        <section className="bg-white rounded-2xl p-5 border border-[#3E2723]/5">
          <h2 className="font-heading text-lg font-semibold text-[#3E2723] flex items-center gap-2 mb-4">
            <CalendarIcon size={18} className="text-[#C85A48]" />
            {selectedDate?.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h2>
          {dayAppts.length === 0 ? (
            <div className="py-10 text-center text-[#795C55] text-sm">{t("agenda.no_appts")}</div>
          ) : (
            <ul className="space-y-3" data-testid="day-appts-list">
              {dayAppts.map(a => {
                const d = new Date(a.scheduled_at);
                return (
                  <li key={a.id} className="flex items-center gap-4 p-3 rounded-xl bg-[#F7F3EB]/50 border border-[#3E2723]/5">
                    <div className="text-center w-14">
                      <Clock size={14} className="mx-auto text-[#795C55]" />
                      <div className="font-mono text-sm text-[#3E2723] mt-1">
                        {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[#3E2723]">{patientName(a.patient_id)}</div>
                      <div className="text-sm text-[#795C55]">{a.type}{a.notes ? ` · ${a.notes}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs uppercase px-2 py-1 rounded-full font-medium ${
                        a.status === "done" ? "bg-[#4A7C59]/15 text-[#4A7C59]" :
                        a.status === "missed" ? "bg-[#B83A2E]/15 text-[#B83A2E]" :
                        "bg-[#F2C94C]/30 text-[#3E2723]"
                      }`}>
                        {t(`agenda.status.${a.status || "scheduled"}`)}
                      </span>
                      {a.status !== "done" && (
                        <button onClick={() => updateStatus(a.id, "done")} className="p-1.5 rounded-lg text-[#4A7C59] hover:bg-[#4A7C59]/10" title={t("agenda.mark_done")} data-testid={`mark-done-${a.id}`}>
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                      {a.status !== "missed" && (
                        <button onClick={() => updateStatus(a.id, "missed")} className="p-1.5 rounded-lg text-[#B83A2E] hover:bg-[#B83A2E]/10" title={t("agenda.mark_missed")} data-testid={`mark-missed-${a.id}`}>
                          <XCircle size={16} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
