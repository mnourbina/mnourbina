import { create } from "zustand";

const STORAGE_KEY = "khalaba_lang";

const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

/**
 * Language store. fr (default) | ar (RTL).
 * For the MVP we only switch direction + a few key labels; full i18n is V2.
 */
export const useLanguage = create((set) => ({
  lang: stored === "ar" ? "ar" : "fr",
  setLang: (lang) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.setAttribute("lang", lang);
      document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    }
    set({ lang });
  },
}));

/** Apply current direction to <html> at app start */
export function applyLanguageOnBoot() {
  if (typeof window === "undefined") return;
  const lang = useLanguage.getState().lang;
  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
}
