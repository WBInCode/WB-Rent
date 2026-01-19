import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { buttonHoverVariants, transitions } from '@/lib/motion';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-gold text-bg-primary font-semibold
    hover:bg-gold-light
    shadow-md hover:shadow-lg
  `,
  secondary: `
    bg-bg-card text-text-primary font-medium
    border border-border hover:border-border-hover
    hover:bg-bg-card-hover
  `,
  ghost: `
    bg-transparent text-text-secondary font-medium
    hover:text-text-primary hover:bg-white/5
  `,
  outline: `
    bg-transparent text-gold font-medium
    border border-gold/30 hover:border-gold
    hover:bg-gold-muted
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm gap-1.5 rounded-[--radius-sm]',
  md: 'px-6 py-3 text-base gap-2 rounded-[--radius-md]',
  lg: 'px-8 py-4 text-lg gap-2.5 rounded-[--radius-lg]',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        variants={buttonHoverVariants}
        initial="rest"
        whileHover={disabled || isLoading ? undefined : 'hover'}
        whileTap={disabled || isLoading ? undefined : 'tap'}
        transition={transitions.spring}
        className={cn(
          'inline-flex items-center justify-center',
          'cursor-pointer select-none',
          'transition-colors duration-[--duration-fast]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Ładowanie...
          </span>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize };
