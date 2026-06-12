import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';

/**
 * Landing-page parallax cash register.
 *
 * Renders a fixed full-viewport <Canvas> behind all landing content with
 *   - `pointer-events: none`   → never blocks clicks / text selection
 *   - `z-index: 0`             → sits above bg-canvas, below all `relative` content
 *   - `opacity` tuned per theme so it never competes with the headline
 *
 * Scroll wiring lives in <CashRegister>, which reads a smoothed scroll
 * progress (0 = top, 1 = bottom of document) and maps it to:
 *   - vertical drift   (slight downward motion as you scroll)
 *   - Y-axis rotation  (slow turn that reveals the drawer)
 *   - drawer opening   (slides out between 15% – 60% scroll, then closes)
 *   - coin pop         (floats out of the drawer when drawer is fully open)
 *
 * Honors `prefers-reduced-motion`: renders a single static frame, no animation.
 * Skips mounting on viewports < 768px (no 3D widget on mobile — performance + focus).
 */
export function LandingScene3D({ dark }: { dark: boolean }) {
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  if (!enabled) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: dark ? 0.55 : 0.7 }}
    >
      <Canvas
        camera={{ position: [0, 0.6, 6], fov: 38 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        frameloop={reduce ? 'demand' : 'always'}
      >
        <SceneLighting dark={dark} />
        <CashRegister dark={dark} reduce={Boolean(reduce)} />
      </Canvas>
    </div>
  );
}

function SceneLighting({ dark }: { dark: boolean }) {
  return (
    <>
      <ambientLight intensity={dark ? 0.45 : 0.65} />
      <directionalLight
        position={[4, 5, 3]}
        intensity={dark ? 0.9 : 1.05}
        color={dark ? '#a5b4fc' : '#ffffff'}
      />
      <directionalLight position={[-3, 2, -2]} intensity={0.25} color={'#c4b5fd'} />
    </>
  );
}

/** Smoothed-scroll progress in [0,1]. Updated on every scroll/resize event. */
function useScrollProgress() {
  const ref = useRef(0);
  const targetRef = useRef(0);

  useEffect(() => {
    const compute = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      targetRef.current = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0;
    };
    compute();
    window.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
    };
  }, []);

  // Returns { current, target } so the consumer can lerp manually inside a frame.
  return { current: ref, target: targetRef };
}

function CashRegister({ dark, reduce }: { dark: boolean; reduce: boolean }) {
  const group = useRef<THREE.Group>(null);
  const drawer = useRef<THREE.Group>(null);
  const coin = useRef<THREE.Group>(null);
  const { current, target } = useScrollProgress();

  // Palette tuned to the new orange/warm landing background. Dark mode uses
  // deep zinc/burnt-orange tones; light mode uses soft warm cream + orange.
  const palette = useMemo(
    () =>
      dark
        ? {
            body: '#27272a',           // zinc-800 — neutral cool body
            bodyAccent: '#3f3f46',
            top: '#9a3412',            // burnt orange (primary-800)
            display: '#fb923c',        // primary-400 — warm screen glow
            keypad: '#18181b',
            keyTop: '#fdba74',         // primary-300 keys
            drawer: '#c2410c',         // primary-700 drawer
            metal: '#d4d4d8',          // chrome trim
            coin: '#fbbf24',           // amber-400 coin (kept)
            shadow: '#0a0a0b',
          }
        : {
            body: '#fff7ed',           // primary-50 (warm cream)
            bodyAccent: '#fed7aa',     // primary-200
            top: '#fdba74',            // primary-300
            display: '#c2410c',        // primary-700 — readable on cream
            keypad: '#ffedd5',         // primary-100
            keyTop: '#f97316',         // primary-500 keys
            drawer: '#fed7aa',         // primary-200 drawer
            metal: '#a8a29e',          // warm stone trim
            coin: '#f59e0b',           // amber-500 coin
            shadow: '#fdba74',
          },
    [dark],
  );

  useFrame((_, delta) => {
    // Smooth the target so abrupt scrolls feel like inertia rather than a jump.
    current.current += (target.current - current.current) * Math.min(1, delta * 4);
    const p = reduce ? 0.25 : current.current;

    if (group.current) {
      // Constant gentle position offset + scroll-driven rotation reveal.
      group.current.position.x = 2.6;          // right side of viewport
      group.current.position.y = 0.4 - p * 1.6;
      group.current.position.z = -0.4;
      group.current.rotation.y = -0.35 + p * Math.PI * 0.8;
      group.current.rotation.x = 0.06 + p * 0.05;
      // Ambient bob (skipped if reduced motion).
      if (!reduce) {
        group.current.position.y += Math.sin(performance.now() * 0.0006) * 0.08;
      }
    }

    if (drawer.current) {
      // Drawer slides out between 15%–60%, then slides back so the second
      // half of the page sees a clean register again.
      const open =
        p < 0.15 ? 0 : p > 0.6 ? Math.max(0, 1 - (p - 0.6) / 0.25) : (p - 0.15) / 0.45;
      drawer.current.position.z = open * 0.85;
    }

    if (coin.current) {
      // Coin pops up when drawer is mostly open, then drifts down.
      const open =
        p < 0.2 ? 0 : p > 0.55 ? Math.max(0, 1 - (p - 0.55) / 0.2) : (p - 0.2) / 0.35;
      coin.current.position.y = -0.05 + open * 0.85;
      coin.current.position.z = 0.55 + open * 0.6;
      coin.current.rotation.y += delta * 1.4 * open;
      const scale = 0.18 + open * 0.08;
      coin.current.scale.setScalar(scale);
      const matRef = (coin.current.children[0] as THREE.Mesh | undefined)?.material as
        | THREE.MeshStandardMaterial
        | undefined;
      if (matRef) matRef.opacity = open;
    }
  });

  return (
    <Float
      enabled={!reduce}
      speed={0.6}
      rotationIntensity={0.15}
      floatIntensity={0.4}
    >
      <group ref={group} scale={0.9}>
        {/* Soft contact shadow */}
        <mesh position={[0, -0.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.4, 32]} />
          <meshBasicMaterial color={palette.shadow} transparent opacity={dark ? 0.35 : 0.18} />
        </mesh>

        {/* Main body */}
        <mesh position={[0, -0.15, 0]} castShadow>
          <boxGeometry args={[1.8, 1.0, 1.4]} />
          <meshStandardMaterial color={palette.body} roughness={0.55} metalness={0.05} />
        </mesh>

        {/* Body bevel / belt line */}
        <mesh position={[0, -0.05, 0.71]}>
          <boxGeometry args={[1.6, 0.06, 0.02]} />
          <meshStandardMaterial color={palette.bodyAccent} roughness={0.6} />
        </mesh>

        {/* Drawer (slides on Z) */}
        <group ref={drawer} position={[0, -0.35, 0]}>
          <mesh>
            <boxGeometry args={[1.55, 0.4, 1.3]} />
            <meshStandardMaterial color={palette.drawer} roughness={0.6} metalness={0.1} />
          </mesh>
          {/* Drawer handle */}
          <mesh position={[0, 0, 0.66]}>
            <boxGeometry args={[0.5, 0.08, 0.04]} />
            <meshStandardMaterial color={palette.metal} roughness={0.25} metalness={0.85} />
          </mesh>
        </group>

        {/* Top angled display housing */}
        <group position={[0, 0.55, -0.1]} rotation={[-0.25, 0, 0]}>
          <mesh>
            <boxGeometry args={[1.4, 0.7, 0.18]} />
            <meshStandardMaterial color={palette.top} roughness={0.4} metalness={0.15} />
          </mesh>
          {/* Screen */}
          <mesh position={[0, 0.04, 0.1]}>
            <boxGeometry args={[1.15, 0.45, 0.03]} />
            <meshStandardMaterial
              color={palette.display}
              emissive={palette.display}
              emissiveIntensity={dark ? 0.85 : 0.45}
              roughness={0.2}
            />
          </mesh>
          {/* Screen lit indicator */}
          <mesh position={[-0.42, -0.22, 0.1]}>
            <sphereGeometry args={[0.025, 16, 16]} />
            <meshStandardMaterial
              color={palette.coin}
              emissive={palette.coin}
              emissiveIntensity={1.2}
            />
          </mesh>
        </group>

        {/* Keypad — 3x4 grid of round nubs on top-front */}
        <Keypad palette={palette} />

        {/* Receipt slot */}
        <mesh position={[0.5, 0.27, 0.71]}>
          <boxGeometry args={[0.55, 0.04, 0.01]} />
          <meshStandardMaterial color={palette.metal} roughness={0.4} metalness={0.6} />
        </mesh>
        {/* Receipt poking out */}
        <mesh position={[0.5, 0.42, 0.71]} rotation={[0.15, 0, 0]}>
          <planeGeometry args={[0.5, 0.3]} />
          <meshStandardMaterial
            color={dark ? '#f1f5f9' : '#ffffff'}
            roughness={0.95}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Floating coin (pops from drawer at scroll mid-point) */}
        <group ref={coin} position={[-0.4, -0.05, 0.55]} scale={0.18}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.9, 0.9, 0.18, 32]} />
            <meshStandardMaterial
              color={palette.coin}
              roughness={0.35}
              metalness={0.85}
              transparent
              opacity={0}
            />
          </mesh>
        </group>
      </group>
    </Float>
  );
}

function Keypad({
  palette,
}: {
  palette: { keypad: string; keyTop: string };
}) {
  const keys = useMemo(() => {
    const rows = 4;
    const cols = 3;
    const out: Array<[number, number, number]> = [];
    const stepX = 0.28;
    const stepY = 0.18;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push([
          (c - (cols - 1) / 2) * stepX,
          0.18 - r * stepY,
          0.72,
        ]);
      }
    }
    return out;
  }, []);

  return (
    <group>
      {/* Keypad recessed background */}
      <mesh position={[0, -0.05, 0.72]}>
        <boxGeometry args={[1.0, 0.85, 0.02]} />
        <meshStandardMaterial color={palette.keypad} roughness={0.7} />
      </mesh>
      {keys.map((pos, i) => (
        <mesh
          key={i}
          position={pos}
          onPointerOver={preventEvent}
        >
          <cylinderGeometry args={[0.06, 0.06, 0.04, 16]} />
          <meshStandardMaterial color={palette.keyTop} roughness={0.4} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

// React-three-fiber events shouldn't propagate to anything anyway because the
// container has `pointer-events: none`, but defending in case a future change
// flips that.
function preventEvent(e: ThreeEvent<PointerEvent>) {
  e.stopPropagation();
}
