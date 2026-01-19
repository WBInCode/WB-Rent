import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface ParallaxProps {
  children: ReactNode;
  speed?: number; // 0.1 = subtle, 0.5 = strong
  className?: string;
}

export function Parallax({ children, speed = 0.2, className = '' }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : 100 * speed]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.div style={{ y }}>
        {children}
      </motion.div>
    </div>
  );
}

// Background parallax layer (for decorative elements)
interface ParallaxBackgroundProps {
  className?: string;
  speed?: number;
}

export function ParallaxBackground({ className = '', speed = 0.3 }: ParallaxBackgroundProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [-50, prefersReducedMotion ? 0 : 50 * speed]);

  return (
    <motion.div
      ref={ref}
      style={{ y }}
      className={`absolute inset-0 pointer-events-none ${className}`}
    />
  );
}
