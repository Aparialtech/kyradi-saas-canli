import React, { useState, useRef, useEffect } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { tr } from 'date-fns/locale';
import { format, parse, isValid, startOfDay, setHours, setMinutes } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Calendar, Clock, X, ChevronLeft, ChevronRight } from '../../../lib/lucide';
import styles from './DateField.module.css';

// ============================================================
// TYPES
// ============================================================

export interface DateFieldProps {
  /** Field label */
  label?: string;
  /** Current value as ISO string (YYYY-MM-DD) or Date object */
  value?: string | Date | null;
  /** Called when value changes - returns ISO string (YYYY-MM-DD) or null */
  onChange: (value: string | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Whether field is required */
  required?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Full width */
  fullWidth?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Input name for forms */
  name?: string;
  /** Input id */
  id?: string;
  /** Custom class name */
  className?: string;
}

export interface DateTimeFieldProps extends Omit<DateFieldProps, 'value' | 'onChange'> {
  /** Current value as ISO string or Date object */
  value?: string | Date | null;
  /** Called when value changes - returns ISO datetime string or null */
  onChange: (value: string | null) => void;
  /** Show seconds in time picker */
  showSeconds?: boolean;
  /** Minute step (default: 5) */
  minuteStep?: number;
}

export interface DateRangeFieldProps {
  /** Field label */
  label?: string;
  /** Start date value */
  startValue?: string | Date | null;
  /** End date value */
  endValue?: string | Date | null;
  /** Called when values change */
  onChange: (start: string | null, end: string | null) => void;
  /** Start placeholder */
  startPlaceholder?: string;
  /** End placeholder */
  endPlaceholder?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Whether field is required */
  required?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Full width */
  fullWidth?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom class name */
  className?: string;
}

// ============================================================
// HELPERS
// ============================================================

const TR_DATE_FORMAT = 'dd.MM.yyyy';
const TR_DATETIME_FORMAT = 'dd.MM.yyyy HH:mm';
const ISO_DATE_FORMAT = 'yyyy-MM-dd';
const ISO_DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm";

function parseToDate(value: string | Date | null | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isValid(value) ? value : undefined;
  
  // Try ISO format first
  let date = parse(value, ISO_DATE_FORMAT, new Date());
  if (isValid(date)) return date;
  
  // Try ISO datetime
  date = parse(value.slice(0, 16), ISO_DATETIME_FORMAT, new Date());
  if (isValid(date)) return date;
  
  // Try Turkish format
  date = parse(value, TR_DATE_FORMAT, new Date());
  if (isValid(date)) return date;
  
  // Try native Date parsing
  date = new Date(value);
  if (isValid(date)) return date;
  
  return undefined;
}

function formatToDisplay(date: Date | undefined, includeTime: boolean = false): string {
  if (!date || !isValid(date)) return '';
  return format(date, includeTime ? TR_DATETIME_FORMAT : TR_DATE_FORMAT);
}

function formatToISO(date: Date | undefined, includeTime: boolean = false): string | null {
  if (!date || !isValid(date)) return null;
  if (includeTime) {
    return date.toISOString();
  }
  return format(date, ISO_DATE_FORMAT);
}

// ============================================================
// DATE FIELD (Date only)
// ============================================================

export const DateField = React.forwardRef<HTMLInputElement, DateFieldProps>(
  (
    {
      label,
      value,
      onChange,
      placeholder = 'gg.aa.yyyy',
      error,
      helperText,
      minDate,
      maxDate,
      required = false,
      disabled = false,
      fullWidth = false,
      size = 'md',
      name,
      id,
      className,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync external value to input
    useEffect(() => {
      const date = parseToDate(value);
      setInputValue(formatToDisplay(date));
    }, [value]);

    // Handle outside clicks
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle input change (typing)
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);
      
      // Try to parse typed date
      const parsed = parse(val, TR_DATE_FORMAT, new Date());
      if (isValid(parsed)) {
        onChange(formatToISO(parsed));
      } else if (!val) {
        onChange(null);
      }
    };

    // Handle calendar selection
    const handleDaySelect = (date: Date | undefined) => {
      if (date) {
        setInputValue(formatToDisplay(date));
        onChange(formatToISO(date));
      } else {
        setInputValue('');
        onChange(null);
      }
      setIsOpen(false);
    };

    // Handle clear
    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setInputValue('');
      onChange(null);
    };

    // Handle today
    const handleToday = () => {
      const today = startOfDay(new Date());
      setInputValue(formatToDisplay(today));
      onChange(formatToISO(today));
      setIsOpen(false);
    };

    const selectedDate = parseToDate(value);

    return (
      <div
        ref={containerRef}
        className={clsx(styles.container, { [styles.fullWidth]: fullWidth }, className)}
      >
        {label && (
          <label className={styles.label} htmlFor={id}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}

        <div
          className={clsx(
            styles.inputWrapper,
            styles[`inputWrapper--${size}`],
            {
              [styles['inputWrapper--error']]: !!error,
              [styles['inputWrapper--disabled']]: disabled,
              [styles['inputWrapper--focused']]: isOpen,
            }
          )}
          onClick={() => !disabled && setIsOpen(true)}
        >
          <Calendar className={styles.icon} />
          
          <input
            ref={(node) => {
              inputRef.current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) ref.current = node;
            }}
            type="text"
            className={styles.input}
            value={inputValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            disabled={disabled}
            name={name}
            id={id}
            autoComplete="off"
            onFocus={() => setIsOpen(true)}
          />

          {inputValue && !disabled && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClear}
              tabIndex={-1}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <AnimatePresence>
          {isOpen && !disabled && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className={styles.popover}
            >
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleDaySelect}
                locale={tr}
                weekStartsOn={1}
                disabled={[
                  ...(minDate ? [{ before: minDate }] : []),
                  ...(maxDate ? [{ after: maxDate }] : []),
                ]}
                showOutsideDays
                classNames={{
                  root: styles.calendar,
                  months: styles.months,
                  month: styles.month,
                  caption: styles.caption,
                  caption_label: styles.captionLabel,
                  nav: styles.nav,
                  nav_button: styles.navButton,
                  nav_button_previous: styles.navButtonPrev,
                  nav_button_next: styles.navButtonNext,
                  table: styles.table,
                  head_row: styles.headRow,
                  head_cell: styles.headCell,
                  row: styles.row,
                  cell: styles.cell,
                  day: styles.day,
                  day_selected: styles.daySelected,
                  day_today: styles.dayToday,
                  day_outside: styles.dayOutside,
                  day_disabled: styles.dayDisabled,
                  day_hidden: styles.dayHidden,
                }}
                components={{
                  Chevron: (props) => props.orientation === 'left' 
                    ? <ChevronLeft className="h-4 w-4" /> 
                    : <ChevronRight className="h-4 w-4" />,
                }}
              />
              
              <div className={styles.footer}>
                <button
                  type="button"
                  className={styles.footerButton}
                  onClick={handleToday}
                >
                  Bugün
                </button>
                <button
                  type="button"
                  className={clsx(styles.footerButton, styles.footerButtonOutline)}
                  onClick={handleClear}
                >
                  Temizle
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {(error || helperText) && (
          <motion.p
            className={clsx(styles.helperText, { [styles.errorText]: !!error })}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {error || helperText}
          </motion.p>
        )}
      </div>
    );
  }
);

DateField.displayName = 'DateField';

// ============================================================
// DATE TIME FIELD (Date + Time)
// ============================================================

export const DateTimeField = React.forwardRef<HTMLInputElement, DateTimeFieldProps>(
  (
    {
      label,
      value,
      onChange,
      placeholder = 'gg.aa.yyyy ss:dd',
      error,
      helperText,
      minDate,
      maxDate,
      required = false,
      disabled = false,
      fullWidth = false,
      size = 'md',
      name,
      id,
      className,
      minuteStep = 5,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [selectedTime, setSelectedTime] = useState({ hours: 12, minutes: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync external value to input
    useEffect(() => {
      const date = parseToDate(value);
      if (date) {
        setInputValue(formatToDisplay(date, true));
        setSelectedTime({
          hours: date.getHours(),
          minutes: date.getMinutes(),
        });
      } else {
        setInputValue('');
      }
    }, [value]);

    // Handle outside clicks
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle input change (typing)
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);
      
      const parsed = parse(val, TR_DATETIME_FORMAT, new Date());
      if (isValid(parsed)) {
        onChange(parsed.toISOString());
        setSelectedTime({
          hours: parsed.getHours(),
          minutes: parsed.getMinutes(),
        });
      } else if (!val) {
        onChange(null);
      }
    };

    // Handle calendar selection
    const handleDaySelect = (date: Date | undefined) => {
      if (date) {
        const withTime = setMinutes(setHours(date, selectedTime.hours), selectedTime.minutes);
        setInputValue(formatToDisplay(withTime, true));
        onChange(withTime.toISOString());
      }
    };

    // Handle time change
    const handleTimeChange = (type: 'hours' | 'minutes', value: number) => {
      const newTime = { ...selectedTime, [type]: value };
      setSelectedTime(newTime);

      const currentDate = parseToDate(inputValue) || new Date();
      const withTime = setMinutes(setHours(currentDate, newTime.hours), newTime.minutes);
      setInputValue(formatToDisplay(withTime, true));
      onChange(withTime.toISOString());
    };

    // Handle clear
    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setInputValue('');
      onChange(null);
    };

    // Handle now
    const handleNow = () => {
      const now = new Date();
      setInputValue(formatToDisplay(now, true));
      setSelectedTime({
        hours: now.getHours(),
        minutes: now.getMinutes(),
      });
      onChange(now.toISOString());
      setIsOpen(false);
    };

    const selectedDate = parseToDate(value);

    // Generate time options
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 60 / minuteStep }, (_, i) => i * minuteStep);

    return (
      <div
        ref={containerRef}
        className={clsx(styles.container, { [styles.fullWidth]: fullWidth }, className)}
      >
        {label && (
          <label className={styles.label} htmlFor={id}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}

        <div
          className={clsx(
            styles.inputWrapper,
            styles[`inputWrapper--${size}`],
            {
              [styles['inputWrapper--error']]: !!error,
              [styles['inputWrapper--disabled']]: disabled,
              [styles['inputWrapper--focused']]: isOpen,
            }
          )}
          onClick={() => !disabled && setIsOpen(true)}
        >
          <Calendar className={styles.icon} />
          
          <input
            ref={(node) => {
              inputRef.current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) ref.current = node;
            }}
            type="text"
            className={styles.input}
            value={inputValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            disabled={disabled}
            name={name}
            id={id}
            autoComplete="off"
            onFocus={() => setIsOpen(true)}
          />

          {inputValue && !disabled && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClear}
              tabIndex={-1}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <AnimatePresence>
          {isOpen && !disabled && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className={clsx(styles.popover, styles.popoverWide)}
            >
              <div className={styles.datetimeGrid}>
                <div className={styles.calendarSection}>
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDaySelect}
                    locale={tr}
                    weekStartsOn={1}
                    disabled={[
                      ...(minDate ? [{ before: minDate }] : []),
                      ...(maxDate ? [{ after: maxDate }] : []),
                    ]}
                    showOutsideDays
                    classNames={{
                      root: styles.calendar,
                      months: styles.months,
                      month: styles.month,
                      caption: styles.caption,
                      caption_label: styles.captionLabel,
                      nav: styles.nav,
                      nav_button: styles.navButton,
                      nav_button_previous: styles.navButtonPrev,
                      nav_button_next: styles.navButtonNext,
                      table: styles.table,
                      head_row: styles.headRow,
                      head_cell: styles.headCell,
                      row: styles.row,
                      cell: styles.cell,
                      day: styles.day,
                      day_selected: styles.daySelected,
                      day_today: styles.dayToday,
                      day_outside: styles.dayOutside,
                      day_disabled: styles.dayDisabled,
                      day_hidden: styles.dayHidden,
                    }}
                    components={{
                      Chevron: (props) => props.orientation === 'left' 
                        ? <ChevronLeft className="h-4 w-4" /> 
                        : <ChevronRight className="h-4 w-4" />,
                    }}
                  />
                </div>

                <div className={styles.timeSection}>
                  <div className={styles.timeHeader}>
                    <Clock className="h-4 w-4" />
                    <span>Saat Seçin</span>
                  </div>
                  
                  <div className={styles.timeSelectors}>
                    <div className={styles.timeColumn}>
                      <span className={styles.timeColumnLabel}>Saat</span>
                      <div className={styles.timeScroller}>
                        {hours.map((h) => (
                          <button
                            key={h}
                            type="button"
                            className={clsx(styles.timeOption, {
                              [styles.timeOptionSelected]: h === selectedTime.hours,
                            })}
                            onClick={() => handleTimeChange('hours', h)}
                          >
                            {h.toString().padStart(2, '0')}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className={styles.timeSeparator}>:</div>
                    
                    <div className={styles.timeColumn}>
                      <span className={styles.timeColumnLabel}>Dakika</span>
                      <div className={styles.timeScroller}>
                        {minutes.map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={clsx(styles.timeOption, {
                              [styles.timeOptionSelected]: m === selectedTime.minutes,
                            })}
                            onClick={() => handleTimeChange('minutes', m)}
                          >
                            {m.toString().padStart(2, '0')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={styles.footer}>
                <button
                  type="button"
                  className={styles.footerButton}
                  onClick={handleNow}
                >
                  Şimdi
                </button>
                <button
                  type="button"
                  className={clsx(styles.footerButton, styles.footerButtonOutline)}
                  onClick={handleClear}
                >
                  Temizle
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {(error || helperText) && (
          <motion.p
            className={clsx(styles.helperText, { [styles.errorText]: !!error })}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {error || helperText}
          </motion.p>
        )}
      </div>
    );
  }
);

DateTimeField.displayName = 'DateTimeField';

// ============================================================
// DATE RANGE FIELD
// ============================================================

export const DateRangeField: React.FC<DateRangeFieldProps> = ({
  label,
  startValue,
  endValue,
  onChange,
  startPlaceholder = 'Başlangıç',
  endPlaceholder = 'Bitiş',
  error,
  helperText,
  minDate,
  maxDate,
  required = false,
  disabled = false,
  fullWidth = false,
  size = 'md',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDate = parseToDate(startValue);
  const endDate = parseToDate(endValue);

  const range: DateRange | undefined =
    startDate || endDate ? { from: startDate, to: endDate } : undefined;

  // Handle outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle range selection
  const handleRangeSelect = (range: DateRange | undefined) => {
    const start = range?.from ? formatToISO(range.from) : null;
    const end = range?.to ? formatToISO(range.to) : null;
    onChange(start, end);
  };

  // Handle clear
  const handleClear = () => {
    onChange(null, null);
  };

  // Quick presets
  const handlePreset = (preset: 'today' | 'week' | 'month' | 'year') => {
    const now = new Date();
    let start = new Date();
    
    switch (preset) {
      case 'today':
        onChange(formatToISO(startOfDay(now)), formatToISO(startOfDay(now)));
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
        onChange(formatToISO(startOfDay(start)), formatToISO(startOfDay(now)));
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        onChange(formatToISO(startOfDay(start)), formatToISO(startOfDay(now)));
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        onChange(formatToISO(startOfDay(start)), formatToISO(startOfDay(now)));
        break;
    }
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={clsx(styles.container, { [styles.fullWidth]: fullWidth }, className)}
    >
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}

      <div
        className={clsx(
          styles.rangeInputWrapper,
          styles[`inputWrapper--${size}`],
          {
            [styles['inputWrapper--error']]: !!error,
            [styles['inputWrapper--disabled']]: disabled,
            [styles['inputWrapper--focused']]: isOpen,
          }
        )}
        onClick={() => !disabled && setIsOpen(true)}
      >
        <Calendar className={styles.icon} />
        
        <div className={styles.rangeDisplay}>
          <span className={clsx(styles.rangeValue, { [styles.rangePlaceholder]: !startDate })}>
            {startDate ? formatToDisplay(startDate) : startPlaceholder}
          </span>
          <span className={styles.rangeSeparator}>→</span>
          <span className={clsx(styles.rangeValue, { [styles.rangePlaceholder]: !endDate })}>
            {endDate ? formatToDisplay(endDate) : endPlaceholder}
          </span>
        </div>

        {(startDate || endDate) && !disabled && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            tabIndex={-1}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={clsx(styles.popover, styles.popoverRange)}
          >
            <div className={styles.presets}>
              <button type="button" onClick={() => handlePreset('today')}>Bugün</button>
              <button type="button" onClick={() => handlePreset('week')}>Son 7 Gün</button>
              <button type="button" onClick={() => handlePreset('month')}>Son 30 Gün</button>
              <button type="button" onClick={() => handlePreset('year')}>Son 1 Yıl</button>
            </div>

            <DayPicker
              mode="range"
              selected={range}
              onSelect={handleRangeSelect}
              locale={tr}
              weekStartsOn={1}
              numberOfMonths={2}
              disabled={[
                ...(minDate ? [{ before: minDate }] : []),
                ...(maxDate ? [{ after: maxDate }] : []),
              ]}
              showOutsideDays
              classNames={{
                root: styles.calendar,
                months: styles.monthsRange,
                month: styles.month,
                caption: styles.caption,
                caption_label: styles.captionLabel,
                nav: styles.nav,
                nav_button: styles.navButton,
                nav_button_previous: styles.navButtonPrev,
                nav_button_next: styles.navButtonNext,
                table: styles.table,
                head_row: styles.headRow,
                head_cell: styles.headCell,
                row: styles.row,
                cell: styles.cell,
                day: styles.day,
                day_selected: styles.daySelected,
                day_today: styles.dayToday,
                day_outside: styles.dayOutside,
                day_disabled: styles.dayDisabled,
                day_hidden: styles.dayHidden,
                day_range_start: styles.dayRangeStart,
                day_range_end: styles.dayRangeEnd,
                day_range_middle: styles.dayRangeMiddle,
              }}
              components={{
                Chevron: (props) => props.orientation === 'left' 
                  ? <ChevronLeft className="h-4 w-4" /> 
                  : <ChevronRight className="h-4 w-4" />,
              }}
            />
            
            <div className={styles.footer}>
              <button
                type="button"
                className={clsx(styles.footerButton, styles.footerButtonOutline)}
                onClick={handleClear}
              >
                Temizle
              </button>
              <button
                type="button"
                className={styles.footerButton}
                onClick={() => setIsOpen(false)}
              >
                Uygula
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {(error || helperText) && (
        <motion.p
          className={clsx(styles.helperText, { [styles.errorText]: !!error })}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {error || helperText}
        </motion.p>
      )}
    </div>
  );
};

// ============================================================
// SIMPLE TIME FIELD (for working hours)
// ============================================================

export interface TimeFieldProps {
  label?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  name?: string;
  id?: string;
}

export const TimeField = React.forwardRef<HTMLInputElement, TimeFieldProps>(
  (
    {
      label,
      value = '',
      onChange,
      placeholder = 'HH:mm',
      error,
      required = false,
      disabled = false,
      size = 'md',
      className,
      name,
      id,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const [hours, minutes] = (value || '00:00').split(':').map(Number);

    // Handle outside clicks
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleTimeChange = (type: 'hours' | 'minutes', val: number) => {
      const newHours = type === 'hours' ? val : hours;
      const newMinutes = type === 'minutes' ? val : minutes;
      onChange(`${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`);
    };

    const hourOptions = Array.from({ length: 24 }, (_, i) => i);
    const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

    return (
      <div
        ref={containerRef}
        className={clsx(styles.container, className)}
      >
        {label && (
          <label className={styles.label} htmlFor={id}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}

        <div
          className={clsx(
            styles.inputWrapper,
            styles[`inputWrapper--${size}`],
            {
              [styles['inputWrapper--error']]: !!error,
              [styles['inputWrapper--disabled']]: disabled,
              [styles['inputWrapper--focused']]: isOpen,
            }
          )}
          onClick={() => !disabled && setIsOpen(true)}
        >
          <Clock className={styles.icon} />
          
          <input
            ref={ref}
            type="text"
            className={styles.input}
            value={value || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d{0,2}:\d{0,2}$/.test(val) || /^\d{0,2}$/.test(val)) {
                onChange(val);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            name={name}
            id={id}
            autoComplete="off"
            onFocus={() => setIsOpen(true)}
          />
        </div>

        <AnimatePresence>
          {isOpen && !disabled && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className={clsx(styles.popover, styles.popoverTime)}
            >
              <div className={styles.timeSelectors}>
                <div className={styles.timeColumn}>
                  <span className={styles.timeColumnLabel}>Saat</span>
                  <div className={styles.timeScroller}>
                    {hourOptions.map((h) => (
                      <button
                        key={h}
                        type="button"
                        className={clsx(styles.timeOption, {
                          [styles.timeOptionSelected]: h === hours,
                        })}
                        onClick={() => handleTimeChange('hours', h)}
                      >
                        {h.toString().padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className={styles.timeSeparator}>:</div>
                
                <div className={styles.timeColumn}>
                  <span className={styles.timeColumnLabel}>Dakika</span>
                  <div className={styles.timeScroller}>
                    {minuteOptions.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={clsx(styles.timeOption, {
                          [styles.timeOptionSelected]: m === minutes,
                        })}
                        onClick={() => handleTimeChange('minutes', m)}
                      >
                        {m.toString().padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className={styles.footer}>
                <button
                  type="button"
                  className={styles.footerButton}
                  onClick={() => setIsOpen(false)}
                >
                  Tamam
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.p
            className={clsx(styles.helperText, styles.errorText)}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {error}
          </motion.p>
        )}
      </div>
    );
  }
);

TimeField.displayName = 'TimeField';

