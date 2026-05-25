import React from "react";
import { useLanguage } from "@/lib/language";
import { Languages } from "lucide-react";

export default function LangToggle() {
  const { lang, setLang } = useLanguage();
  const next = lang === "fr" ? "ar" : "fr";
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      data-testid="lang-toggle"
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      title={lang === "fr" ? "العربية" : "Français"}
    >
      <Languages size={14} />
      <span>{lang === "fr" ? "AR" : "FR"}</span>
    </button>
  );
}
