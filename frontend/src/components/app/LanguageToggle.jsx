import React from "react";
import { useI18n } from "@/i18n/I18nContext";
import { LANGUAGES } from "@/i18n/translations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";

export default function LanguageToggle({ variant = "default" }) {
  const { lang, setLang } = useI18n();
  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="lang-toggle"
          className={`inline-flex items-center gap-2 px-3 h-10 rounded-xl border transition ${
            variant === "ghost"
              ? "border-white/20 text-white hover:bg-white/10"
              : "border-[#3E2723]/15 bg-white text-[#3E2723] hover:bg-[#F7F3EB]"
          }`}
        >
          <Globe size={16} />
          <span className="text-sm font-medium">{current.flag} {current.code.toUpperCase()}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white border border-[#3E2723]/10 rounded-xl">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            data-testid={`lang-${l.code}`}
            onClick={() => setLang(l.code)}
            className={`gap-2 cursor-pointer ${lang === l.code ? "bg-[#C85A48]/10 text-[#C85A48]" : ""}`}
          >
            <span>{l.flag}</span>
            <span>{l.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
