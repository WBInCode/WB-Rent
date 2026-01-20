import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
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
}

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
}: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectId = id || label?.toLowerCase().replace(/\s/g, '-');

  const selectedOption = options.find(opt => opt.value === value);

  // Get position
  const getPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      return {
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      };
    }
    return { top: 0, left: 0, width: 300 };
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
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'w-full text-left',
            'bg-bg-card border border-border',
            'rounded-xl',
            'px-4 py-3 pr-10',
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
          <span className={cn(
            selectedOption ? 'text-text-primary' : 'text-text-muted'
          )}>
            {selectedOption?.label || placeholder}
          </span>
        </button>
        <ChevronDown 
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />

        {/* Dropdown Portal */}
        {isOpen && createPortal(
          <div
            ref={dropdownRef}
            className="fixed py-2 rounded-xl bg-[#1a1a1a] border border-[#333] shadow-2xl overflow-hidden"
            style={{
              top: getPosition().top,
              left: getPosition().left,
              width: getPosition().width,
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
                  !option.disabled && 'hover:bg-[#d4a853]/20 cursor-pointer',
                  option.value === value && 'bg-[#d4a853]/10 text-[#d4a853]',
                  option.value !== value && 'text-white'
                )}
              >
                <span>{option.label}</span>
                {option.value === value && (
                  <Check className="w-4 h-4 text-[#d4a853]" />
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      {hint && !error && (
        <p className="text-sm text-text-muted">{hint}</p>
      )}
    </div>
  );
};

export { Select, type SelectProps, type SelectOption };
