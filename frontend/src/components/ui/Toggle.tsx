import { forwardRef, type InputHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, description, className, id, checked, onChange, ...props }, ref) => {
    const toggleId = id || label?.toLowerCase().replace(/\s/g, '-');

    return (
      <label
        htmlFor={toggleId}
        className={cn(
          'flex items-center gap-3 cursor-pointer group',
          props.disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            id={toggleId}
            checked={checked}
            onChange={onChange}
            className="sr-only peer"
            {...props}
          />
          {/* Track */}
          <div
            className={cn(
              'w-11 h-6',
              'bg-bg-card border border-border',
              'rounded-full',
              'transition-colors duration-[--duration-fast]',
              'peer-checked:bg-gold peer-checked:border-gold',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-gold/30'
            )}
          />
          {/* Thumb */}
          <motion.div
            layout
            transition={transitions.spring}
            className={cn(
              'absolute top-1 left-1',
              'w-4 h-4',
              'bg-text-muted',
              'rounded-full',
              'peer-checked:bg-bg-primary',
              'peer-checked:left-6'
            )}
            style={{
              left: checked ? '24px' : '4px',
              backgroundColor: checked ? 'var(--color-bg-primary)' : 'var(--color-text-muted)',
            }}
          />
        </div>
        
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <span className="text-sm font-medium text-text-primary">
                {label}
              </span>
            )}
            {description && (
              <span className="text-xs text-text-muted">
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Toggle.displayName = 'Toggle';

export { Toggle, type ToggleProps };
