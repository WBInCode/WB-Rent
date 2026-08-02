import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'gold' | 'info';
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
  success: 'bg-green-500/12 text-green-400 border-green-500/30',
  warning: 'bg-warning/20 text-warning border-warning/40',
  error: 'bg-red-500/12 text-red-400 border-red-500/30',
  gold: 'bg-gold/20 text-gold border-gold/40',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
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
