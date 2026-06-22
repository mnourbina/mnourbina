import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { TRANSLATIONS, RTL_LANGS } from "./translations";

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("khalaba_lang") || "fr");

  useEffect(() => {
    localStorage.setItem("khalaba_lang", lang);
    const isRtl = RTL_LANGS.includes(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [lang]);

  const t = useCallback(
    (key, vars) => {
      const dict = TRANSLATIONS[lang] || TRANSLATIONS.fr;
      let value = dict[key] || TRANSLATIONS.fr[key] || key;
      if (vars) {
        Object.keys(vars).forEach((k) => {
          value = value.replace(`{${k}}`, vars[k]);
        });
      }
      return value;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, isRtl: RTL_LANGS.includes(lang) }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
