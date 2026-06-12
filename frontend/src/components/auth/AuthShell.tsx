import { useCallback, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  SMOOTH_EASE, EXIT_EASE, SPLIT_EXIT_MS,
  staggerContainerVariants, staggerItemVariants, reducedVariants,
} from '@/lib/animations';

const panelIn = { duration: 0.6, ease: SMOOTH_EASE };
const panelOut = { duration: SPLIT_EXIT_MS / 1000, ease: EXIT_EASE };

// Panel motion depends on how the page was reached:
//  • slideIn (Home → auth)  → panel slides in from its side, then can door-exit.
//  • !slideIn (auth ↔ auth) → panel stays put; only the inner content swaps.
// The `exit` variant is always the door-split, so Back-to-Home looks the same
// regardless of how the page was entered.
function buildPanelVariants(side: 'left' | 'right', slideIn: boolean): Variants {
  const off = side === 'left' ? '-100%' : '100%';
  return {
    hidden: slideIn ? { x: off, opacity: 0 } : { x: 0, opacity: 1 },
    enter: { x: 0, opacity: 1, transition: panelIn },
    exit: { x: off, opacity: 1, transition: panelOut },
  };
}

export interface AuthTransition {
  animState: 'enter' | 'exit';
  goHome: () => void;
  goAuth: (path: string) => void;
  vLeftPanel: Variants;
  vRightPanel: Variants;
  /** Inner-content stagger container (use with initial="hidden" animate="enter"). */
  vContainer: Variants;
  /** Inner-content stagger item. */
  vItem: Variants;
}

/**
 * Drives the auth-page transitions. Reads navigation intent from the router
 * location state (`authSwitch` is set when moving between /login and
 * /get-started) and exposes the variants + navigation handlers a page needs.
 */
export function useAuthTransition(): AuthTransition {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const [exiting, setExiting] = useState(false);

  const fromAuth = Boolean((location.state as { authSwitch?: boolean } | null)?.authSwitch);
  const slideIn = !fromAuth; // Home → auth slides panels in; auth ↔ auth does not.
  const animState: 'enter' | 'exit' = exiting ? 'exit' : 'enter';

  const goHome = useCallback(() => {
    if (exiting) return;
    if (reduce) {
      navigate('/');
      return;
    }
    setExiting(true);
    window.setTimeout(() => navigate('/'), SPLIT_EXIT_MS);
  }, [exiting, reduce, navigate]);

  const goAuth = useCallback(
    (path: string) => {
      navigate(path, { state: { authSwitch: true } });
    },
    [navigate],
  );

  return {
    animState,
    goHome,
    goAuth,
    vLeftPanel: reduce ? reducedVariants : buildPanelVariants('left', slideIn),
    vRightPanel: reduce ? reducedVariants : buildPanelVariants('right', slideIn),
    vContainer: reduce ? reducedVariants : staggerContainerVariants,
    vItem: reduce ? reducedVariants : staggerItemVariants,
  };
}

/**
 * Persistent two-column shell shared by the Login and Get Started pages.
 * It owns the panel chrome (dark marketing panel + form canvas) and the panel
 * slide/door motion; pages supply only the inner `left` and `right` content,
 * which they animate with `t.vContainer` / `t.vItem`.
 */
export function AuthShell({
  t,
  left,
  right,
}: {
  t: AuthTransition;
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="flex min-h-screen overflow-hidden bg-canvas">
      {/* ── Left marketing panel ── */}
      <motion.div
        variants={t.vLeftPanel}
        initial="hidden"
        animate={t.animState}
        className="relative hidden flex-col overflow-hidden bg-[#090e1a] lg:flex lg:w-[420px] xl:w-[480px]"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary-500/10 blur-3xl" />
        {left}
      </motion.div>

      {/* ── Right form panel ── */}
      <motion.div
        variants={t.vRightPanel}
        initial="hidden"
        animate={t.animState}
        className="relative flex flex-1 flex-col overflow-hidden bg-canvas"
      >
        {right}
      </motion.div>
    </div>
  );
}
