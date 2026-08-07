import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  'aria-label'?: string;
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  /** `sm` matches a size="sm" Button (40px) for toolbars; `md` suits forms. */
  size?: 'sm' | 'md';
}

const triggerSizeStyles = {
  sm: 'h-10 px-3 pr-9 text-sm',
  md: 'px-4 py-3 pr-10',
} as const;

const Select = ({
  label,
  error,
  hint,
  options,
  placeholder = 'Wybierz...',
  value,
  onChange,
  disabled,
  required,
  className,
  id,
  size = 'md',
  'aria-label': ariaLabel,
}: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 300 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectId = id || label?.toLowerCase().replace(/\s/g, '-');

  const selectedOption = options.find(opt => opt.value === value);

  // Get position (event handlers only - not during render)
  const getPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const gap = 4;
      const menuHeight = Math.min(240, options.length * 44 + 16);
      const top = rect.bottom + gap + menuHeight <= window.innerHeight
        ? rect.bottom + gap
        : Math.max(8, rect.top - menuHeight - gap);
      const width = Math.min(rect.width, window.innerWidth - 16);
      const left = Math.min(
        Math.max(8, rect.left),
        Math.max(8, window.innerWidth - width - 8)
      );
      return {
        top,
        left,
        width
      };
    }
    return { top: 0, left: 0, width: 300 };
  }, [options.length]);

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

  // Keep the menu glued to its trigger while the page scrolls or resizes, and
  // only dismiss once the trigger leaves the viewport. Closing on every scroll
  // event made the menu dismiss itself while smooth scrolling was still
  // settling, so opening it right after an anchor jump appeared to do nothing.
  useEffect(() => {
    if (!isOpen) return;

    const handleReposition = (event?: Event) => {
      const target = event?.target;
      if (target instanceof Node && dropdownRef.current?.contains(target)) return;

      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) {
        setIsOpen(false);
        return;
      }
      setDropdownPos(getPosition());
    };

    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, getPosition]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange?.({ target: { value: optionValue } });
    setIsOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-medium text-text-secondary"
        >
          {label}
          {required && <span className="text-gold ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          id={selectId}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => {
            if (disabled) return;
            if (!isOpen) setDropdownPos(getPosition());
            setIsOpen(!isOpen);
          }}
          disabled={disabled}
          className={cn(
            'w-full text-left',
            'bg-bg-card border border-border',
            'rounded-[--radius-sm]',
            triggerSizeStyles[size],
            'transition-all duration-200',
            'hover:border-gold/50',
            'focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/30',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'cursor-pointer',
            isOpen && 'border-gold ring-2 ring-gold/30',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/30',
            className
          )}
        >
          {/* Never wrap: a two-line trigger breaks alignment with sibling controls. */}
          <span className={cn(
            'block truncate',
            selectedOption ? 'text-text-primary' : 'text-text-muted'
          )}>
            {selectedOption?.label || placeholder}
          </span>
        </button>
        <ChevronDown 
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none transition-transform duration-200',
            size === 'sm' ? 'w-4 h-4' : 'w-5 h-5',
            isOpen && 'rotate-180'
          )}
        />

        {/* Dropdown Portal */}
        {isOpen && createPortal(
          <div
            ref={dropdownRef}
            className="fixed py-2 rounded-[--radius-sm] bg-bg-card border border-border shadow-lg overflow-hidden"
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 99999,
              maxHeight: '240px',
              overflowY: 'auto'
            }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => !option.disabled && handleSelect(option.value)}
                disabled={option.disabled}
                className={cn(
                  'w-full px-4 py-2.5 text-left flex items-center justify-between gap-2',
                  'transition-colors duration-150',
                  option.disabled && 'opacity-50 cursor-not-allowed',
                  !option.disabled && 'hover:bg-gold/20 cursor-pointer',
                  option.value === value && 'bg-gold/10 text-gold-light light:text-gold-dark',
                  option.value !== value && 'text-text-primary'
                )}
              >
                <span>{option.label}</span>
                {option.value === value && (
                  <Check className="w-4 h-4 text-gold" />
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
      {error && (
        <p className="text-sm text-red-500 light:text-red-700">{error}</p>
      )}
      {hint && !error && (
        <p className="text-sm text-text-muted">{hint}</p>
      )}
    </div>
  );
};

export { Select, type SelectProps, type SelectOption };
