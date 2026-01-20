import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie'];
const MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

export function DatePicker({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  required,
  error,
  disabled
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      return new Date(value);
    }
    return new Date();
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get position directly when rendering
  const getPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      return {
        top: rect.bottom + 8,
        left: rect.left
      };
    }
    return { top: 0, left: 0 };
  };

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on scroll
  useEffect(() => {
    if (!isOpen) return;
    
    const handleScroll = () => {
      setIsOpen(false);
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  // Parse date strings (using local timezone)
  const selectedDate = value ? new Date(value + 'T00:00:00') : null;
  const minDateObj = minDate ? new Date(minDate + 'T00:00:00') : null;
  const maxDateObj = maxDate ? new Date(maxDate + 'T00:00:00') : null;

  // Get days in month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Get first day of month (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Convert to Monday-first
  };

  // Navigate months
  const goToPreviousMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const goToNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  // Check if date is disabled
  const isDateDisabled = (date: Date) => {
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (minDateObj) {
      const minOnly = new Date(minDateObj.getFullYear(), minDateObj.getMonth(), minDateObj.getDate());
      if (dateOnly < minOnly) return true;
    }
    if (maxDateObj) {
      const maxOnly = new Date(maxDateObj.getFullYear(), maxDateObj.getMonth(), maxDateObj.getDate());
      if (dateOnly > maxOnly) return true;
    }
    return false;
  };

  // Check if date is selected
  const isDateSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Handle date selection
  const handleDateSelect = (day: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (!isDateDisabled(newDate)) {
      // Format as local date YYYY-MM-DD (avoid UTC conversion)
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const dayStr = String(newDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${dayStr}`;
      onChange(formattedDate);
      setIsOpen(false);
    }
  };

  // Format display value
  const formatDisplayValue = (dateStr: string) => {
    if (!dateStr) return '';
    // Parse as local date to avoid UTC shift
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Toggle open
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  // Generate calendar days
  const renderCalendarDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const daysInPrevMonth = getDaysInMonth(year, month - 1);

    const days: React.ReactNode[] = [];

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      days.push(
        <div
          key={`prev-${day}`}
          className="w-9 h-9 text-sm text-text-muted/30 flex items-center justify-center"
        >
          {day}
        </div>
      );
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isDisabled = isDateDisabled(date);
      const selected = isDateSelected(date);
      const today = isToday(date);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      days.push(
        <button
          key={day}
          type="button"
          onClick={(e) => handleDateSelect(day, e)}
          disabled={isDisabled}
          className={cn(
            'w-9 h-9 text-sm rounded-lg transition-all duration-200 font-medium',
            isDisabled && 'text-text-muted/30 cursor-not-allowed',
            !isDisabled && !selected && 'hover:bg-gold/20 hover:text-gold cursor-pointer',
            !isDisabled && !selected && today && 'ring-2 ring-gold/50 text-gold',
            !isDisabled && !selected && isWeekend && !today && 'text-gold/70',
            !isDisabled && !selected && !isWeekend && !today && 'text-text-primary',
            selected && 'bg-gold text-bg-primary font-bold'
          )}
        >
          {day}
        </button>
      );
    }

    // Next month days to fill the grid
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const remainingCells = totalCells - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      days.push(
        <div
          key={`next-${day}`}
          className="w-9 h-9 text-sm text-text-muted/30 flex items-center justify-center"
        >
          {day}
        </div>
      );
    }

    return days;
  };

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Input button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          'w-full px-4 py-3 rounded-xl border text-left flex items-center gap-3 transition-all duration-200',
          'bg-bg-card border-border focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-red-500 focus:ring-red-500/50',
          !disabled && 'hover:border-gold/50 cursor-pointer'
        )}
      >
        <Calendar className="w-5 h-5 text-gold flex-shrink-0" />
        <span className={cn(
          'flex-1',
          value ? 'text-text-primary' : 'text-text-muted'
        )}>
          {value ? formatDisplayValue(value) : 'Wybierz datę'}
        </span>
      </button>

      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}

      {/* Calendar dropdown - Portal */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed p-4 rounded-2xl bg-[#1a1a1a] border border-[#333] shadow-2xl"
          style={{ 
            top: getPosition().top,
            left: getPosition().left,
            minWidth: '300px',
            zIndex: 99999
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="p-2 rounded-lg hover:bg-[#d4a853]/20 text-gray-400 hover:text-[#d4a853] transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <h4 className="text-lg font-semibold text-white">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </h4>
            
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-2 rounded-lg hover:bg-[#d4a853]/20 text-gray-400 hover:text-[#d4a853] transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map((day, index) => (
              <div
                key={day}
                className={cn(
                  'w-9 h-8 flex items-center justify-center text-xs font-medium',
                  index >= 5 ? 'text-[#d4a853]/70' : 'text-gray-500'
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {renderCalendarDays()}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#333]">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="text-sm text-gray-500 hover:text-white transition-colors"
            >
              Wyczyść
            </button>
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                // Check if today is disabled
                if (!isDateDisabled(today)) {
                  const year = today.getFullYear();
                  const month = String(today.getMonth() + 1).padStart(2, '0');
                  const day = String(today.getDate()).padStart(2, '0');
                  const todayStr = `${year}-${month}-${day}`;
                  onChange(todayStr);
                  setViewDate(today);
                  setIsOpen(false);
                }
              }}
              disabled={isDateDisabled(new Date())}
              className={cn(
                'text-sm font-medium transition-colors',
                isDateDisabled(new Date()) 
                  ? 'text-gray-600 cursor-not-allowed' 
                  : 'text-[#d4a853] hover:text-[#e5b964]'
              )}
            >
              Dzisiaj
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
