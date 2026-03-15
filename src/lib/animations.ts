import type { Variants, Transition } from "framer-motion";

// ── Spring & Tween Configs ──
export const SPRING_SNAPPY: Transition = { type: "spring", stiffness: 200, damping: 25, mass: 0.8 };
export const SPRING_GENTLE: Transition = { type: "spring", stiffness: 150, damping: 20, mass: 1 };
export const SPRING_BOUNCY: Transition = { type: "spring", stiffness: 300, damping: 22, mass: 0.7 };
export const TWEEN_FAST: Transition = { type: "tween", duration: 0.15, ease: "easeOut" };
export const TWEEN_MEDIUM: Transition = { type: "tween", duration: 0.25, ease: [0.25, 0.1, 0.25, 1] };

// Basic animations
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

export const slideUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: {
    opacity: { duration: 0.2, ease: "easeOut" as const },
    y: SPRING_GENTLE,
  },
};

export const slideInLeft = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: TWEEN_MEDIUM,
};

export const slideInRight = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 16 },
  transition: TWEEN_MEDIUM,
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: {
    opacity: { duration: 0.15, ease: "easeOut" as const },
    scale: SPRING_SNAPPY,
  },
};

// Message bubble animation
export const messageBubble = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: {
    opacity: { duration: 0.2, ease: "easeOut" as const },
    y: SPRING_GENTLE,
  },
};

// Stagger
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      opacity: { duration: 0.2, ease: "easeOut" as const },
      y: SPRING_SNAPPY,
    },
  },
};

// Hover & tap
export const hoverScale = {
  scale: 1.02,
  transition: TWEEN_FAST,
};

export const tapShrink = {
  scale: 0.97,
};

// Sidebar animation
export const sidebarAnimation = {
  initial: { x: -280 },
  animate: { x: 0 },
  exit: { x: -280 },
  transition: TWEEN_MEDIUM,
};

// Settings panel (from right)
export const panelSlideRight = {
  initial: { x: 320 },
  animate: { x: 0 },
  exit: { x: 320 },
  transition: TWEEN_MEDIUM,
};

// Modal / drawer entrance
export const modalEntrance = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 30 },
  transition: SPRING_BOUNCY,
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
