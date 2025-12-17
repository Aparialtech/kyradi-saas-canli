import { useCallback, useMemo } from "react";
import { useLocale } from "../context/LocaleContext";
import { translations, type TranslationKey } from "../i18n/translations";

type TemplateVars = Record<string, string | number | undefined>;

export function useTranslation() {
  const { locale } = useLocale();

  const dictionary = useMemo(() => {
    const dict = translations[locale] ?? translations["tr-TR"];
    return dict as Record<TranslationKey, string>;
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey, vars?: TemplateVars) => {
      const fallbackDict = translations["tr-TR"] as Record<TranslationKey, string>;
      const fallback = fallbackDict[key] ?? key;
      const template = dictionary[key] ?? fallback;

      if (!vars) return template;

      return template.replace(/\{\{(.*?)\}\}/g, (_m, variable) => {
        const v = vars[variable.trim()];
        return v !== undefined ? String(v) : "";
      });
    },
    [dictionary]
  );

  return { t, locale };
}
