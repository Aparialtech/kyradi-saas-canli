import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Clock, TrendingUp, Filter } from "../../lib/lucide";
import { useTranslation } from "../../hooks/useTranslation";

interface FilterChip {
  id: string;
  label: string;
  value: string;
  color?: string;
}

interface AdvancedSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  // New features
  showRecentSearches?: boolean;
  recentSearches?: string[];
  onRecentSearchSelect?: (search: string) => void;
  onClearRecentSearches?: () => void;
  maxRecentSearches?: number;
  // Filter chips
  filterChips?: FilterChip[];
  onRemoveFilter?: (filterId: string) => void;
  onClearAllFilters?: () => void;
  // Suggestions
  suggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
  // Highlight
  highlightText?: string;
}

// Hook for managing recent searches in localStorage
export function useRecentSearches(key: string, max: number = 5) {
  const [searches, setSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`recent_searches_${key}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addSearch = useCallback((search: string) => {
    if (!search.trim()) return;
    setSearches(prev => {
      const filtered = prev.filter(s => s !== search);
      const updated = [search, ...filtered].slice(0, max);
      localStorage.setItem(`recent_searches_${key}`, JSON.stringify(updated));
      return updated;
    });
  }, [key, max]);

  const clearSearches = useCallback(() => {
    setSearches([]);
    localStorage.removeItem(`recent_searches_${key}`);
  }, [key]);

  return { searches, addSearch, clearSearches };
}

// Text highlighter utility
export function highlightText(text: string, highlight: string): React.ReactNode {
  if (!highlight.trim()) return text;
  
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark 
        key={index} 
        style={{ 
          backgroundColor: 'var(--warning-100)', 
          color: 'var(--warning-700)',
          padding: '0 2px',
          borderRadius: '2px',
        }}
      >
        {part}
      </mark>
    ) : part
  );
}

export function AdvancedSearch({
  value,
  onChange,
  placeholder,
  debounceMs = 300,
  className = "",
  showRecentSearches = true,
  recentSearches = [],
  onRecentSearchSelect,
  onClearRecentSearches,
  maxRecentSearches = 5,
  filterChips = [],
  onRemoveFilter,
  onClearAllFilters,
  suggestions = [],
  onSuggestionSelect,
}: AdvancedSearchProps) {
  const { t } = useTranslation();
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value
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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    setShowDropdown(true);
  }, []);

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  const handleRecentSelect = useCallback((search: string) => {
    setLocalValue(search);
    onChange(search);
    onRecentSearchSelect?.(search);
    setShowDropdown(false);
  }, [onChange, onRecentSearchSelect]);

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setLocalValue(suggestion);
    onChange(suggestion);
    onSuggestionSelect?.(suggestion);
    setShowDropdown(false);
  }, [onChange, onSuggestionSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  }, []);

  const hasDropdownContent = (showRecentSearches && recentSearches.length > 0) || suggestions.length > 0;

  return (
    <div ref={containerRef} className={`advanced-search ${className}`} style={{ position: "relative" }}>
      {/* Filter Chips */}
      {filterChips.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-2)',
        }}>
          {filterChips.map(chip => (
            <motion.span
              key={chip.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: '4px 8px',
                backgroundColor: chip.color || 'var(--primary-100)',
                color: 'var(--primary-700)',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 500,
              }}
            >
              <Filter className="h-3 w-3" />
              <span>{chip.label}: {chip.value}</span>
              {onRemoveFilter && (
                <button
                  type="button"
                  onClick={() => onRemoveFilter(chip.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginLeft: '4px',
                    color: 'inherit',
                    opacity: 0.7,
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </motion.span>
          ))}
          {filterChips.length > 1 && onClearAllFilters && (
            <button
              type="button"
              onClick={onClearAllFilters}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: 'var(--danger-500)',
                textDecoration: 'underline',
              }}
            >
              Tümünü Temizle
            </button>
          )}
        </div>
      )}

      {/* Search Input */}
      <div style={{ position: "relative" }}>
        <Search
          className="h-4 w-4"
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: isFocused ? 'var(--primary)' : '#94a3b8',
            transition: 'color 0.2s ease',
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleChange}
          onFocus={() => { setIsFocused(true); setShowDropdown(true); }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t("common.search") ?? "Ara..."}
          style={{
            width: "100%",
            padding: "10px 40px 10px 40px",
            border: `2px solid ${isFocused ? 'var(--primary)' : 'var(--border-primary)'}`,
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.9rem',
            outline: 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            boxShadow: isFocused ? '0 0 0 3px var(--primary-100)' : 'none',
          }}
        />
        {localValue && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "var(--bg-tertiary)",
              border: "none",
              borderRadius: "var(--radius-full)",
              width: "20px",
              height: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
            }}
            title="Temizle"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && hasDropdownContent && !localValue && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 50,
              maxHeight: '300px',
              overflow: 'auto',
            }}
          >
            {/* Recent Searches */}
            {showRecentSearches && recentSearches.length > 0 && (
              <div style={{ padding: 'var(--space-2)' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 8px',
                  color: 'var(--text-tertiary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock className="h-3 w-3" />
                    Son Aramalar
                  </span>
                  {onClearRecentSearches && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onClearRecentSearches(); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)',
                        fontSize: '0.7rem',
                      }}
                    >
                      Temizle
                    </button>
                  )}
                </div>
                {recentSearches.slice(0, maxRecentSearches).map((search, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleRecentSelect(search)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.875rem',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Clock className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                    {search}
                  </button>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div style={{ padding: 'var(--space-2)', borderTop: recentSearches.length > 0 ? '1px solid var(--border-primary)' : 'none' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  color: 'var(--text-tertiary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}>
                  <TrendingUp className="h-3 w-3" />
                  Öneriler
                </div>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionSelect(suggestion)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.875rem',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Search className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AdvancedSearch;
