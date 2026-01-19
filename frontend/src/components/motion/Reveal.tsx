import { motion, type Variants, type HTMLMotionProps } from 'framer-motion';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { type ReactNode } from 'react';

// Animation variants
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const fadeDown: Variants = {
  hidden: { opacity: 0, y: -30 },
  visible: { opacity: 1, y: 0 },
};

const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0 },
};

const fadeRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0 },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

const variantMap = {
  'fade-up': fadeUp,
  'fade-down': fadeDown,
  'fade-left': fadeLeft,
  'fade-right': fadeRight,
  'fade-in': fadeIn,
  'scale-up': scaleUp,
} as const;

type RevealVariant = keyof typeof variantMap;

interface RevealProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  threshold?: number;
  triggerOnce?: boolean;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'span';
}

export function Reveal({
  children,
  variant = 'fade-up',
  delay = 0,
  duration = 0.5,
  threshold = 0.1,
  triggerOnce = true,
  className = '',
  as = 'div',
  ...props
}: RevealProps) {
  const { ref, isInView } = useScrollReveal<HTMLDivElement>({
    threshold,
    triggerOnce,
  });

  const Component = motion[as] as typeof motion.div;

  return (
    <Component
      ref={ref}
      variants={variantMap[variant]}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
}

// Stagger container for animating children in sequence
interface StaggerProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: ReactNode;
  staggerDelay?: number;
  delayChildren?: number;
  threshold?: number;
  triggerOnce?: boolean;
  className?: string;
}

export function Stagger({
  children,
  staggerDelay = 0.1,
  delayChildren = 0,
  threshold = 0.1,
  triggerOnce = true,
  className = '',
  ...props
}: StaggerProps) {
  const { ref, isInView } = useScrollReveal<HTMLDivElement>({
    threshold,
    triggerOnce,
  });

  return (
    <motion.div
      ref={ref}
      variants={{
        hidden: { opacity: 1 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren,
          },
        },
      }}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Stagger item - use inside Stagger
interface StaggerItemProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: ReactNode;
  variant?: RevealVariant;
  duration?: number;
  className?: string;
}

export function StaggerItem({
  children,
  variant = 'fade-up',
  duration = 0.5,
  className = '',
  ...props
}: StaggerItemProps) {
  return (
    <motion.div
      variants={variantMap[variant]}
      transition={{
        duration,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
