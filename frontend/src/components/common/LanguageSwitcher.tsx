import { useEffect, useRef, useState } from "react";
import { useLocale, type SupportedLocale } from "../../context/LocaleContext";
import { useTranslation } from "../../hooks/useTranslation";
import { Globe } from "../../lib/lucide";

export function LanguageSwitcher() {
  const { locale, setLocale, availableLocales } = useLocale();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLocale = availableLocales.find((item) => item.code === locale);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleSelect = (newLocale: SupportedLocale) => {
    setLocale(newLocale);
    setIsOpen(false);
  };

  return (
    <div className="language-switcher" ref={dropdownRef}>
      <button
        type="button"
        className="language-switcher__button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t("common.language")}
        aria-expanded={isOpen}
      >
        <span className="language-switcher__icon" aria-hidden="true">
          <Globe width={16} height={16} />
        </span>
        <span className="language-switcher__current">
          {currentLocale?.nativeLabel || currentLocale?.label || locale}
        </span>
        <span className={`language-switcher__arrow ${isOpen ? "is-open" : ""}`}>▼</span>
      </button>

      {isOpen && (
        <div className="language-switcher__dropdown">
          {availableLocales.map((item) => (
            <button
              key={item.code}
              type="button"
              className={`language-switcher__option ${item.code === locale ? "is-active" : ""}`}
              onClick={() => handleSelect(item.code)}
            >
              <span className="language-switcher__option-flag" aria-hidden="true">
                <Globe width={14} height={14} />
              </span>
              <span className="language-switcher__option-label">{item.nativeLabel || item.label}</span>
              {item.code === locale && (
                <span className="language-switcher__option-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
