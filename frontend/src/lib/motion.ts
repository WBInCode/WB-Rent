// WB-Rent Motion System
// Spójne tokeny animacji dla całego projektu

import type { Transition, Variants } from 'framer-motion';

// === TRANSITION PRESETS ===
export const transitions = {
  fast: {
    duration: 0.15,
    ease: [0.25, 0.1, 0.25, 1],
  } as Transition,
  
  normal: {
    duration: 0.3,
    ease: [0.25, 0.1, 0.25, 1],
  } as Transition,
  
  slow: {
    duration: 0.5,
    ease: [0.25, 0.1, 0.25, 1],
  } as Transition,
  
  spring: {
    type: 'spring',
    stiffness: 400,
    damping: 30,
  } as Transition,
  
  springBouncy: {
    type: 'spring',
    stiffness: 300,
    damping: 20,
  } as Transition,
};

// === REVEAL VARIANTS (scroll animations) ===
export const revealVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.normal,
  },
};

export const revealFromLeftVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -24,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.normal,
  },
};

export const revealFromRightVariants: Variants = {
  hidden: {
    opacity: 0,
    x: 24,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.normal,
  },
};

// === STAGGER CONTAINER ===
export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 16,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.normal,
  },
};

// === HOVER EFFECTS ===
export const hoverLiftVariants = {
  rest: {
    y: 0,
    scale: 1,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  },
  hover: {
    y: -6,
    scale: 1.01,
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
    transition: transitions.spring,
  },
};

export const hoverGlowVariants = {
  rest: {
    boxShadow: '0 0 0 rgba(245, 158, 11, 0)',
  },
  hover: {
    boxShadow: '0 0 30px rgba(245, 158, 11, 0.2)',
    transition: transitions.normal,
  },
};

// === BUTTON VARIANTS ===
export const buttonHoverVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: transitions.spring },
  tap: { scale: 0.98, transition: transitions.fast },
};

// === FADE VARIANTS ===
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: transitions.normal,
  },
  exit: { 
    opacity: 0,
    transition: transitions.fast,
  },
};

// === NAVBAR SCROLL ===
export const navbarVariants: Variants = {
  top: {
    backgroundColor: 'rgba(10, 10, 10, 0)',
    backdropFilter: 'blur(0px)',
    boxShadow: 'none',
  },
  scrolled: {
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  },
};

// === SCALE VARIANTS ===
export const scaleInVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.spring,
  },
};

// === HELPER: Check reduced motion preference ===
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// === REDUCED MOTION SAFE VARIANTS ===
export const getRevealVariants = (): Variants => {
  if (prefersReducedMotion()) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.1 } },
    };
  }
  return revealVariants;
};
