"use client";

/**
 * Motion utilities and animation variants for Verto UI
 *
 * Based on Motion (formerly Framer Motion) - import from "motion/react"
 * All animations respect prefers-reduced-motion via useReducedMotion hook
 */

import { type Variants, type Transition } from "motion/react";

// ============================================================
// Spring Configurations (Notion-like feel)
// ============================================================

export const springConfig = {
  /** Default spring - smooth and responsive */
  default: { type: "spring", stiffness: 400, damping: 30 } as Transition,

  /** Gentle spring - for subtle movements */
  gentle: { type: "spring", stiffness: 300, damping: 35 } as Transition,

  /** Bouncy spring - for playful interactions */
  bouncy: { type: "spring", stiffness: 500, damping: 25 } as Transition,

  /** Stiff spring - for snappy feedback */
  stiff: { type: "spring", stiffness: 600, damping: 35 } as Transition,

  /** Soft spring - for slow, elegant transitions */
  soft: { type: "spring", stiffness: 200, damping: 30 } as Transition,
} as const;

// ============================================================
// Easing Functions
// ============================================================

export const easing = {
  /** Expo out - fast start, smooth finish (Notion default) */
  outExpo: [0.16, 1, 0.3, 1] as const,

  /** Quart out - slightly less dramatic than expo */
  outQuart: [0.25, 1, 0.5, 1] as const,

  /** Back out - slight overshoot for playful feel */
  outBack: [0.34, 1.56, 0.64, 1] as const,

  /** Circ out - for natural deceleration */
  outCirc: [0, 0.55, 0.45, 1] as const,
} as const;

// ============================================================
// Duration Presets
// ============================================================

export const duration = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
  slower: 0.4,
  slowest: 0.5,
} as const;

// ============================================================
// Fade Variants
// ============================================================

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.normal, ease: easing.outExpo },
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.fast, ease: easing.outQuart },
  },
};

// ============================================================
// Slide Variants
// ============================================================

export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.normal, ease: easing.outExpo },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: duration.fast, ease: easing.outQuart },
  },
};

export const slideDownVariants: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.normal, ease: easing.outExpo },
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: { duration: duration.fast, ease: easing.outQuart },
  },
};

export const slideLeftVariants: Variants = {
  hidden: { opacity: 0, x: 8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: duration.normal, ease: easing.outExpo },
  },
  exit: {
    opacity: 0,
    x: -4,
    transition: { duration: duration.fast, ease: easing.outQuart },
  },
};

export const slideRightVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: duration.normal, ease: easing.outExpo },
  },
  exit: {
    opacity: 0,
    x: 4,
    transition: { duration: duration.fast, ease: easing.outQuart },
  },
};

// ============================================================
// Scale Variants
// ============================================================

export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springConfig.default,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: duration.fast, ease: easing.outQuart },
  },
};

export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springConfig.bouncy,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: duration.fast, ease: easing.outQuart },
  },
};

// ============================================================
// Interactive Variants (for buttons, cards, etc.)
// ============================================================

export const buttonTapScale = 0.97;
export const buttonHoverScale = 1.02;

export const interactiveVariants: Variants = {
  idle: { scale: 1 },
  hover: { scale: 1.02, transition: springConfig.stiff },
  tap: { scale: 0.97, transition: springConfig.stiff },
};

export const subtleInteractiveVariants: Variants = {
  idle: { scale: 1 },
  hover: { scale: 1.01, transition: springConfig.stiff },
  tap: { scale: 0.99, transition: springConfig.stiff },
};

// ============================================================
// List Stagger Variants
// ============================================================

export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.normal, ease: easing.outExpo },
  },
};

// ============================================================
// Expand/Collapse Variants
// ============================================================

export const expandVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: { duration: duration.normal, ease: easing.outExpo },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: { duration: duration.normal, ease: easing.outExpo },
  },
};

// ============================================================
// Tooltip/Popover Variants
// ============================================================

export const tooltipVariants: Variants = {
  hidden: { opacity: 0, y: 4, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: duration.fast, ease: easing.outExpo },
  },
  exit: {
    opacity: 0,
    y: 2,
    scale: 0.98,
    transition: { duration: 0.1, ease: easing.outQuart },
  },
};

// ============================================================
// Skeleton Shimmer (for loading states)
// ============================================================

export const shimmerVariants: Variants = {
  initial: { backgroundPosition: "-200% 0" },
  animate: {
    backgroundPosition: "200% 0",
    transition: {
      repeat: Infinity,
      duration: 1.5,
      ease: "linear",
    },
  },
};
