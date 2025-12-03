import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

/**
 * Reusable debounced search input component.
 * Uses i18n for placeholder if not provided.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  debounceMs = 300,
  className = "",
}: SearchInputProps) {
  const { t } = useTranslation();
  const [localValue, setLocalValue] = useState(value);

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced onChange
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, debounceMs, onChange, value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChange("");
  }, [onChange]);

  return (
    <div className={`search-input ${className}`} style={{ position: "relative" }}>
      <span
        style={{
          position: "absolute",
          left: "0.75rem",
          top: "50%",
          transform: "translateY(-50%)",
          color: "#94a3b8",
          pointerEvents: "none",
        }}
      >
        🔍
      </span>
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder ?? t("common.search" as any) ?? "Ara..."}
        style={{
          width: "100%",
          paddingLeft: "2.5rem",
          paddingRight: localValue ? "2.5rem" : "0.75rem",
        }}
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          style={{
            position: "absolute",
            right: "0.5rem",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: "0.25rem",
            fontSize: "1rem",
            lineHeight: 1,
          }}
          title={t("common.clear" as any) ?? "Temizle"}
        >
          ✕
        </button>
      )}
    </div>
  );
}

