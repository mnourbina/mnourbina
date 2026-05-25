import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import {
  ArrowRight, HeartPulse, Stethoscope, ShieldCheck, Sprout,
  BarChart3, Syringe, WifiOff, MapPin, PhoneCall, AlertOctagon
} from "lucide-react";

const fieldImg = "https://images.pexels.com/photos/30688589/pexels-photo-30688589.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <Link
            to="/login"
            data-testid="landing-login-link"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            Se connecter <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary mb-5" data-testid="landing-overline">
              Plateforme souveraine de sante maternelle et infantile · Tchad
            </span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] text-balance text-foreground">
              Briser les courbes de mortalite, <span className="text-primary">au dernier kilometre.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              Suivi prenatal complet (8 CPN OMS), postnatal en 3 etapes (6h, 6j, 6s), carnet vaccinal jumele mere-enfant, audit des deces (MPDSR), zones de responsabilite cloisonnees.
              Une seule plateforme — pensee par un ancien Medecin Chef de District — pour les sages-femmes, les gynecologues, l'administration sanitaire et les patientes.
            </p>

            {/* 4 mots-cles brand */}
            <ul className="mt-7 flex flex-wrap gap-2" data-testid="landing-keywords">
              {[
                { label: "Offline-First", tone: "primary" },
                { label: "Suivi CPN OMS", tone: "primary" },
                { label: "Vaccins & DHIS2", tone: "primary" },
                { label: "Alertes Vitales", tone: "gold" },
              ].map((k) => (
                <li
                  key={k.label}
                  className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${k.tone === "gold" ? "bg-[#FFB300]/15 text-[#7a5400] border border-[#FFB300]/40" : "bg-primary/10 text-primary border border-primary/20"}`}
                >
                  {k.label}
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link to="/login" data-testid="landing-cta-primary" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
                Acceder a mon portail <ArrowRight size={18} />
              </Link>
              <a href="#piliers" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border bg-white text-foreground font-semibold hover:bg-muted transition-colors" data-testid="landing-cta-secondary">
                Decouvrir nos piliers
              </a>
            </div>

            <dl className="mt-10 grid grid-cols-3 gap-4 max-w-xl">
              {[
                { v: "8", l: "Contacts CPN OMS" },
                { v: "19", l: "Indicateurs cles" },
                { v: "3", l: "Portails dedies" },
              ].map((s) => (
                <div key={s.l} className="border-l-2 border-primary pl-4">
                  <dt className="font-display text-3xl font-bold text-foreground">{s.v}</dt>
                  <dd className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{s.l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:col-span-5">
            <div className="relative">
              {/* Official Khalaba artwork - mother + baby + golden heart */}
              <div className="aspect-[4/5] rounded-3xl bg-gradient-to-br from-[#F9F5F0] via-[#FDF6EB] to-[#F2E9DB] border border-border shadow-xl flex items-center justify-center p-8" data-testid="landing-brand-art">
                <img src="/khalaba-logo.png" alt="Khalaba — mere et enfant" className="max-w-full max-h-full object-contain" />
              </div>
              <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl shadow-lg p-4 border border-border max-w-[260px]" data-testid="landing-stat-card">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#FFB300] mb-1"><Sprout size={14} className="text-[#2D7D46]" /> Donnees souveraines</div>
                <p className="text-sm text-foreground leading-snug">Heberge sur infrastructure controlee, chiffree au repos. Cloisonnement par zone de responsabilite.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The stark reality */}
      <section className="bg-foreground text-background py-16">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gold mb-3">Le constat du terrain</p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold leading-tight">Au Tchad, donner la vie demeure l'un des parcours les plus risques au monde.</h2>
              <p className="mt-5 text-background/80 leading-relaxed">
                Lorsque les femmes manquent un rendez-vous, elles deviennent des "perdues de vue". La seule reponse classique : envoyer des agents communautaires faire des recherches physiques de village en village. Demotivation, perte de temps, gouffre financier. Les complications ne sont pas anticipees.
              </p>
              <p className="mt-4 text-background/80 leading-relaxed font-medium">
                Khalaba remplace cette logistique epuisante par un lien mobile direct, intelligent, et une tracabilite clinique absolue — avec ou sans connexion.
              </p>
            </div>
            <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4" data-testid="landing-tchad-stats">
              <StatBlock value="748 – 856" unit="pour 100 000 naissances" label="Mortalite maternelle au Tchad" tone="gold" />
              <StatBlock value="119 – 139" unit="pour 1 000 naissances" label="Mortalite des moins de 5 ans" tone="primary" />
              <StatBlock value="31 – 39" unit="pour 1 000 naissances" label="Mortalite neonatale" tone="primary" />
              <StatBlock value="0" unit="connexion requise" label="Notre architecture Offline-First" tone="gold" icon={WifiOff} />
            </div>
          </div>
        </div>
      </section>

      {/* 3 portails */}
      <section id="piliers" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-16">
        <div className="max-w-3xl mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Trois portails, une plateforme</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">Concu pour chaque acteur du parcours de soins</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: HeartPulse, color: "bg-primary/10 text-primary", title: "Portail Patiente", desc: "Acces simple : prochain rendez-vous, calendrier vaccinal de la maman et du bebe, signes de danger, rappels. Pense pour un usage quotidien sur mobile.", testid: "portal-card-patient" },
            { icon: Stethoscope, color: "bg-[#3E2720]/10 text-foreground", title: "Portail Professionnel", desc: "Recherche cloisonnee par zone, saisie CPN en 7 sections, alertes automatiques (HTA, perte de poids, terme depasse), canal direct vers la patiente.", testid: "portal-card-pro" },
            { icon: BarChart3, color: "bg-gold text-foreground", title: "Portail Administration", desc: "19 indicateurs OMS, couvertures vaccinales, audit des deces (MPDSR), exports CSV exploitables, gestion des zones et structures sanitaires.", testid: "portal-card-admin" },
          ].map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="bg-white border border-border rounded-2xl p-6 hover:border-primary/40 hover:shadow-md transition-all" data-testid={p.testid}>
                <span className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${p.color} mb-4`}><Icon size={22} /></span>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3 piliers strategiques */}
      <section className="bg-secondary/30 border-y border-border">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-16">
          <div className="max-w-3xl mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Nos piliers strategiques</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">Une proposition de valeur ancree dans la realite du terrain</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <PillarCard icon={PhoneCall} title="Canal direct sage-femme / patiente" desc="La sage-femme appelle ou envoie un message la veille du rendez-vous. La patiente peut decaler son RDV en un geste. Fin des recherches village par village." />
            <PillarCard icon={MapPin} title="Zone de responsabilite" desc="Chaque sage-femme ne voit que les patientes de sa zone administrative. En cas d'urgence, le systeme filtre les gynecologues referents de la meme zone." />
            <PillarCard icon={WifiOff} title="Resilience offline-first" desc="Consultations enregistrees en zone blanche complete. Chiffrement local, synchronisation automatique des qu'un signal apparait." />
          </div>
        </div>
      </section>

      {/* Why khalaba grid */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 py-16 grid lg:grid-cols-2 gap-12 items-center">
        <img src={fieldImg} alt="Professionnel de sante sur le terrain" className="w-full aspect-[5/4] object-cover rounded-2xl shadow-lg" />
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Tracabilite clinique exhaustive</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-6">L'integralite du standard OMS, numerise.</h2>
          <ul className="space-y-5">
            {[
              { icon: Syringe, t: "Carnet vaccinal jumele mere & enfant", d: "VAT, BCG, Pentavalent, PCV, Rota, RR, fievre jaune. Calendrier configurable par pays, alertes pour les retards." },
              { icon: HeartPulse, t: "CPN 1-8 + Postnatal 6h / 6j / 6s", d: "Le Trio Essentiel biologique (Hb, proteinurie, serologies). Paquet preventif (fer/folate, deparasitage, TPIp, VAT). Alerte instantanee TA > 140/90." },
              { icon: AlertOctagon, t: "MPDSR — Audit des deces", d: "Surveillance epidemiologique : tout deces maternel ou neonatal declenche un rapport obligatoire, audit comite, recommandations consignees." },
              { icon: ShieldCheck, t: "Donnees souveraines, exports DHIS2", d: "Heberge sur infrastructure controlee, exports CSV par l'administration, conforme aux exigences MSPP et OMS." },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.t} className="flex gap-4">
                  <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center"><Icon size={20} /></span>
                  <div>
                    <p className="font-display font-semibold text-foreground">{f.t}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{f.d}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground max-w-3xl mx-auto text-balance">
          Construit avec et pour les soignants d'Afrique subsaharienne.
        </h2>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
          Rejoignez la communaute Khalaba. Acces sur invitation pour le MVP.
        </p>
        <Link to="/login" data-testid="landing-bottom-cta" className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
          Se connecter <ArrowRight size={18} />
        </Link>
      </section>

      <footer className="border-t border-border bg-background py-8 text-center text-xs text-muted-foreground">
        Khalaba · Sante materno-infantile · Tchad · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function StatBlock({ value, unit, label, tone = "primary", icon: Icon }) {
  const toneClass = tone === "gold" ? "border-gold text-gold" : "border-primary/50 text-background";
  return (
    <div className={`p-5 border-l-4 ${toneClass.includes("gold") ? "border-l-gold" : "border-l-primary"} bg-background/5 rounded-r-lg`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-display text-4xl font-bold text-background">{value}</p>
        {Icon && <Icon className="text-gold" size={24} />}
      </div>
      <p className="text-xs uppercase tracking-wider text-background/60 mb-1">{unit}</p>
      <p className="text-sm text-background/90 font-medium leading-snug">{label}</p>
    </div>
  );
}

function PillarCard({ icon: Icon, title, desc }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-6">
      <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary mb-4"><Icon size={20} /></span>
      <h3 className="font-display text-lg font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
