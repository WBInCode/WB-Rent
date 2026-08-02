import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
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
    bg-gradient-to-r from-gold via-gold-light to-gold bg-[length:200%_100%] bg-left
    text-bg-primary font-semibold
    hover:bg-right hover:shadow-[0_0_28px_rgba(212,168,75,0.35)]
    shadow-md
    transition-[background-position,box-shadow] duration-300
  `,
  secondary: `
    bg-bg-card text-text-primary font-medium
    border border-border hover:border-border-hover
    hover:bg-bg-card-hover
  `,
  ghost: `
    bg-transparent text-text-secondary font-medium
    hover:text-text-primary hover:bg-surface-soft
  `,
  outline: `
    bg-transparent text-gold font-medium
    border border-gold/30 hover:border-gold
    hover:bg-gold-muted hover:shadow-[0_0_20px_rgba(212,168,75,0.15)]
  `,
};

// Fixed heights keep buttons aligned with inputs and selects of the same size
// (40 / 48 / 56 px) instead of drifting with font metrics.
const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-sm gap-1.5 rounded-[--radius-sm]',
  md: 'h-12 px-6 text-base gap-2 rounded-[--radius-md]',
  lg: 'h-14 px-8 text-lg gap-2.5 rounded-[--radius-lg]',
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
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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
