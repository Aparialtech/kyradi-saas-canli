import { useCallback, useMemo } from "react";

import { useLocale } from "../context/LocaleContext";
import { translations, type TranslationKey } from "../i18n/translations";

type TemplateVars = Record<string, string | number>;

export function useTranslation() {
  const { locale } = useLocale();

  const dictionary = useMemo(() => translations[locale] ?? translations["tr-TR"], [locale]);

  const t = useCallback(
    (key: TranslationKey, vars?: TemplateVars) => {
      const fallback = translations["tr-TR"][key] ?? key;
      const template = dictionary[key] ?? fallback;
      if (!vars) {
        return template;
      }
      return template.replace(/\{\{(.*?)\}\}/g, (match: string, variable: string) => {
        const value = vars[variable.trim()];
        return value != null ? String(value) : match;
      });
    },
    [dictionary],
  );

  return { t, locale };
}
