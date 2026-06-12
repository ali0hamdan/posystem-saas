import type { Variants, Transition } from 'framer-motion';

// Smooth, calm easing (ease-out style). No bounce.
export const SMOOTH_EASE = [0.16, 1, 0.3, 1] as const;
export const EXIT_EASE = [0.7, 0, 0.84, 0] as const;

// Duration (ms) of the split "door-opening" exit — used to time navigation.
export const SPLIT_EXIT_MS = 650;

const panelIn: Transition = { duration: 0.6, ease: SMOOTH_EASE };
const panelOut: Transition = { duration: SPLIT_EXIT_MS / 1000, ease: EXIT_EASE };

// Whole-page wrapper (opacity only — safe for fixed/3D backgrounds).
export const pageContainerVariants: Variants = {
  hidden: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } },
};

// Left marketing panel: slides in from the left; on exit slides back out left.
export const leftPanelVariants: Variants = {
  hidden: { x: '-100%', opacity: 0 },
  enter: { x: 0, opacity: 1, transition: panelIn },
  exit: { x: '-100%', opacity: 1, transition: panelOut },
};

// Right form panel: slides in from the right; on exit slides out right.
export const rightPanelVariants: Variants = {
  hidden: { x: '100%', opacity: 0 },
  enter: { x: 0, opacity: 1, transition: panelIn },
  exit: { x: '100%', opacity: 1, transition: panelOut },
};

// Container that staggers its children in, one by one.
export const staggerContainerVariants: Variants = {
  hidden: {},
  enter: { transition: { staggerChildren: 0.08, delayChildren: 0.18 } },
  exit: {},
};

// Each staggered child: fades + rises gently.
export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.5, ease: SMOOTH_EASE } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

// Explicit split-exit variants (left half leaves left, right half leaves right).
export const splitExitLeftVariants = leftPanelVariants;
export const splitExitRightVariants = rightPanelVariants;

// Reduced-motion fallback: no transforms, just a quick fade.
export const reducedVariants: Variants = {
  hidden: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};
