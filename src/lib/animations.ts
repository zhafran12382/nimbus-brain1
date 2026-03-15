import type { Variants, Transition } from "framer-motion";

// Transitions
const springDefault: Transition = { type: "spring", stiffness: 400, damping: 30 };
const springGentle: Transition = { type: "spring", stiffness: 300, damping: 28 };
const springSnappy: Transition = { type: "spring", stiffness: 400, damping: 25 };
const springStagger: Transition = { type: "spring", stiffness: 350, damping: 25 };

// Basic animations
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

export const slideUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
  transition: springDefault,
};

export const slideInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: springGentle,
};

export const slideInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
  transition: springGentle,
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: springSnappy,
};

// Stagger
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: springStagger,
  },
};

// Hover & tap
export const hoverLift = {
  y: -3,
  transition: springDefault,
};

export const hoverScale = {
  scale: 1.02,
  transition: springDefault,
};

export const tapShrink = {
  scale: 0.97,
};

// Sidebar animation
export const sidebarAnimation = {
  initial: { x: -280 },
  animate: { x: 0 },
  exit: { x: -280 },
  transition: springGentle,
};

// Settings panel (from right)
export const panelSlideRight = {
  initial: { x: 320 },
  animate: { x: 0 },
  exit: { x: 320 },
  transition: springGentle,
};

// Reduced motion helper
export const getReducedMotionProps = (prefersReduced: boolean) => {
  if (prefersReduced) {
    return {
      initial: false as const,
      animate: {},
      exit: {},
      transition: { duration: 0 },
    };
  }
  return {};
};
