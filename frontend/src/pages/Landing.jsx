import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import {
  Shield,
  HeartHandshake,
  Activity,
  WifiOff,
  MapPin,
  Stethoscope,
  Baby,
  Syringe,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const HERO_IMG =
  "https://images.unsplash.com/photo-1780329936573-546f6350bf0c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwxfHxhZnJpY2FuJTIwbW90aGVyJTIwYmFieSUyMGhhcHB5JTIwaGVhbHRofGVufDB8fHx8MTc4MjA4NzE2NHww&ixlib=rb-4.1.0&q=85";
const MIDWIFE_IMG =
  "https://images.unsplash.com/photo-1643297654416-05795d62e39c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwyfHxhZnJpY2FuJTIwbWlkd2lmZSUyMGRvY3RvciUyMHNtaWxpbmd8ZW58MHx8fHwxNzgyMDg3MTY0fDA&ixlib=rb-4.1.0&q=85";

const stats = [
  { value: "8 CPN", label: "Suivi prénatal complet selon les normes OMS" },
  { value: "6h · 6j · 6s", label: "Trois étapes de suivi postnatal" },
  { value: "100% Tchad", label: "Pensé pour le contexte sub-saharien" },
];

const features = [
  { icon: Stethoscope, title: "Dossier CPN structuré", desc: "Constantes cliniques, bilans biologiques, paquets préventifs et alertes automatiques sur les complications." },
  { icon: Baby, title: "Suivi postnatal", desc: "Évaluations à 6 heures, 6 jours et 6 semaines pour sécuriser le continuum mère-enfant." },
  { icon: Syringe, title: "Carnet vaccinal numérique", desc: "Calendrier vaccinal par pays, traçabilité des lots et rappels intelligents." },
  { icon: MapPin, title: "Zones de responsabilité", desc: "Sectorisation géographique pour orienter les références d'urgence efficacement." },
  { icon: WifiOff, title: "Pensé offline-first*", desc: "Fonctionne sans connexion. Synchronisation automatique dès le retour du réseau." },
  { icon: Activity, title: "Tableau de bord ministère", desc: "Indicateurs WHO en temps réel : couverture CPN, mortalité maternelle, audit MPDSR." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#F7F3EB] text-[#3E2723]">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-[#F7F3EB]/85 backdrop-blur-xl border-b border-[#3E2723]/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm text-[#795C55]">
            <a href="#mission" className="hover:text-[#C85A48] transition-colors">Mission</a>
            <a href="#fonctionnalites" className="hover:text-[#C85A48] transition-colors">Fonctionnalités</a>
            <a href="#contact" className="hover:text-[#C85A48] transition-colors">Contact</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" data-testid="nav-login-btn">
              <Button variant="ghost" className="text-[#3E2723] hover:bg-[#3E2723]/5 rounded-xl">
                Connexion
              </Button>
            </Link>
            <Link to="/register" data-testid="nav-register-btn">
              <Button className="bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl px-5">
                S'inscrire
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-20 lg:pt-20 lg:pb-32 grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F2C94C]/30 border border-[#F2C94C]/40 text-[#795C55] text-xs font-medium uppercase tracking-wider">
              <HeartHandshake size={14} /> Santé maternelle & infantile · Tchad
            </span>
            <h1 className="font-heading mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight">
              Sécuriser le lien
              <br />
              <span className="text-[#C85A48]">mère & enfant.</span>
              <br />
              Partout. Toujours.
            </h1>
            <p className="mt-6 text-lg text-[#795C55] max-w-xl leading-relaxed">
              KHALABA est la plateforme numérique de suivi maternel & infantile en Afrique
              sub-saharienne. Elle relie patientes, soignants et autorités sanitaires
              autour d'un dossier clinique unifié — résilient, traçable, conforme OMS.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/register" data-testid="hero-cta-register">
                <Button size="lg" className="bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl px-7 h-12 text-base">
                  Démarrer maintenant
                  <ArrowRight size={18} />
                </Button>
              </Link>
              <Link to="/login" data-testid="hero-cta-login">
                <Button size="lg" variant="outline" className="border-2 border-[#3E2723]/20 text-[#3E2723] hover:bg-[#3E2723]/5 rounded-xl px-7 h-12 text-base">
                  J'ai déjà un compte
                </Button>
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4">
              {stats.map((s, i) => (
                <div key={i} className="border-l-2 border-[#C85A48] pl-4">
                  <div className="font-heading text-2xl font-semibold text-[#3E2723]">{s.value}</div>
                  <div className="text-xs text-[#795C55] mt-1 leading-snug">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -top-8 -right-8 w-72 h-72 rounded-full bg-[#F2C94C]/30 blur-3xl"></div>
            <div className="absolute -bottom-8 -left-8 w-72 h-72 rounded-full bg-[#C85A48]/20 blur-3xl"></div>
            <div className="relative rounded-3xl overflow-hidden shadow-[0_20px_70px_rgba(62,39,35,0.18)] border border-white">
              <img src={HERO_IMG} alt="Mère et enfant" className="w-full h-[520px] object-cover" />
              <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-md rounded-2xl px-5 py-4 flex items-center gap-4 shadow-lg">
                <div className="w-12 h-12 rounded-full bg-[#C85A48]/15 flex items-center justify-center text-[#C85A48]">
                  <Shield size={22} />
                </div>
                <div>
                  <div className="font-heading font-semibold text-[#3E2723]">Conforme OMS</div>
                  <div className="text-xs text-[#795C55]">Standards internationaux de santé maternelle</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission strip */}
      <section id="mission" className="bg-[#3E2723] text-white py-16">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <span className="text-sm font-medium uppercase tracking-[0.2em] text-[#F2C94C]">Notre mission</span>
          <h2 className="font-heading text-3xl sm:text-4xl mt-4 font-medium leading-tight">
            Mettre fin à l'invisibilité des grossesses non suivies en Afrique sub-saharienne.
          </h2>
          <p className="mt-6 text-[#F7F3EB]/80 text-lg leading-relaxed">
            Au Tchad, chaque grossesse mérite un suivi clinique digne et continu.
            KHALABA remplace les protocoles physiques inefficaces par un lien numérique direct,
            intelligent et résilient — même là où le réseau s'éteint.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="fonctionnalites" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <span className="text-sm font-medium uppercase tracking-[0.18em] text-[#C85A48]">Plateforme</span>
            <h2 className="font-heading text-3xl sm:text-4xl mt-3 font-semibold tracking-tight text-[#3E2723]">
              Une seule application.
              <br />Trois portails connectés.
            </h2>
            <p className="mt-5 text-[#795C55] text-lg">
              Patientes, soignants, administration ministérielle — chacun sa vue, un seul dossier clinique.
            </p>
          </div>

          <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-7 border border-[#3E2723]/5 shadow-[0_4px_20px_rgba(62,39,35,0.04)] hover:shadow-[0_12px_40px_rgba(62,39,35,0.08)] transition-shadow"
                data-testid={`feature-${i}`}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#C85A48]/15 to-[#D99A5A]/20 flex items-center justify-center text-[#C85A48] mb-5">
                  <f.icon size={22} strokeWidth={2} />
                </div>
                <h3 className="font-heading text-xl font-semibold text-[#3E2723]">{f.title}</h3>
                <p className="mt-3 text-[#795C55] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-[#795C55]/70">
            *La version MVP actuelle fonctionne en mode connecté. L'architecture offline-first complète est prévue dans la phase suivante.
          </p>
        </div>
      </section>

      {/* Healthcare worker focus */}
      <section className="py-20 lg:py-24 bg-white border-y border-[#3E2723]/5">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div className="rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(62,39,35,0.12)]">
            <img src={MIDWIFE_IMG} alt="Sage-femme" className="w-full h-[460px] object-cover" />
          </div>
          <div>
            <span className="text-sm font-medium uppercase tracking-[0.18em] text-[#C85A48]">Pour les soignants</span>
            <h2 className="font-heading text-3xl sm:text-4xl mt-3 font-semibold tracking-tight">
              Vos patientes, votre zone, vos outils.
            </h2>
            <p className="mt-5 text-[#795C55] text-lg leading-relaxed">
              Sages-femmes, gynécologues, infirmiers — KHALABA centralise vos consultations dans
              une interface mobile-first, conçue pour le terrain. Plus de cahiers perdus,
              plus de patientes oubliées.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "CPN 1 à 8 selon les recommandations OMS, avec alertes automatiques sur hypertension, anémie, protéinurie.",
                "Suivi postnatal à 6h / 6j / 6s avec détection des signes de danger.",
                "Surveillance épidémiologique MPDSR pour les décès maternels et néonatals.",
                "Carnet vaccinal complet et traçable, du BCG au rappel ROR.",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-[#4A7C59] mt-0.5 shrink-0" />
                  <span className="text-[#3E2723]">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-heading text-3xl sm:text-5xl font-semibold tracking-tight">
            Prêt à transformer le suivi maternel
            <span className="text-[#C85A48]"> dans votre zone ?</span>
          </h2>
          <p className="mt-6 text-[#795C55] text-lg max-w-2xl mx-auto">
            Rejoignez KHALABA et placez chaque maman, chaque bébé, au cœur d'un parcours
            de soins traçable et humain.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <Link to="/register" data-testid="footer-cta-register">
              <Button size="lg" className="bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl px-8 h-12 text-base">
                Créer mon compte
                <ArrowRight size={18} />
              </Button>
            </Link>
            <Link to="/login" data-testid="footer-cta-login">
              <Button size="lg" variant="outline" className="border-2 border-[#3E2723]/20 text-[#3E2723] hover:bg-[#3E2723]/5 rounded-xl px-8 h-12 text-base">
                Se connecter
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#3E2723] text-[#F7F3EB]/80 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <Logo />
          <div className="text-sm">
            © 2026 KHALABA · Santé maternelle & infantile · République du Tchad
          </div>
        </div>
      </footer>
    </div>
  );
}
