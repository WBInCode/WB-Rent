import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'gold' | 'info' | 'solidSuccess' | 'solidError';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-strong text-text-secondary border-border',
  success: 'bg-green-500/12 text-green-400 light:text-green-700 border-green-500/30',
  warning: 'bg-warning/20 text-warning border-warning/40',
  error: 'bg-red-500/12 text-red-400 light:text-red-700 border-red-500/30',
  gold: 'bg-gold/20 text-gold-light light:text-gold-dark border-gold/40',
  info: 'bg-blue-500/20 text-blue-400 light:text-blue-700 border-blue-500/40',
  // Pełne tło — dla plakietek leżących na zdjęciu, gdzie nie wiadomo, co jest pod spodem.
  solidSuccess: 'bg-emerald-700 text-white border-emerald-800',
  solidError: 'bg-red-700 text-white border-red-800',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-3 py-1 text-xs font-semibold',
  md: 'px-4 py-1.5 text-sm font-semibold',
};

export function Badge({
  variant = 'default',
  size = 'sm',
  children,
  className,
  icon,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        'font-medium',
        'rounded-full',
        'border',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

export type { BadgeProps, BadgeVariant };
