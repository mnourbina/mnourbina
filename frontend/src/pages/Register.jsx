import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/app/Logo";
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
import { Loader2, ArrowRight, Heart, Stethoscope } from "lucide-react";

const ROLES = [
  { value: "patient", label: "Patiente (maman)", icon: Heart, desc: "Suivez votre grossesse et celle de votre bébé." },
  { value: "soignant", label: "Soignant (sage-femme, médecin)", icon: Stethoscope, desc: "Gérez vos patientes et leurs consultations." },
];

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({
    role: "patient",
    name: "",
    email: "",
    password: "",
    phone: "",
    zone_id: "",
    profession: "",
  });
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/zones").then(r => setZones(r.data)).catch(() => {});
  }, []);

  const update = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.zone_id) delete payload.zone_id;
      if (!payload.profession) delete payload.profession;
      if (!payload.phone) delete payload.phone;
      const { data } = await api.post("/auth/register", payload);
      setUser(data);
      toast.success(`Bienvenue ${data.name}`);
      navigate("/app");
    } catch (e) {
      toast.error("Inscription impossible", { description: formatApiErrorDetail(e.response?.data?.detail) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3EB] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-block mb-8">
          <Logo size={38} />
        </Link>
        <div className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(62,39,35,0.06)] border border-[#3E2723]/5 p-8 md:p-10">
          <h1 className="font-heading text-3xl font-semibold text-[#3E2723]" data-testid="register-title">
            Créer un compte
          </h1>
          <p className="mt-2 text-[#795C55]">Rejoignez KHALABA et démarrez votre parcours de soin.</p>

          {/* Role chooser */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => update("role", r.value)}
                data-testid={`role-${r.value}-btn`}
                className={`text-left p-5 rounded-2xl border-2 transition-all ${
                  form.role === r.value
                    ? "border-[#C85A48] bg-[#C85A48]/5"
                    : "border-[#3E2723]/10 hover:border-[#C85A48]/40 bg-white"
                }`}
              >
                <r.icon size={22} className={form.role === r.value ? "text-[#C85A48]" : "text-[#795C55]"} />
                <div className="mt-3 font-heading font-semibold text-[#3E2723]">{r.label}</div>
                <div className="mt-1 text-xs text-[#795C55]">{r.desc}</div>
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-8 space-y-5" data-testid="register-form">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block text-sm font-medium text-[#795C55]">Nom complet</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Fatimé Hassan"
                  className="h-12 rounded-xl bg-white border-[#3E2723]/15"
                  data-testid="register-name-input"
                />
              </div>
              <div>
                <Label className="mb-2 block text-sm font-medium text-[#795C55]">Téléphone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="+235 60 00 00 00"
                  className="h-12 rounded-xl bg-white border-[#3E2723]/15"
                  data-testid="register-phone-input"
                />
              </div>
              <div>
                <Label className="mb-2 block text-sm font-medium text-[#795C55]">Email</Label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="vous@khalaba.health"
                  className="h-12 rounded-xl bg-white border-[#3E2723]/15"
                  data-testid="register-email-input"
                />
              </div>
              <div>
                <Label className="mb-2 block text-sm font-medium text-[#795C55]">Mot de passe</Label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="6 caractères minimum"
                  className="h-12 rounded-xl bg-white border-[#3E2723]/15"
                  data-testid="register-password-input"
                />
              </div>
              <div>
                <Label className="mb-2 block text-sm font-medium text-[#795C55]">Zone sanitaire</Label>
                <Select value={form.zone_id} onValueChange={(v) => update("zone_id", v)}>
                  <SelectTrigger className="h-12 rounded-xl bg-white border-[#3E2723]/15" data-testid="register-zone-select">
                    <SelectValue placeholder="Choisir une zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.role === "soignant" && (
                <div>
                  <Label className="mb-2 block text-sm font-medium text-[#795C55]">Profession</Label>
                  <Select value={form.profession} onValueChange={(v) => update("profession", v)}>
                    <SelectTrigger className="h-12 rounded-xl bg-white border-[#3E2723]/15" data-testid="register-profession-select">
                      <SelectValue placeholder="Votre profession" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sage-femme">Sage-femme</SelectItem>
                      <SelectItem value="Gynécologue">Gynécologue</SelectItem>
                      <SelectItem value="Médecin">Médecin généraliste</SelectItem>
                      <SelectItem value="Infirmier">Infirmier(e)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl font-medium text-base"
              data-testid="register-submit-btn"
            >
              {loading ? <Loader2 className="animate-spin" /> : <>Créer mon compte <ArrowRight size={18} /></>}
            </Button>

            <div className="text-center text-sm text-[#795C55]">
              Déjà inscrit ?{" "}
              <Link to="/login" className="text-[#C85A48] font-medium hover:underline" data-testid="register-login-link">
                Se connecter
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
