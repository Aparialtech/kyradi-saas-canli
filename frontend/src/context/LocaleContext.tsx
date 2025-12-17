import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type SupportedLocale = "tr-TR" | "en-US" | "de-DE" | "zh-CN" | "es-ES";

const SUPPORTED_LOCALES: Array<{ code: SupportedLocale; label: string; nativeLabel: string }> = [
  { code: "tr-TR", label: "Türkçe", nativeLabel: "Türkçe" },
  { code: "en-US", label: "English", nativeLabel: "English" },
  { code: "de-DE", label: "Deutsch", nativeLabel: "Deutsch" },
  { code: "zh-CN", label: "中文", nativeLabel: "中文" },
  { code: "es-ES", label: "Español", nativeLabel: "Español" },
];

type LocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (next: SupportedLocale) => void;
  availableLocales: typeof SUPPORTED_LOCALES;
};

const FALLBACK_LOCALE: SupportedLocale = "tr-TR";
const STORAGE_KEY = "kyradi.locale";

const LocaleContext = createContext<LocaleContextValue>({
  locale: FALLBACK_LOCALE,
  setLocale: () => undefined,
  availableLocales: SUPPORTED_LOCALES,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    if (typeof window === "undefined") return FALLBACK_LOCALE;
    const stored = window.localStorage.getItem(STORAGE_KEY) as SupportedLocale | null;
    return stored && SUPPORTED_LOCALES.some((item) => item.code === stored) ? stored : FALLBACK_LOCALE;
  });

  const setLocale = useCallback((next: SupportedLocale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      // Set HTML lang attribute based on locale
      const langMap: Record<SupportedLocale, string> = {
        "tr-TR": "tr",
        "en-US": "en",
        "de-DE": "de",
        "zh-CN": "zh",
        "es-ES": "es",
      };
      document.documentElement.lang = langMap[locale] || "tr";
    }
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      availableLocales: SUPPORTED_LOCALES,
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
