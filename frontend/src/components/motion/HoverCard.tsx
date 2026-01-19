import { motion, type HTMLMotionProps } from 'framer-motion';
import { type ReactNode } from 'react';

interface HoverCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  className?: string;
  lift?: number;
  glow?: boolean;
  glowColor?: string;
  scale?: number;
}

export function HoverCard({
  children,
  className = '',
  lift = 8,
  glow = true,
  glowColor = 'var(--color-gold)',
  scale = 1.02,
  ...props
}: HoverCardProps) {
  return (
    <motion.div
      className={className}
      whileHover={{
        y: -lift,
        scale,
        boxShadow: glow
          ? `0 20px 40px -10px ${glowColor}33, 0 0 0 1px ${glowColor}22`
          : '0 20px 40px -10px rgba(0,0,0,0.3)',
      }}
      whileTap={{ scale: 0.98 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Hover scale button effect
interface HoverScaleProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  className?: string;
  scaleHover?: number;
  scaleTap?: number;
}

export function HoverScale({
  children,
  className = '',
  scaleHover = 1.05,
  scaleTap = 0.95,
  ...props
}: HoverScaleProps) {
  return (
    <motion.div
      className={className}
      whileHover={{ scale: scaleHover }}
      whileTap={{ scale: scaleTap }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 17,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Hover glow effect (for icons, badges)
interface HoverGlowProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  intensity?: 'subtle' | 'medium' | 'strong';
}

export function HoverGlow({
  children,
  className = '',
  glowColor = 'var(--color-gold)',
  intensity = 'medium',
  ...props
}: HoverGlowProps) {
  const glowIntensity = {
    subtle: '0 0 15px',
    medium: '0 0 25px',
    strong: '0 0 40px',
  };

  return (
    <motion.div
      className={className}
      whileHover={{
        boxShadow: `${glowIntensity[intensity]} ${glowColor}55`,
      }}
      transition={{ duration: 0.3 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
