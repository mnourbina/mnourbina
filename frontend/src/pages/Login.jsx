import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth, roleHome } from "@/lib/auth";
import Logo from "@/components/Logo";
import { ArrowLeft, Stethoscope, Heart } from "lucide-react";

const DEMO = {
  patient: { email: "patiente@khalaba.health", password: "Khalaba2026!" },
  pro: { email: "sagefemme@khalaba.health", password: "Khalaba2026!" },
  admin: { email: "admin@khalaba.health", password: "Khalaba2026!" },
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // 'patient' | 'pro'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      navigate(roleHome(res.user.role));
    } else {
      setError(res.error);
    }
  };

  const fillDemo = (which) => {
    setEmail(DEMO[which].email);
    setPassword(DEMO[which].password);
  };

  return (
    <div className="min-h-screen bg-paper grid lg:grid-cols-2">
      <div className="hidden lg:block relative">
        <img
          src="https://images.unsplash.com/photo-1678695972687-033fa0bdbac9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwyfHxibGFjayUyMGRvY3RvciUyMHNtaWxpbmd8ZW58MHx8fHwxNzc5NDUyODE2fDA&ixlib=rb-4.1.0&q=85"
          alt="Professionnel de sante"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/35 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="text-xs font-bold uppercase tracking-widest mb-3 opacity-90">Khalaba</p>
          <p className="font-display text-3xl font-bold leading-tight max-w-md">
            Chaque grossesse comptee, chaque enfant suivi.
          </p>
        </div>
      </div>

      <div className="flex flex-col p-6 sm:p-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="login-back-link">
          <ArrowLeft size={16} /> Retour
        </Link>
        <div className="my-8 lg:my-12"><Logo size={36} /></div>

        {!mode ? (
          <div className="max-w-md w-full mx-auto lg:mx-0">
            <h1 className="font-display text-3xl font-bold text-foreground">Bienvenue</h1>
            <p className="mt-2 text-muted-foreground">Selectionnez votre profil pour continuer.</p>
            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={() => setMode("patient")}
                data-testid="login-mode-patient"
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-border bg-white hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <span className="w-12 h-12 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center"><Heart size={22} /></span>
                <div>
                  <p className="font-display font-bold text-lg text-foreground">Je suis patiente</p>
                  <p className="text-sm text-muted-foreground">Consulter mes RDV et le suivi de mon enfant</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("pro")}
                data-testid="login-mode-pro"
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-border bg-white hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <span className="w-12 h-12 rounded-xl bg-[#2D7D46]/10 text-[#2D7D46] inline-flex items-center justify-center"><Stethoscope size={22} /></span>
                <div>
                  <p className="font-display font-bold text-lg text-foreground">Je suis professionnel ou administrateur</p>
                  <p className="text-sm text-muted-foreground">Sage-femme, gynecologue, admin</p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="max-w-md w-full mx-auto lg:mx-0">
            <button type="button" onClick={() => { setMode(null); setError(""); }} className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1" data-testid="login-change-mode">
              <ArrowLeft size={14} /> Changer de profil
            </button>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {mode === "patient" ? "Acces patiente" : "Acces professionnel"}
            </h1>
            <p className="mt-2 text-muted-foreground">Connectez-vous avec votre email et votre mot de passe.</p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email-input"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  placeholder="vous@exemple.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Mot de passe</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password-input"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  placeholder="********"
                />
              </div>
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2" data-testid="login-error">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit-btn"
                className="w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {loading ? "Connexion..." : "Se connecter"}
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Comptes de demonstration</p>
              <div className="flex flex-wrap gap-2">
                {mode === "patient" && (
                  <button type="button" onClick={() => fillDemo("patient")} className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/70 font-medium" data-testid="login-demo-patient">Patiente demo</button>
                )}
                {mode === "pro" && (
                  <>
                    <button type="button" onClick={() => fillDemo("pro")} className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/70 font-medium" data-testid="login-demo-pro">Sage-femme demo</button>
                    <button type="button" onClick={() => fillDemo("admin")} className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/70 font-medium" data-testid="login-demo-admin">Admin demo</button>
                  </>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
