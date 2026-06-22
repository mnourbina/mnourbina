import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Mail, KeyRound, ArrowRight } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [step, setStep] = useState("credentials"); // credentials | otp
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const submitCredentials = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email: email.trim(), password });
      setTempToken(data.temp_token);
      setDemoOtp(data.otp_code);
      setStep("otp");
      toast.success("Code OTP envoyé (simulé)", {
        description: `Votre code de démonstration : ${data.otp_code}`,
      });
    } catch (e) {
      toast.error("Connexion impossible", { description: formatApiErrorDetail(e.response?.data?.detail) });
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-otp", { temp_token: tempToken, otp_code: otp.trim() });
      setUser(data);
      toast.success(`Bienvenue ${data.name}`);
      navigate("/app");
    } catch (e) {
      toast.error("Code invalide", { description: formatApiErrorDetail(e.response?.data?.detail) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3EB] flex">
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-[#C85A48] to-[#3E2723]">
        <div className="absolute inset-0 bg-grain opacity-30"></div>
        <div className="relative z-10 p-12 flex flex-col justify-between text-white max-w-lg">
          <Logo size={42} />
          <div>
            <h2 className="font-heading text-4xl font-semibold leading-tight">
              Chaque grossesse compte.
              <br />Chaque suivi sauve.
            </h2>
            <p className="mt-6 text-white/80 text-lg leading-relaxed">
              KHALABA accompagne les soignants, les patientes et les autorités sanitaires
              du Tchad dans un parcours de soins maternel et infantile traçable et humain.
            </p>
          </div>
          <div className="text-sm text-white/60">
            © 2026 KHALABA · République du Tchad
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden inline-block mb-8">
            <Logo size={38} />
          </Link>
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-semibold text-[#3E2723]" data-testid="login-title">
              {step === "credentials" ? "Connexion" : "Vérification"}
            </h1>
            <p className="mt-2 text-[#795C55]">
              {step === "credentials"
                ? "Accédez à votre tableau de bord KHALABA."
                : "Saisissez le code à 6 chiffres reçu (simulé pour la démo)."}
            </p>
          </div>

          {step === "credentials" ? (
            <form onSubmit={submitCredentials} className="space-y-5" data-testid="login-form">
              <div>
                <Label className="text-sm font-medium text-[#795C55] mb-2 block">Email</Label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#795C55]" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@khalaba.health"
                    className="pl-11 h-12 rounded-xl bg-white border-[#3E2723]/15 focus:border-[#C85A48] focus:ring-[#C85A48]/30"
                    data-testid="login-email-input"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-[#795C55] mb-2 block">Mot de passe</Label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#795C55]" />
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-11 h-12 rounded-xl bg-white border-[#3E2723]/15 focus:border-[#C85A48] focus:ring-[#C85A48]/30"
                    data-testid="login-password-input"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl text-base font-medium"
                data-testid="login-submit-btn"
              >
                {loading ? <Loader2 className="animate-spin" /> : <>Continuer <ArrowRight size={18} /></>}
              </Button>
            </form>
          ) : (
            <form onSubmit={submitOtp} className="space-y-5" data-testid="otp-form">
              <div className="bg-[#F2C94C]/20 border border-[#F2C94C]/40 rounded-xl px-4 py-3 text-sm text-[#3E2723]">
                <strong>Démo :</strong> votre code est <span className="font-mono font-semibold text-[#C85A48]">{demoOtp}</span>
              </div>
              <div>
                <Label className="text-sm font-medium text-[#795C55] mb-2 block">Code OTP (6 chiffres)</Label>
                <div className="relative">
                  <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#795C55]" />
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="pl-11 h-14 rounded-xl bg-white border-[#3E2723]/15 focus:border-[#C85A48] focus:ring-[#C85A48]/30 font-mono text-xl tracking-[0.4em]"
                    data-testid="otp-input"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full h-12 bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl text-base font-medium"
                data-testid="otp-verify-btn"
              >
                {loading ? <Loader2 className="animate-spin" /> : <>Vérifier <ArrowRight size={18} /></>}
              </Button>
              <button
                type="button"
                onClick={() => setStep("credentials")}
                className="w-full text-center text-sm text-[#795C55] hover:text-[#C85A48]"
                data-testid="otp-back-btn"
              >
                ← Modifier mes identifiants
              </button>
            </form>
          )}

          <div className="mt-8 text-center text-sm text-[#795C55]">
            Pas encore de compte ?{" "}
            <Link to="/register" className="text-[#C85A48] font-medium hover:underline" data-testid="login-register-link">
              Créer un compte
            </Link>
          </div>

          <div className="mt-10 p-4 rounded-xl bg-white border border-[#3E2723]/10 text-xs text-[#795C55]">
            <div className="font-medium text-[#3E2723] mb-2">Comptes de démonstration</div>
            <div className="space-y-1 font-mono">
              <div>admin@khalaba.health · khalaba2026</div>
              <div>sagefemme@khalaba.health · khalaba2026</div>
              <div>maman@khalaba.health · khalaba2026</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
