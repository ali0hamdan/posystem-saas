import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  BarChart3, ShoppingCart, Package, Users, TrendingUp, Zap,
  Globe, Shield, Monitor, ArrowRight, CheckCircle, Star,
  GitBranch, Layers, Receipt, Menu, X, ChevronRight, Sun, Moon,
} from 'lucide-react';
import { useTheme } from '@/theme/use-theme';

// ─── helpers ──────────────────────────────────────────────────────────────────

function useDark() { return useTheme().resolvedTheme === 'dark'; }

function useMouseTilt(strength = 14) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * strength}deg) rotateX(${-y * strength}deg) scale3d(1.03,1.03,1.03)`;
  }, [strength]);
  const onLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)';
  }, []);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); };
  }, [onMove, onLeave]);
  return ref;
}

function useCountUp(target: number, duration = 2200, start = false) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setV(Math.round((1 - Math.pow(1 - p, 4)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, start]);
  return v;
}

// ─── POS CANVAS ───────────────────────────────────────────────────────────────

const PRODUCTS = ['iPhone 15 Case', 'USB-C Hub', 'AirPods Pro', 'Laptop Stand', 'HDMI Cable', 'Phone Mount', 'Smart Watch', 'Keyboard'];
const BRANCHES = ['Main Branch', 'East Mall', 'West Plaza', 'North Hub'];
const CASHIERS = ['Alex M.', 'Sara K.', 'Omar B.', 'Lena T.'];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

interface Sprite {
  type: 'receipt' | 'salecard' | 'creditcard' | 'productbox' | 'barcode' | 'scanbeam';
  x: number; y: number; vx: number; vy: number;
  rot: number; vr: number;
  scale: number;
  life: number; maxLife: number;
  data: Record<string, unknown>;
}

function makeSprite(W: number, H: number): Sprite {
  const types: Sprite['type'][] = ['receipt', 'salecard', 'creditcard', 'productbox', 'barcode', 'scanbeam'];
  const weights =                  [3,          4,           3,            3,            2,          2];
  let r = Math.random() * weights.reduce((a, b) => a + b, 0), type = types[0];
  for (let i = 0; i < types.length; i++) { r -= weights[i]; if (r <= 0) { type = types[i]; break; } }

  const side = Math.random() < 0.6 ? 'bottom' : (Math.random() < 0.5 ? 'left' : 'right');
  let x = rand(60, W - 60), y = H + 60, vx = rand(-0.3, 0.3), vy = rand(-0.5, -1.2);
  if (side === 'left') { x = -60; y = rand(H * 0.2, H * 0.85); vx = rand(0.4, 0.9); vy = rand(-0.4, 0.4); }
  if (side === 'right') { x = W + 60; y = rand(H * 0.2, H * 0.85); vx = rand(-0.9, -0.4); vy = rand(-0.4, 0.4); }

  return {
    type, x, y, vx, vy,
    rot: rand(-0.3, 0.3), vr: rand(-0.003, 0.003),
    scale: rand(0.7, 1.05),
    life: 0,
    maxLife: rand(280, 420),
    data: {
      amount: rand(12, 380).toFixed(2),
      product: randItem(PRODUCTS),
      branch: randItem(BRANCHES),
      cashier: randItem(CASHIERS),
      items: Math.floor(rand(1, 7)),
      color: ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981'][Math.floor(Math.random() * 4)],
    },
  };
}

// ── individual draw functions ─────────────────────────────────────────────────

function drawReceipt(ctx: CanvasRenderingContext2D, s: Sprite, dark: boolean) {
  const w = 62, h = 90;
  const { amount, items, product } = s.data as { amount: string; items: number; product: string };
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.rot);
  ctx.scale(s.scale, s.scale);

  const alpha = Math.min(1, s.life / 40) * Math.min(1, (s.maxLife - s.life) / 40);
  ctx.globalAlpha = alpha * (dark ? 0.88 : 0.92);

  // Shadow
  ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(99,102,241,0.25)';

  // Body
  ctx.fillStyle = dark ? 'rgba(13,19,33,0.96)' : 'rgba(255,255,255,0.97)';
  ctx.beginPath(); roundRect(ctx, -w / 2, -h / 2, w, h, 5); ctx.fill();

  // Top accent strip
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#6366f1';
  ctx.beginPath(); roundRect(ctx, -w / 2, -h / 2, w, 14, [5, 5, 0, 0]); ctx.fill();

  // Store name in header
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 7px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('NEZHIN POS', 0, -h / 2 + 10);

  // Items
  ctx.textAlign = 'left';
  for (let i = 0; i < Math.min(Number(items), 4); i++) {
    const iy = -h / 2 + 24 + i * 13;
    ctx.fillStyle = dark ? 'rgba(148,163,184,0.7)' : 'rgba(71,85,105,0.7)';
    ctx.font = '6px system-ui';
    ctx.fillText(i === 0 ? String(product).slice(0, 10) : randItem(PRODUCTS).slice(0, 10), -w / 2 + 6, iy);
    ctx.textAlign = 'right';
    ctx.fillText(`$${rand(5, 80).toFixed(2)}`, w / 2 - 5, iy);
    ctx.textAlign = 'left';
  }

  // Divider
  ctx.strokeStyle = dark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.2)';
  ctx.setLineDash([3, 3]); ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-w / 2 + 5, h / 2 - 26); ctx.lineTo(w / 2 - 5, h / 2 - 26); ctx.stroke();
  ctx.setLineDash([]);

  // Total
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.9)';
  ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'left';
  ctx.fillText('TOTAL', -w / 2 + 6, h / 2 - 14);
  ctx.textAlign = 'right';
  ctx.fillText(`$${amount}`, w / 2 - 5, h / 2 - 14);

  // PAID stamp
  ctx.strokeStyle = 'rgba(34,197,94,0.85)'; ctx.lineWidth = 1.5;
  ctx.font = 'bold 8px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(34,197,94,0.85)';
  ctx.fillText('✓ PAID', 0, h / 2 - 4);

  ctx.restore();
}

function drawSaleCard(ctx: CanvasRenderingContext2D, s: Sprite, dark: boolean) {
  const w = 130, h = 52;
  const { amount, product, branch } = s.data as { amount: string; product: string; branch: string };
  ctx.save();
  ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.scale(s.scale, s.scale);
  const alpha = Math.min(1, s.life / 40) * Math.min(1, (s.maxLife - s.life) / 40);
  ctx.globalAlpha = alpha * (dark ? 0.9 : 0.95);

  ctx.shadowBlur = 24; ctx.shadowColor = 'rgba(99,102,241,0.3)';
  ctx.fillStyle = dark ? 'rgba(13,19,33,0.96)' : 'rgba(255,255,255,0.98)';
  ctx.beginPath(); roundRect(ctx, -w / 2, -h / 2, w, h, 10); ctx.fill();

  // Left accent
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#6366f1';
  ctx.beginPath(); roundRect(ctx, -w / 2, -h / 2, 4, h, [10, 0, 0, 10]); ctx.fill();

  // Live dot (animated via pulsing alpha — we use a simple bright dot)
  ctx.fillStyle = '#22c55e';
  ctx.beginPath(); ctx.arc(w / 2 - 10, -h / 2 + 10, 3.5, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = 'rgba(99,102,241,0.7)'; ctx.font = 'bold 7px system-ui'; ctx.textAlign = 'left';
  ctx.fillText('NEW SALE', -w / 2 + 12, -h / 2 + 14);

  ctx.fillStyle = dark ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.95)';
  ctx.font = 'bold 15px system-ui';
  ctx.fillText(`$${amount}`, -w / 2 + 12, 3);

  ctx.fillStyle = dark ? 'rgba(148,163,184,0.65)' : 'rgba(100,116,139,0.7)';
  ctx.font = '7px system-ui';
  ctx.fillText(`${String(product).slice(0, 16)} · ${branch}`, -w / 2 + 12, h / 2 - 9);

  ctx.restore();
}

function drawCreditCard(ctx: CanvasRenderingContext2D, s: Sprite, _dark: boolean) {
  const w = 86, h = 54;
  ctx.save();
  ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.scale(s.scale, s.scale);
  const alpha = Math.min(1, s.life / 40) * Math.min(1, (s.maxLife - s.life) / 40);
  ctx.globalAlpha = alpha * 0.88;

  ctx.shadowBlur = 20; ctx.shadowColor = 'rgba(99,102,241,0.4)';
  const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  grad.addColorStop(0, '#4f46e5'); grad.addColorStop(1, '#7c3aed');
  ctx.fillStyle = grad;
  ctx.beginPath(); roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();

  // Chip body
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); roundRect(ctx, -w / 2 + 10, -h / 2 + 11, 18, 13, 2); ctx.fill();
  ctx.strokeStyle = '#d97706'; ctx.lineWidth = 0.6;
  for (let i = 1; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + 10, -h / 2 + 11 + i * 4.3); ctx.lineTo(-w / 2 + 28, -h / 2 + 11 + i * 4.3); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-w / 2 + 19, -h / 2 + 11); ctx.lineTo(-w / 2 + 19, -h / 2 + 24); ctx.stroke();

  // Card number dots
  for (let g = 0; g < 4; g++) for (let d = 0; d < 4; d++) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(-w / 2 + 11 + g * 18 + d * 4, h / 2 - 13, 1.3, 0, Math.PI * 2); ctx.fill();
  }

  // Contactless waves
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.2;
  for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(w / 2 - 13, 0, i * 5, -0.85, 0.85); ctx.stroke(); }

  // Visa-like text
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'bold 8px serif'; ctx.textAlign = 'right';
  ctx.fillText('VISA', w / 2 - 6, h / 2 - 6);

  ctx.restore();
}

function drawProductBox(ctx: CanvasRenderingContext2D, s: Sprite, _dark: boolean) {
  const sz = 38;
  const { color } = s.data as { color: string };
  ctx.save();
  ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.scale(s.scale, s.scale);
  const alpha = Math.min(1, s.life / 40) * Math.min(1, (s.maxLife - s.life) / 40);
  ctx.globalAlpha = alpha * 0.85;
  ctx.shadowBlur = 16; ctx.shadowColor = color + '55';

  // Parse color for faces
  const toRgb = (hex: string) => { const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16); return [r, g, b]; };
  const [cr, cg, cb] = toRgb(color);
  const top = `rgba(${cr + 40},${cg + 40},${cb + 40},0.9)`;
  const left = `rgba(${cr},${cg},${cb},0.9)`;
  const right = `rgba(${Math.max(0, cr - 40)},${Math.max(0, cg - 40)},${Math.max(0, cb - 40)},0.9)`;

  const h2 = sz * 0.5, hh = sz * 0.25;

  // Top face
  ctx.fillStyle = top;
  ctx.beginPath(); ctx.moveTo(0, -h2); ctx.lineTo(sz * 0.866, -hh); ctx.lineTo(0, 0); ctx.lineTo(-sz * 0.866, -hh); ctx.closePath(); ctx.fill();
  // Left face
  ctx.fillStyle = left;
  ctx.beginPath(); ctx.moveTo(-sz * 0.866, -hh); ctx.lineTo(0, 0); ctx.lineTo(0, h2); ctx.lineTo(-sz * 0.866, hh); ctx.closePath(); ctx.fill();
  // Right face
  ctx.fillStyle = right;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sz * 0.866, -hh); ctx.lineTo(sz * 0.866, hh); ctx.lineTo(0, h2); ctx.closePath(); ctx.fill();

  // Tape strips
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();

  ctx.restore();
}

function drawBarcode(ctx: CanvasRenderingContext2D, s: Sprite, dark: boolean) {
  const w = 54, h = 68;
  const { amount } = s.data as { amount: string };
  ctx.save();
  ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.scale(s.scale, s.scale);
  const alpha = Math.min(1, s.life / 40) * Math.min(1, (s.maxLife - s.life) / 40);
  ctx.globalAlpha = alpha * (dark ? 0.85 : 0.9);

  ctx.shadowBlur = 14; ctx.shadowColor = 'rgba(99,102,241,0.2)';
  ctx.fillStyle = dark ? 'rgba(13,19,33,0.95)' : 'rgba(255,255,255,0.96)';
  ctx.beginPath(); roundRect(ctx, -w / 2, -h / 2, w, h, 4); ctx.fill();
  ctx.shadowBlur = 0;

  // Price tag hole
  ctx.fillStyle = dark ? 'rgba(5,7,15,0.8)' : 'rgba(226,232,240,0.9)';
  ctx.beginPath(); ctx.arc(0, -h / 2 + 7, 4, 0, Math.PI * 2); ctx.fill();

  // Price
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.9)';
  ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(`$${amount}`, 0, -h / 2 + 24);

  // Barcode lines
  const barsX = -w / 2 + 5, barsW = w - 10, barsY = -h / 2 + 30, barsH = h - 46;
  ctx.fillStyle = dark ? 'rgba(226,232,240,0.85)' : 'rgba(15,23,42,0.85)';
  let bx = barsX;
  // deterministic-ish pattern based on amount
  const seed = parseFloat(amount) * 7;
  let st = seed;
  while (bx < barsX + barsW - 1) {
    st = (st * 1.6180339 + 2.7182818) % 5;
    const thick = st < 1.5 ? 2.2 : 1;
    ctx.fillRect(bx, barsY, thick, barsH);
    bx += thick + (st < 2.5 ? 2 : 1.2);
  }

  // Barcode number
  ctx.fillStyle = dark ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.6)';
  ctx.font = '5px monospace'; ctx.textAlign = 'center';
  ctx.fillText('6 32145 00001', 0, h / 2 - 5);

  ctx.restore();
}

function drawScanBeam(ctx: CanvasRenderingContext2D, s: Sprite, dark: boolean) {
  // A product being scanned: box + laser beam
  const w = 70, h = 50;
  ctx.save();
  ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.scale(s.scale, s.scale);
  const alpha = Math.min(1, s.life / 40) * Math.min(1, (s.maxLife - s.life) / 40);
  ctx.globalAlpha = alpha * 0.8;

  ctx.shadowBlur = 16; ctx.shadowColor = 'rgba(239,68,68,0.4)';
  ctx.fillStyle = dark ? 'rgba(13,19,33,0.92)' : 'rgba(255,255,255,0.94)';
  ctx.beginPath(); roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
  ctx.shadowBlur = 0;

  // Scanner bracket corners
  const bx = -w / 2 + 8, by = -h / 2 + 8, bw = w - 16, bh = h - 16, cl = 10;
  ctx.strokeStyle = dark ? 'rgba(99,102,241,0.7)' : 'rgba(99,102,241,0.8)'; ctx.lineWidth = 1.5;
  // TL
  ctx.beginPath(); ctx.moveTo(bx, by + cl); ctx.lineTo(bx, by); ctx.lineTo(bx + cl, by); ctx.stroke();
  // TR
  ctx.beginPath(); ctx.moveTo(bx + bw - cl, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cl); ctx.stroke();
  // BL
  ctx.beginPath(); ctx.moveTo(bx, by + bh - cl); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cl, by + bh); ctx.stroke();
  // BR
  ctx.beginPath(); ctx.moveTo(bx + bw - cl, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cl); ctx.stroke();

  // Laser beam (animated position by life)
  const beamY = by + ((s.life % 60) / 60) * bh;
  const beamGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  beamGrad.addColorStop(0, 'rgba(239,68,68,0)'); beamGrad.addColorStop(0.5, 'rgba(239,68,68,0.9)'); beamGrad.addColorStop(1, 'rgba(239,68,68,0)');
  ctx.fillStyle = beamGrad; ctx.fillRect(bx, beamY - 1, bw, 2);

  // Glow around beam
  ctx.fillStyle = 'rgba(239,68,68,0.12)'; ctx.fillRect(bx, beamY - 5, bw, 10);

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br); ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl); ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

// ── Main POS Canvas ───────────────────────────────────────────────────────────
function POSCanvas({ dark }: { dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf: number, W = 0, H = 0;

    function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    const sprites: Sprite[] = [];
    let spawnTimer = 0;

    // Grid dots background pattern
    function drawGrid() {
      const step = 42;
      for (let gx = 0; gx < W; gx += step) {
        for (let gy = 0; gy < H; gy += step) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fillStyle = dark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.07)';
          ctx.fill();
        }
      }
    }

    // Flowing connection lines (POS network topology)
    const flowLines: { x1: number; y1: number; x2: number; y2: number; t: number; speed: number; color: string }[] = [];
    const lineColors = dark
      ? ['rgba(99,102,241,0.35)', 'rgba(139,92,246,0.3)', 'rgba(6,182,212,0.28)']
      : ['rgba(99,102,241,0.18)', 'rgba(139,92,246,0.15)', 'rgba(6,182,212,0.14)'];
    for (let i = 0; i < 12; i++) {
      flowLines.push({
        x1: rand(0, W), y1: rand(0, H),
        x2: rand(0, W), y2: rand(0, H),
        t: rand(0, 1), speed: rand(0.001, 0.003),
        color: lineColors[i % lineColors.length],
      });
    }

    function drawFlowLines() {
      for (const fl of flowLines) {
        fl.t += fl.speed;
        if (fl.t > 1.2) { fl.t = -0.2; fl.x1 = rand(0, W); fl.y1 = rand(0, H); fl.x2 = rand(0, W); fl.y2 = rand(0, H); }
        const t = Math.max(0, Math.min(1, fl.t));
        // Draw the line dimly
        ctx.strokeStyle = fl.color.replace(/[\d.]+\)$/, '0.15)');
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(fl.x1, fl.y1); ctx.lineTo(fl.x2, fl.y2); ctx.stroke();
        // Moving dot along line
        const dotX = fl.x1 + (fl.x2 - fl.x1) * t;
        const dotY = fl.y1 + (fl.y2 - fl.y1) * t;
        const glow = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 8);
        glow.addColorStop(0, fl.color); glow.addColorStop(1, fl.color.replace(/[\d.]+\)$/, '0)'));
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(dotX, dotY, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = fl.color.replace(/[\d.]+\)$/, '0.9)');
        ctx.beginPath(); ctx.arc(dotX, dotY, 2, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawSprite(s: Sprite) {
      if (s.type === 'receipt') drawReceipt(ctx, s, dark);
      else if (s.type === 'salecard') drawSaleCard(ctx, s, dark);
      else if (s.type === 'creditcard') drawCreditCard(ctx, s, dark);
      else if (s.type === 'productbox') drawProductBox(ctx, s, dark);
      else if (s.type === 'barcode') drawBarcode(ctx, s, dark);
      else if (s.type === 'scanbeam') drawScanBeam(ctx, s, dark);
    }

    function frame() {
      ctx.clearRect(0, 0, W, H);
      drawGrid();
      drawFlowLines();

      // Spawn
      spawnTimer++;
      if (spawnTimer > 55 && sprites.length < 12) { sprites.push(makeSprite(W, H)); spawnTimer = 0; }
      if (spawnTimer > 30 && sprites.length < 6) { sprites.push(makeSprite(W, H)); spawnTimer = 0; }

      // Update & draw sprites
      for (let i = sprites.length - 1; i >= 0; i--) {
        const s = sprites[i];
        s.x += s.vx; s.y += s.vy; s.rot += s.vr; s.life++;
        // Gentle drift
        s.vx += rand(-0.005, 0.005);
        s.vx = Math.max(-1.2, Math.min(1.2, s.vx));
        if (s.life >= s.maxLife || s.y < -150 || s.x < -200 || s.x > W + 200) {
          sprites.splice(i, 1);
        } else {
          drawSprite(s);
        }
      }

      raf = requestAnimationFrame(frame);
    }
    frame();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [dark]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ─── ISO bar chart (stats section) ───────────────────────────────────────────
function IsoBarChart({ dark, triggered }: { dark: boolean; triggered: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progress = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf: number, W = 0, H = 0;

    function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    const bars = [
      { label: 'Sales', value: 0.82, color: '#6366f1' },
      { label: 'Stock', value: 0.65, color: '#8b5cf6' },
      { label: 'Orders', value: 0.90, color: '#06b6d4' },
      { label: 'Revenue', value: 0.75, color: '#10b981' },
      { label: 'Returns', value: 0.35, color: '#f59e0b' },
      { label: 'Cashiers', value: 0.58, color: '#ec4899' },
    ];

    function frame() {
      ctx.clearRect(0, 0, W, H);
      if (triggered) progress.current = Math.min(1, progress.current + 0.018);

      const cx = W / 2, cy = H * 0.62;
      const barW = Math.min(50, W / (bars.length + 2));
      const gap = barW * 1.6;
      const maxH = H * 0.52;

      // Iso base grid
      ctx.strokeStyle = dark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)';
      ctx.lineWidth = 0.8;
      const gridRows = 5;
      for (let gi = 0; gi <= gridRows; gi++) {
        const gy = cy - (gi / gridRows) * maxH;
        ctx.beginPath(); ctx.moveTo(cx - bars.length * gap / 2 - barW, gy); ctx.lineTo(cx + bars.length * gap / 2, gy); ctx.stroke();
      }

      bars.forEach((bar, i) => {
        const ease = 1 - Math.pow(1 - Math.min(progress.current, 1), 3);
        const actualH = bar.value * maxH * ease;
        const bx = cx - (bars.length / 2 - i) * gap + gap / 2;
        const by = cy;

        const hex = bar.color;
        const toRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
        const [r, g, b] = toRgb(hex);

        // Front face gradient
        const gf = ctx.createLinearGradient(bx - barW / 2, by - actualH, bx + barW / 2, by);
        gf.addColorStop(0, `rgba(${r + 30},${g + 30},${b + 30},0.9)`);
        gf.addColorStop(1, `rgba(${r},${g},${b},0.75)`);
        ctx.fillStyle = gf;
        ctx.fillRect(bx - barW / 2, by - actualH, barW, actualH);

        // Top face (parallelogram)
        const tw = barW * 0.35, th = barW * 0.18;
        ctx.fillStyle = `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)},0.9)`;
        ctx.beginPath();
        ctx.moveTo(bx - barW / 2, by - actualH);
        ctx.lineTo(bx - barW / 2 + tw, by - actualH - th);
        ctx.lineTo(bx + barW / 2 + tw, by - actualH - th);
        ctx.lineTo(bx + barW / 2, by - actualH);
        ctx.closePath(); ctx.fill();

        // Right side face
        ctx.fillStyle = `rgba(${Math.max(0, r - 50)},${Math.max(0, g - 50)},${Math.max(0, b - 50)},0.85)`;
        ctx.beginPath();
        ctx.moveTo(bx + barW / 2, by - actualH);
        ctx.lineTo(bx + barW / 2 + tw, by - actualH - th);
        ctx.lineTo(bx + barW / 2 + tw, by - th);
        ctx.lineTo(bx + barW / 2, by);
        ctx.closePath(); ctx.fill();

        // Glow on top
        ctx.shadowBlur = 12; ctx.shadowColor = hex + '88';
        ctx.fillStyle = `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)},0.9)`;
        ctx.beginPath();
        ctx.moveTo(bx - barW / 2, by - actualH);
        ctx.lineTo(bx - barW / 2 + tw, by - actualH - th);
        ctx.lineTo(bx + barW / 2 + tw, by - actualH - th);
        ctx.lineTo(bx + barW / 2, by - actualH);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = dark ? 'rgba(148,163,184,0.7)' : 'rgba(100,116,139,0.7)';
        ctx.font = `bold ${Math.min(10, barW * 0.22)}px system-ui`; ctx.textAlign = 'center';
        ctx.fillText(bar.label, bx + tw / 2, by + 14);

        // Value label on top
        if (progress.current > 0.5) {
          ctx.fillStyle = dark ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.8)';
          ctx.font = `bold ${Math.min(9, barW * 0.2)}px system-ui`;
          ctx.fillText(`${Math.round(bar.value * 100)}%`, bx + tw / 2, by - actualH - th - 5);
        }
      });

      raf = requestAnimationFrame(frame);
    }
    frame();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [dark, triggered]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

// ─── CSS 3-D dashboard mockup ─────────────────────────────────────────────────
function DashboardMockup({ dark }: { dark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let raf: number;
    let rx = -4, ry = 10;
    const tgt = { rx: -4, ry: 10 };
    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      tgt.ry = (e.clientX - cx) / cx * 12 + 8;
      tgt.rx = -(e.clientY - cy) / cy * 6 - 3;
    };
    window.addEventListener('mousemove', onMove);
    const loop = () => {
      rx += (tgt.rx - rx) * 0.05; ry += (tgt.ry - ry) * 0.05;
      if (el) el.style.transform = `perspective(1400px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('mousemove', onMove); };
  }, []);

  const bg = dark ? 'bg-[#0d1120]' : 'bg-white';
  const sf = dark ? 'bg-[#161e34]' : 'bg-canvas';
  const bd = dark ? 'border-primary-500/30' : 'border-primary-200';

  return (
    <div ref={ref} className="w-full max-w-[560px] mx-auto" style={{ transformStyle: 'preserve-3d' }}>
      <div className="absolute -inset-10 bg-primary-500/12 blur-3xl rounded-full pointer-events-none" />
      <div className={`relative rounded-2xl overflow-hidden border ${bd} shadow-[0_40px_100px_rgba(99,102,241,0.28)]`}>
        {/* Title bar */}
        <div className={`${dark ? 'bg-[#0a0e1a]' : 'bg-canvas-raised'} px-4 py-3 flex items-center gap-2 border-b ${bd}`}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-400" /><div className="w-3 h-3 rounded-full bg-amber-400" /><div className="w-3 h-3 rounded-full bg-emerald-400" />
          </div>
          <div className={`flex-1 mx-3 ${dark ? 'bg-white/6' : 'bg-white'} rounded-md h-5 flex items-center px-2 border ${bd}`}>
            <span className={`text-[9px] font-mono ${dark ? 'text-white/25' : 'text-ink-faint'}`}>app.nezhin.io/dashboard</span>
          </div>
        </div>
        {/* App */}
        <div className={`${bg} flex`} style={{ minHeight: 280 }}>
          {/* Sidebar */}
          <div className={`w-14 ${dark ? 'bg-[#0a0e1a]' : 'bg-slate-900'} flex flex-col items-center py-3 gap-2`}>
            <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-white" />
            </div>
            {[ShoppingCart, Package, Users, TrendingUp, Globe].map((Icon, i) => (
              <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center ${i === 0 ? 'bg-primary-500/20' : ''}`}>
                <Icon className={`w-3.5 h-3.5 ${i === 0 ? 'text-primary-400' : 'text-white/25'}`} />
              </div>
            ))}
          </div>
          {/* Main */}
          <div className="flex-1 p-3 space-y-2.5 overflow-hidden">
            <div className="grid grid-cols-3 gap-2">
              {[{ label: 'Revenue', val: '$12,840', color: 'text-emerald-400', sub: '↑ 18%' }, { label: 'Orders', val: '284', color: 'text-primary-400', sub: '↑ 12%' }, { label: 'Low stock', val: '12', color: 'text-orange-400', sub: '↓ 3' }].map((s, i) => (
                <div key={i} className={`${sf} rounded-xl p-2.5 border ${bd}`}>
                  <div className={`text-[9px] font-medium ${dark ? 'text-white/35' : 'text-ink-faint'} mb-1`}>{s.label}</div>
                  <div className={`font-black text-sm ${s.color}`}>{s.val}</div>
                  <div className={`text-[8px] mt-0.5 ${s.color}`}>{s.sub}</div>
                </div>
              ))}
            </div>
            <div className={`${sf} rounded-xl p-2.5 border ${bd}`}>
              <div className={`text-[9px] font-semibold ${dark ? 'text-white/50' : 'text-ink-muted'} mb-2`}>Revenue · last 12 weeks</div>
              <div className="flex items-end gap-1 h-14">
                {[35, 52, 41, 68, 49, 82, 60, 75, 55, 88, 70, 95].map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm overflow-hidden" style={{ height: `${h}%` }}>
                    <div className="h-full bg-gradient-to-t from-primary-500 to-purple-400 opacity-75" />
                  </div>
                ))}
              </div>
            </div>
            <div className={`${sf} rounded-xl border ${bd} overflow-hidden`}>
              <div className={`px-2.5 py-1.5 border-b ${bd} grid grid-cols-4 gap-1`}>
                {['Product', 'Branch', 'Qty', 'Status'].map(h => <div key={h} className={`text-[8px] font-black uppercase ${dark ? 'text-white/25' : 'text-ink-faint'}`}>{h}</div>)}
              </div>
              {[['iPhone Case', 'Main', '248', 'emerald'], ['AirPods Pro', 'East', '12', 'orange'], ['USB-C Hub', 'West', '89', 'emerald']].map(([p, b, q, c], i) => (
                <div key={i} className={`px-2.5 py-1.5 grid grid-cols-4 gap-1 items-center ${i < 2 ? `border-b ${bd}` : ''}`}>
                  <div className={`text-[8px] ${dark ? 'text-white/60' : 'text-ink-muted'} truncate`}>{p}</div>
                  <div className={`text-[8px] ${dark ? 'text-white/40' : 'text-ink-faint'}`}>{b}</div>
                  <div className={`text-[8px] font-black ${c === 'emerald' ? 'text-emerald-400' : 'text-orange-400'}`}>{q}</div>
                  <div className={`w-1.5 h-1.5 rounded-full ${c === 'emerald' ? 'bg-emerald-400' : 'bg-orange-400'}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
        className={`absolute -top-5 -right-6 ${dark ? 'bg-white/10' : 'bg-white'} backdrop-blur-lg border ${dark ? 'border-white/15' : 'border-line'} rounded-2xl px-3.5 py-2 flex items-center gap-2.5 shadow-xl`}>
        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-emerald-500" /></div>
        <div><div className={`text-xs font-black ${dark ? 'text-white' : 'text-ink'}`}>+24% revenue</div><div className={`text-[10px] ${dark ? 'text-white/40' : 'text-ink-faint'}`}>vs last month</div></div>
      </motion.div>
      <motion.div animate={{ y: [0, 9, 0] }} transition={{ repeat: Infinity, duration: 3.8, ease: 'easeInOut', delay: 0.9 }}
        className={`absolute -bottom-5 -left-6 ${dark ? 'bg-white/10' : 'bg-white'} backdrop-blur-lg border ${dark ? 'border-white/15' : 'border-line'} rounded-2xl px-3.5 py-2 flex items-center gap-2.5 shadow-xl`}>
        <div className="w-8 h-8 rounded-xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center"><ShoppingCart className="w-4 h-4 text-primary-500" /></div>
        <div><div className={`text-xs font-black ${dark ? 'text-white' : 'text-ink'}`}>New sale — $149</div><div className={`text-[10px] ${dark ? 'text-white/40' : 'text-ink-faint'}`}>East branch · just now</div></div>
      </motion.div>
    </div>
  );
}

// ─── feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, description, gradient, delay, dark }:
  { icon: React.ElementType; title: string; description: string; gradient: string; delay: number; dark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.21, 0.45, 0.15, 1] }}
    >
      <motion.div
        whileHover={{ y: -8, scale: 1.025 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className={`group h-full p-7 rounded-3xl border cursor-default relative overflow-hidden
          ${dark
            ? 'bg-white/[0.03] border-white/8 hover:border-primary-500/40 hover:bg-white/[0.06]'
            : 'bg-white border-line hover:border-primary-300 shadow-sm hover:shadow-2xl hover:shadow-primary-500/10'
          }`}
        style={{ transition: 'background-color 0.25s, border-color 0.25s, box-shadow 0.25s' }}
      >
        {/* Glow that appears on hover */}
        <div className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none
          ${dark ? 'bg-gradient-to-br from-primary-500/8 to-transparent' : 'bg-gradient-to-br from-primary-50 to-transparent'}`} />

        <div className={`w-14 h-14 rounded-2xl ${gradient} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300 relative`}>
          <Icon className="w-7 h-7 text-white" />
          <div className={`absolute -bottom-1 left-1 right-1 h-3 rounded-xl ${gradient} opacity-40 blur-sm`} />
        </div>
        <h3 className={`font-black text-xl mb-3 ${dark ? 'text-white' : 'text-ink'}`}>{title}</h3>
        <p className={`text-sm leading-relaxed ${dark ? 'text-white/45' : 'text-ink-muted'}`}>{description}</p>
      </motion.div>
    </motion.div>
  );
}

// ─── stat item ────────────────────────────────────────────────────────────────
function StatItem({ value, suffix, label, dark }: { value: number; suffix: string; label: string; dark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const count = useCountUp(value, 2200, inView);
  return (
    <div ref={ref} className="text-center min-w-0">
      <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight bg-gradient-to-br from-primary-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tabular-nums whitespace-nowrap">
        {count.toLocaleString()}{suffix}
      </div>
      <div className={`text-sm mt-3 font-medium ${dark ? 'text-white/40' : 'text-ink-muted'}`}>{label}</div>
    </div>
  );
}

// ─── plan card ────────────────────────────────────────────────────────────────
const PLANS = [
  { name: 'Starter', price: '$29', period: '/mo', desc: 'Perfect for solo stores', features: ['1 branch', '5 users', 'POS & inventory', 'Basic reports'], cta: 'Start free trial', highlight: false },
  { name: 'Business', price: '$79', period: '/mo', desc: 'For growing retail chains', features: ['5 branches', '20 users', 'Advanced analytics', 'Supplier management', 'Priority support'], cta: 'Start free trial', highlight: true },
  { name: 'Enterprise', price: 'Custom', period: '', desc: 'For large organizations', features: ['Unlimited branches', 'Unlimited users', 'Dedicated SLA', 'Custom integrations', 'Onboarding support'], cta: 'Contact sales', highlight: false },
];
type PlanDef = typeof PLANS[number];

function PlanCard({ plan, index, inView, dark }: { plan: PlanDef; index: number; inView: boolean; dark: boolean }) {
  const tilt = useMouseTilt(8);
  return (
    <motion.div initial={{ opacity: 0, y: 50 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: index * 0.12 }}>
      {/* 3D depth stack layers */}
      <div className="relative">
        {!plan.highlight && (<>
          <div className={`absolute inset-0 rounded-3xl translate-x-2 translate-y-2 ${dark ? 'bg-primary-500/5' : 'bg-primary-100/60'}`} />
          <div className={`absolute inset-0 rounded-3xl translate-x-1 translate-y-1 ${dark ? 'bg-primary-500/8' : 'bg-primary-50'}`} />
        </>)}
        <div ref={tilt}
          className={`relative h-full flex flex-col p-8 rounded-3xl border transition-all duration-300 ${plan.highlight
            ? 'bg-gradient-to-b from-primary-500/14 to-primary-700/8 border-primary-500/55 shadow-2xl shadow-primary-500/20'
            : dark ? 'bg-white/[0.03] border-white/10 hover:border-white/22' : 'bg-white border-line hover:border-primary-200 shadow-sm hover:shadow-xl'}`}
          style={{ transformStyle: 'preserve-3d', transition: 'transform 0.15s ease, border-color 0.3s, box-shadow 0.4s' }}>
          {plan.highlight && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary-500 to-primary-700 text-white text-xs font-black px-5 py-1.5 rounded-full shadow-lg shadow-primary-500/40">Most popular</div>}
          <div className={`font-black text-2xl ${dark ? 'text-white' : 'text-ink'}`}>{plan.name}</div>
          <div className={`text-sm mt-1 mb-6 ${dark ? 'text-white/35' : 'text-ink-muted'}`}>{plan.desc}</div>
          <div className="mb-7 flex items-end gap-1">
            <span className={`text-5xl font-black ${dark ? 'text-white' : 'text-ink'}`}>{plan.price}</span>
            <span className={`text-sm mb-2 ${dark ? 'text-white/35' : 'text-ink-faint'}`}>{plan.period}</span>
          </div>
          <ul className="space-y-3.5 flex-1">
            {plan.features.map(f => (
              <li key={f} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${plan.highlight ? 'bg-primary-500/20 border border-primary-500/40' : dark ? 'bg-white/8 border border-white/15' : 'bg-primary-50 border border-primary-100'}`}>
                  <CheckCircle className="w-3 h-3 text-primary-400" />
                </div>
                <span className={`text-sm ${dark ? 'text-white/55' : 'text-ink-muted'}`}>{f}</span>
              </li>
            ))}
          </ul>
          <Link to="/get-started" className={`mt-8 block text-center font-black py-3.5 rounded-2xl text-sm transition-all duration-200 hover:-translate-y-0.5 ${plan.highlight ? 'bg-gradient-to-r from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 text-white shadow-xl shadow-primary-500/30' : dark ? 'bg-white/8 hover:bg-white/14 text-white border border-white/12' : 'bg-canvas-raised hover:bg-primary-50 text-ink border border-line'}`}>{plan.cta}</Link>
        </div>
      </div>
    </motion.div>
  );
}

// ─── navbar ───────────────────────────────────────────────────────────────────
const NAV_LINKS = [{ label: 'Features', href: '#features' }, { label: 'Preview', href: '#preview' }, { label: 'Pricing', href: '#pricing' }];

function Navbar() {
  const dark = useDark(); const { toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const handleLogin = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => navigate('/login', { state: { fromLanding: true } }), 550);
  }, [leaving, navigate]);

  const handleGetStarted = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => navigate('/get-started', { state: { fromLanding: true } }), 550);
  }, [leaving, navigate]);

  return (
    <>
      {/* ── page-transition curtain ── */}
      <AnimatePresence>
        {leaving && (
          <motion.div
            key="curtain"
            className="fixed inset-0 z-[9999]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' }}
          />
        )}
      </AnimatePresence>

      <motion.nav
        initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }}
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? dark ? 'bg-canvas/90 backdrop-blur-2xl border-b border-white/6 shadow-xl shadow-black/30' : 'bg-white/92 backdrop-blur-2xl border-b border-line/80 shadow-lg' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30 group-hover:scale-110 transition-transform">
              <BarChart3 style={{ width: 18, height: 18 }} className="text-white" />
            </div>
            <span className={`font-black text-lg tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>Nezhin <span className="text-primary-500">POS</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(l => <a key={l.label} href={l.href} className={`text-sm font-medium transition-colors ${dark ? 'text-white/55 hover:text-white' : 'text-ink-muted hover:text-ink'}`}>{l.label}</a>)}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button onClick={toggleTheme} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${dark ? 'bg-white/8 hover:bg-white/15 text-white/60 hover:text-white' : 'bg-canvas-raised hover:bg-canvas-raised text-ink-muted hover:text-ink'}`}>
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <motion.button
              onClick={handleLogin}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${dark ? 'text-white/70 hover:text-white hover:bg-white/8' : 'text-ink-muted hover:text-ink hover:bg-canvas-raised'}`}
            >
              Login
            </motion.button>
            <motion.button onClick={handleGetStarted} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="bg-gradient-to-r from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 text-white text-sm font-black px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-primary-500/30">Get started</motion.button>
          </div>
          <div className="md:hidden flex items-center gap-2">
            <button onClick={toggleTheme} className={`w-9 h-9 rounded-xl flex items-center justify-center ${dark ? 'bg-white/8 text-white/60' : 'bg-canvas-raised text-ink-muted'}`}>{dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
            <button onClick={() => setOpen(v => !v)} className={`p-1 ${dark ? 'text-white/70' : 'text-ink-muted'}`}>{open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
          </div>
        </div>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className={`md:hidden overflow-hidden border-t ${dark ? 'bg-canvas/96 backdrop-blur-2xl border-white/6' : 'bg-white/96 backdrop-blur-2xl border-line'}`}>
              <div className="px-6 py-5 flex flex-col gap-4">
                {NAV_LINKS.map(l => <a key={l.label} href={l.href} onClick={() => setOpen(false)} className={`text-sm font-medium ${dark ? 'text-white/65' : 'text-ink-muted'}`}>{l.label}</a>)}
                <button onClick={() => { setOpen(false); handleLogin(); }} className={`text-sm font-medium text-left ${dark ? 'text-white/65' : 'text-ink-muted'}`}>Login</button>
                <button onClick={() => { setOpen(false); handleGetStarted(); }} className="bg-gradient-to-r from-primary-500 to-primary-700 text-white text-sm font-black px-4 py-3 rounded-xl text-center">Get started free</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </>
  );
}

// ─── hero ─────────────────────────────────────────────────────────────────────
function HeroSection() {
  const dark = useDark();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 90]);
  const opacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);
  return (
    <section className={`relative min-h-screen flex items-center overflow-hidden ${dark ? 'bg-canvas' : 'bg-canvas'}`}>
      <div className={`absolute inset-0 pointer-events-none ${dark ? 'bg-[radial-gradient(ellipse_80%_60%_at_20%_50%,rgba(99,102,241,0.1),transparent),radial-gradient(ellipse_50%_50%_at_80%_20%,rgba(139,92,246,0.08),transparent)]' : 'bg-[radial-gradient(ellipse_80%_60%_at_20%_50%,rgba(99,102,241,0.05),transparent),radial-gradient(ellipse_50%_50%_at_80%_20%,rgba(139,92,246,0.04),transparent)]'}`} />
      <div className="absolute inset-0 pointer-events-none"><POSCanvas dark={dark} /></div>
      <motion.div style={{ y, opacity }} className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-24 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/25 rounded-full px-4 py-2 text-primary-500 text-xs font-bold mb-8 backdrop-blur-sm">
            <Zap className="w-3.5 h-3.5" /> AI-powered inventory predictions <span className="bg-primary-500 text-white text-[9px] px-2 py-0.5 rounded-full">NEW</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
            className={`text-5xl md:text-6xl xl:text-7xl font-black leading-[1.06] tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>
            Run your store.<br /><span className="bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">Grow faster.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
            className={`mt-6 text-lg leading-relaxed max-w-lg ${dark ? 'text-white/50' : 'text-ink-muted'}`}>
            Nezhin POS brings sales, stock, reports, and team management into one blazing-fast platform — built for modern retail.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="mt-10 flex flex-wrap gap-4">
            <Link to="/get-started" className="group flex items-center gap-2.5 bg-gradient-to-r from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 text-white font-black px-7 py-4 rounded-2xl transition-all duration-300 shadow-xl shadow-primary-500/35 hover:shadow-primary-500/55 hover:-translate-y-1">
              Start free trial <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#preview" className={`flex items-center gap-2.5 font-semibold px-7 py-4 rounded-2xl transition-all duration-300 hover:-translate-y-1 ${dark ? 'bg-white/6 hover:bg-white/12 border border-white/10 text-white' : 'bg-white hover:bg-canvas border border-line hover:border-primary-200 text-ink shadow-sm hover:shadow-md'}`}>See it in action</a>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="mt-12 flex items-center gap-8">
            <div className="flex -space-x-2.5">
              {['from-primary-400 to-primary-600', 'from-purple-400 to-purple-600', 'from-pink-400 to-pink-600', 'from-cyan-400 to-cyan-600', 'from-emerald-400 to-emerald-600'].map((g, i) => (
                <div key={i} className={`w-9 h-9 rounded-full bg-gradient-to-br ${g} border-2 ${dark ? 'border-[#05070f]' : 'border-canvas'} flex items-center justify-center text-white text-xs font-black`}>{String.fromCharCode(65 + i)}</div>
              ))}
            </div>
            <div>
              <div className={`text-sm font-bold ${dark ? 'text-white' : 'text-ink'}`}>2,400+ businesses</div>
              <div className="flex items-center gap-1 mt-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                <span className={`text-xs ml-1 ${dark ? 'text-white/35' : 'text-ink-faint'}`}>4.9/5</span>
              </div>
            </div>
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.9, delay: 0.25, ease: [0.21, 0.45, 0.15, 1] }} className="relative hidden lg:block">
          <DashboardMockup dark={dark} />
        </motion.div>
      </motion.div>
      <motion.div animate={{ y: [0, 12, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        <div className={`w-px h-10 bg-gradient-to-b ${dark ? 'from-white/0 via-white/25 to-white/0' : 'from-line/0 via-line-strong/50 to-line/0'}`} />
        <span className={`text-[10px] font-semibold tracking-widest uppercase ${dark ? 'text-white/25' : 'text-ink-faint'}`}>Scroll</span>
      </motion.div>
    </section>
  );
}

// ─── logos ────────────────────────────────────────────────────────────────────
function LogosSection() {
  const dark = useDark();
  return (
    <section className={`border-y py-12 ${dark ? 'bg-canvas border-white/5' : 'bg-white border-line'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <p className={`text-center text-[11px] font-black uppercase tracking-widest mb-8 ${dark ? 'text-white/20' : 'text-ink-faint'}`}>Trusted by retail businesses worldwide</p>
        <div className="flex flex-wrap gap-x-12 gap-y-3 justify-center">
          {['Fashion Hub', 'ElectroCity', 'MegaMart', 'FreshGo', 'TechZone', 'StyleStore'].map(l => (
            <span key={l} className={`font-black text-sm tracking-wide cursor-default transition-colors ${dark ? 'text-white/12 hover:text-white/30' : 'text-ink-faint hover:text-ink-muted'}`}>{l}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: ShoppingCart, title: 'Point of Sale', description: 'Lightning-fast checkout with barcode scanning, split payments, discounts, and receipt printing.', gradient: 'bg-gradient-to-br from-primary-500 to-primary-700' },
  { icon: Package, title: 'Smart Inventory', description: 'Real-time stock tracking across all branches with low-stock alerts and automated reorder points.', gradient: 'bg-gradient-to-br from-primary-600 to-primary-800' },
  { icon: BarChart3, title: 'Analytics & Reports', description: 'Beautiful dashboards with revenue trends, top products, cashier performance, and branch comparisons.', gradient: 'bg-gradient-to-br from-sky-500 to-sky-700' },
  { icon: GitBranch, title: 'Multi-Branch', description: 'Manage unlimited locations from one account. Transfer stock, compare performance, and set branch pricing.', gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-700' },
  { icon: Users, title: 'Team Management', description: 'Role-based access for owners, admins, and cashiers. Track shifts, log activity, and audit every change.', gradient: 'bg-gradient-to-br from-orange-500 to-orange-700' },
  { icon: Monitor, title: 'Works Offline', description: 'Keep selling without internet. All data syncs automatically the moment connectivity is restored.', gradient: 'bg-gradient-to-br from-rose-500 to-rose-700' },
];

function FeaturesSection() {
  const dark = useDark();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <section id="features" className={`py-32 relative overflow-hidden ${dark ? 'bg-canvas' : 'bg-canvas'}`}>
      {dark && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_0%,rgba(99,102,241,0.08),transparent_55%)]" />}
      <div className="max-w-7xl mx-auto px-6">
        <motion.div ref={ref} initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }} className="text-center mb-20">
          <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 rounded-full px-4 py-2 text-primary-500 text-[11px] font-black uppercase tracking-widest mb-5"><Layers className="w-3.5 h-3.5" /> Everything you need</div>
          <h2 className={`text-4xl md:text-5xl font-black tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>Built for real retail</h2>
          <p className={`mt-5 text-lg max-w-xl mx-auto ${dark ? 'text-white/40' : 'text-ink-muted'}`}>Every feature designed around how physical stores actually work.</p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => <FeatureCard key={f.title} {...f} delay={i * 0.08} dark={dark} />)}
        </div>
      </div>
    </section>
  );
}

// ─── preview ──────────────────────────────────────────────────────────────────
function PreviewSection() {
  const dark = useDark();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const tilt = useMouseTilt(5);
  return (
    <section id="preview" className={`py-32 relative overflow-hidden ${dark ? 'bg-canvas' : 'bg-white'}`}>
      {dark && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(139,92,246,0.07),transparent_55%)]" />}
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
        <motion.div ref={ref} initial={{ opacity: 0, x: -50 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.8, ease: [0.21, 0.45, 0.15, 1] }}>
          <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 rounded-full px-4 py-2 text-primary-500 text-[11px] font-black uppercase tracking-widest mb-7"><Receipt className="w-3.5 h-3.5" /> Live product tour</div>
          <h2 className={`text-4xl md:text-5xl font-black tracking-tight leading-tight ${dark ? 'text-white' : 'text-ink'}`}>See your whole business at a glance</h2>
          <p className={`mt-6 text-lg leading-relaxed ${dark ? 'text-white/40' : 'text-ink-muted'}`}>One dashboard gives you real-time revenue, low-stock alerts, pending orders, and cashier activity — all without switching tabs.</p>
          <ul className="mt-10 space-y-4">
            {['Real-time sales and revenue metrics', 'Inventory levels across all branches', 'Cashier shift tracking and audit log', 'Supplier orders and purchase history'].map(item => (
              <li key={item} className="flex items-center gap-4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${dark ? 'bg-primary-500/12 border border-primary-500/25' : 'bg-primary-50 border border-primary-100'}`}><CheckCircle className="w-3.5 h-3.5 text-primary-500" /></div>
                <span className={`text-sm font-medium ${dark ? 'text-white/60' : 'text-ink-muted'}`}>{item}</span>
              </li>
            ))}
          </ul>
          <Link to="/get-started" className="group inline-flex items-center gap-2 mt-10 text-primary-500 hover:text-primary-400 font-black transition-colors">Get started today <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></Link>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 50 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.8, delay: 0.15, ease: [0.21, 0.45, 0.15, 1] }}>
          <div ref={tilt} className="grid grid-cols-2 gap-5" style={{ transformStyle: 'preserve-3d', transition: 'transform 0.15s ease' }}>
            {[
              { icon: TrendingUp, label: 'Revenue trend', value: '+18.4%', cc: 'text-emerald-500', bg: dark ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100' },
              { icon: Package, label: 'Low stock items', value: '12', cc: 'text-orange-500', bg: dark ? 'bg-orange-500/8 border-orange-500/20' : 'bg-orange-50 border-orange-100' },
              { icon: Users, label: 'Active cashiers', value: '7', cc: 'text-sky-500', bg: dark ? 'bg-sky-500/8 border-sky-500/20' : 'bg-sky-50 border-sky-100' },
              { icon: Globe, label: 'Branches online', value: '4 / 4', cc: 'text-primary-500', bg: dark ? 'bg-primary-500/8 border-primary-500/20' : 'bg-primary-50 border-primary-100' },
            ].map((card, i) => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 25 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                className={`border rounded-3xl p-6 flex flex-col gap-4 ${card.bg} relative overflow-hidden`}>
                {/* 3D depth accent */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 ${card.bg.split(' ')[0].replace('/8', '/20').replace('bg-', 'bg-')}`} />
                <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${card.bg}`}><card.icon className={`w-5 h-5 ${card.cc}`} /></div>
                <div><div className={`text-3xl font-black ${card.cc}`}>{card.value}</div><div className={`text-xs font-medium mt-1 ${dark ? 'text-white/30' : 'text-ink-faint'}`}>{card.label}</div></div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── stats ────────────────────────────────────────────────────────────────────
function StatsSection() {
  const dark = useDark();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <section className={`py-28 relative overflow-hidden ${dark ? 'bg-canvas' : 'bg-canvas'}`}>
      <div className={`absolute inset-0 ${dark ? 'opacity-20' : 'opacity-40'}`}
        style={{ backgroundImage: `radial-gradient(${dark ? '#6366f1' : '#c7d2fe'} 1px, transparent 1px)`, backgroundSize: '30px 30px' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-500/5 to-transparent" />

      {/* 3D isometric bar chart — kept behind stats with explicit z-index */}
      <div className="absolute inset-0 opacity-40 pointer-events-none z-0">
        <IsoBarChart dark={dark} triggered={inView} />
      </div>

      <div ref={ref} className="relative z-10 max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10 sm:gap-12">
        <StatItem value={2400} suffix="+" label="Active businesses" dark={dark} />
        <StatItem value={1200000} suffix="+" label="Transactions processed" dark={dark} />
        <StatItem value={18} suffix="" label="Countries" dark={dark} />
        <StatItem value={99.9} suffix="%" label="Uptime SLA" dark={dark} />
      </div>
    </section>
  );
}

// ─── pricing ──────────────────────────────────────────────────────────────────
function PricingSection() {
  const dark = useDark();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <section id="pricing" className={`py-32 relative overflow-hidden ${dark ? 'bg-canvas' : 'bg-white'}`}>
      {dark && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(99,102,241,0.08),transparent_55%)]" />}
      <div className="max-w-7xl mx-auto px-6">
        <motion.div ref={ref} initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 rounded-full px-4 py-2 text-primary-500 text-[11px] font-black uppercase tracking-widest mb-5"><Shield className="w-3.5 h-3.5" /> Simple pricing</div>
          <h2 className={`text-4xl md:text-5xl font-black tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>Plans that scale with you</h2>
          <p className={`mt-5 text-lg max-w-lg mx-auto ${dark ? 'text-white/40' : 'text-ink-muted'}`}>No hidden fees. No per-transaction charges. Start free, upgrade when you're ready.</p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {PLANS.map((plan, i) => <PlanCard key={plan.name} plan={plan} index={i} inView={inView} dark={dark} />)}
        </div>
      </div>
    </section>
  );
}

// ─── cta ──────────────────────────────────────────────────────────────────────
function CTASection() {
  const dark = useDark();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <section className={`py-32 relative overflow-hidden ${dark ? 'bg-canvas' : 'bg-canvas'}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-primary-700/10" />
      <div className={`absolute inset-0 ${dark ? 'opacity-12' : 'opacity-35'}`} style={{ backgroundImage: `radial-gradient(${dark ? '#6366f1' : '#a5b4fc'} 1px, transparent 1px)`, backgroundSize: '36px 36px' }} />
      <motion.div ref={ref} initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8 }} className="relative max-w-4xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 rounded-full px-4 py-2 text-primary-500 text-[11px] font-black uppercase tracking-widest mb-8"><Zap className="w-3.5 h-3.5" /> Start today</div>
        <h2 className={`text-5xl md:text-6xl font-black tracking-tight leading-tight ${dark ? 'text-white' : 'text-ink'}`}>Ready to modernize{' '}<span className="bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">your store?</span></h2>
        <p className={`mt-7 text-lg max-w-xl mx-auto ${dark ? 'text-white/40' : 'text-ink-muted'}`}>Join thousands of retailers using Nezhin POS to sell smarter, track every item, and grow faster.</p>
        <div className="mt-12 flex flex-wrap gap-5 justify-center">
          <Link to="/get-started" className="group flex items-center gap-2.5 bg-gradient-to-r from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 text-white font-black px-9 py-4 rounded-2xl transition-all duration-300 shadow-2xl shadow-primary-500/35 hover:shadow-primary-500/55 hover:-translate-y-1 text-base">
            Start your free trial <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link to="/saas/login" className={`flex items-center gap-2.5 font-semibold px-9 py-4 rounded-2xl transition-all duration-300 hover:-translate-y-1 text-base ${dark ? 'bg-white/6 hover:bg-white/12 border border-white/10 text-white' : 'bg-white hover:bg-canvas border border-line text-ink shadow-sm hover:shadow-md'}`}>Admin portal</Link>
        </div>
        <p className={`mt-8 text-sm ${dark ? 'text-white/20' : 'text-ink-faint'}`}>No credit card required · 14-day free trial · Cancel anytime</p>
      </motion.div>
    </section>
  );
}

// ─── footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const dark = useDark();
  return (
    <footer className={`border-t py-16 ${dark ? 'bg-canvas border-white/5' : 'bg-white border-line'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12">
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center"><BarChart3 className="w-4 h-4 text-white" /></div>
              <span className={`font-black text-base ${dark ? 'text-white' : 'text-ink'}`}>Nezhin POS</span>
            </div>
            <p className={`text-sm leading-relaxed ${dark ? 'text-white/28' : 'text-ink-faint'}`}>Modern point-of-sale and inventory management for growing retail businesses.</p>
          </div>
          {[
            { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'Pricing', href: '/pricing' }, { label: 'Download', href: '/download' }] },
            { title: 'Account', links: [{ label: 'Register', href: '/register' }, { label: 'Login', href: '/login' }, { label: 'Admin portal', href: '/saas/login' }] },
            { title: 'Legal', links: [{ label: 'Privacy Policy', href: '#' }, { label: 'Terms of Service', href: '#' }] },
          ].map(col => (
            <div key={col.title}>
              <h4 className={`text-[11px] font-black uppercase tracking-widest mb-5 ${dark ? 'text-white/30' : 'text-ink-faint'}`}>{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map(l => (
                  <li key={l.label}>{l.href.startsWith('#')
                    ? <a href={l.href} className={`text-sm transition-colors ${dark ? 'text-white/32 hover:text-white/65' : 'text-ink-faint hover:text-ink'}`}>{l.label}</a>
                    : <Link to={l.href} className={`text-sm transition-colors ${dark ? 'text-white/32 hover:text-white/65' : 'text-ink-faint hover:text-ink'}`}>{l.label}</Link>}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className={`mt-14 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 ${dark ? 'border-white/5' : 'border-line'}`}>
          <p className={`text-sm ${dark ? 'text-white/18' : 'text-ink-faint'}`}>© {new Date().getFullYear()} Nezhin POS. All rights reserved.</p>
          <p className={`text-sm ${dark ? 'text-white/18' : 'text-ink-faint'}`}>Built for modern retail.</p>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  const location = useLocation();
  const fromAuth = Boolean((location.state as { fromAuth?: boolean } | null)?.fromAuth);

  return (
    <div className="font-sans antialiased overflow-x-hidden">
      {fromAuth && (
        <motion.div
          className="fixed inset-0 z-[9999] pointer-events-none"
          style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' }}
          initial={{ x: 0 }}
          animate={{ x: '100%' }}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.76, 0, 0.24, 1] }}
        />
      )}
      <Navbar />
      <HeroSection />
      <LogosSection />
      <FeaturesSection />
      <PreviewSection />
      <StatsSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
}
