// Teltech Motion System (Arcane Precision)
// Reusable motion tokens, spring curves, easings and Framer Motion presets.

import { Transition, Variants } from "framer-motion";

/** Curvas de aceleração Teltech */
export const easings = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  outQuint: [0.22, 1, 0.36, 1] as const,
  inQuad: [0.55, 0.085, 0.68, 0.53] as const,
  inExpo: [0.7, 0, 0.84, 0] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  springSnap: [0.34, 1.4, 0.64, 1] as const,
};

/** Durações padronizadas em segundos */
export const durations = {
  instant: 0.1,
  fast: 0.16,
  normal: 0.24,
  moderate: 0.32,
  slow: 0.45,
  deliberate: 0.6,
};

/** Transição de mola com amortecimento firme (sem rebote excessivo) */
export const springPhysics: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.9,
};

/** Transição de mola para abas deslizantes */
export const tabSpring: Transition = {
  type: "spring",
  stiffness: 480,
  damping: 36,
};

/** Transição rápida para elementos que entram com energia executiva */
export const snappyTransition: Transition = {
  duration: durations.normal,
  ease: easings.outExpo,
};

/** Transição de saída ultrarrápida */
export const exitTransition: Transition = {
  duration: durations.fast,
  ease: easings.inExpo,
};

// ─── Variantes de Modais Centrais (Desktop) ──────────────────────────────────
export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 12,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: snappyTransition,
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 8,
    transition: exitTransition,
  },
};

// ─── Variantes de Modal para Mobile (Bottom-Sheet Slide) ──────────────────────
export const bottomSheetVariants: Variants = {
  hidden: {
    opacity: 0,
    y: "100%",
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 380,
      damping: 35,
    },
  },
  exit: {
    opacity: 0,
    y: "100%",
    transition: {
      duration: 0.18,
      ease: easings.inQuad,
    },
  },
};

// ─── Variantes de Backdrop / Fundo Escuro com Desfoque ────────────────────────
export const backdropVariants: Variants = {
  hidden: {
    opacity: 0,
    backdropFilter: "blur(0px)",
  },
  visible: {
    opacity: 1,
    backdropFilter: "blur(8px)",
    transition: { duration: 0.22, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    backdropFilter: "blur(0px)",
    transition: { duration: 0.16, ease: "easeIn" },
  },
};

// ─── Variantes de Drawer Lateral (Mobile ou Painel) ──────────────────────────
export const drawerVariants: Variants = {
  hidden: {
    x: "-100%",
  },
  visible: {
    x: 0,
    transition: {
      duration: 0.26,
      ease: easings.outExpo,
    },
  },
  exit: {
    x: "-100%",
    transition: {
      duration: 0.18,
      ease: easings.inQuad,
    },
  },
};

// ─── Variantes para Menus Dropdown e Popovers ─────────────────────────────────
export const dropdownVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.94,
    y: -4,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.16,
      ease: easings.outExpo,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -4,
    transition: {
      duration: 0.11,
      ease: easings.inQuad,
    },
  },
};

// ─── Variantes para Troca de Telas e Módulos (Page Transitions) ───────────────
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: easings.outExpo,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: 0.14,
      ease: easings.inExpo,
    },
  },
};

// ─── Variantes para Cascata de Listas (Stagger) ──────────────────────────────
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: snappyTransition,
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: exitTransition,
  },
};

// ─── Variantes para Acordeão (Expansão e Recolhimento de Altura) ───────────────
export const accordionVariants: Variants = {
  hidden: {
    height: 0,
    opacity: 0,
    overflow: "hidden",
  },
  visible: {
    height: "auto",
    opacity: 1,
    overflow: "hidden",
    transition: {
      height: { duration: 0.26, ease: easings.outExpo },
      opacity: { duration: 0.2, delay: 0.04 },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    overflow: "hidden",
    transition: {
      height: { duration: 0.2, ease: easings.inQuad },
      opacity: { duration: 0.14 },
    },
  },
};
