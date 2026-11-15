/**
 * Caring for one horse, close up in its stall (three times the farm's pixel size). The care tools are gestures:
 * brush the dirt off the coat, tap each hoof, drag hay into the manger, swipe the manure away. When a gesture is
 * complete the scene calls onDone; the rules (what care fills) stay in the Sim.
 */
import { horseSheet } from '../horses/compose';
import type { Look } from '../horses/look';
import { fitPixels } from '../pixel';
import type { Care } from '../sim/state';
import { blit, image, shadow } from './draw';

export type CareOptions = { look: Look; dirt: number; onDone: (what: Care) => void }; // dirt: 0 clean … 1 very dirty

const MANGER_EMPTY = [424, 608, 78, 32] as const, MANGER_FULL = [424, 528, 78, 46] as const; // decorations.png
const HAY = [96, 704, 32, 32] as const;

function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

export async function startCare(canvas: HTMLCanvasElement, opts: CareOptions) {
  const [deco, sheet] = await Promise.all([image('farm/decorations.png'), horseSheet(opts.look, 'idle')]);
  const ctx = canvas.getContext('2d')!;
  let W = 0, H = 0, S = 1, running = true, tool: Care = 'groom', t = 0;
  const L = { cx: 0, foot: 0, mx: 0, my: 0 }; // horse centre and hooves; manger position

  // the side view (west) of the horse, its dirt layer, and where its hooves are
  const frame = document.createElement('canvas');
  frame.width = frame.height = 128;
  const fctx = frame.getContext('2d', { willReadFrequently: true })!;
  fctx.drawImage(sheet, 128, 0, 128, 128, 0, 0, 128, 128);
  const px = fctx.getImageData(0, 0, 128, 128).data;
  const opaque = (x: number, y: number) => px[(y * 128 + x) * 4 + 3] > 0;
  let bottom = 0;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) if (opaque(x, y)) bottom = y;
  const hooves: { x: number; done: boolean }[] = [];
  for (let x = 0, start = -1; x <= 128; x++) {
    const on = x < 128 && [0, 1, 2].some((d) => opaque(x, bottom - d));
    if (on && start < 0) start = x;
    if (!on && start >= 0) { hooves.push({ x: (start + x - 1) / 2, done: false }); start = -1; }
  }
  const dirt = document.createElement('canvas');
  dirt.width = dirt.height = 128;
  const dctx = dirt.getContext('2d', { willReadFrequently: true })!;
  const rnd = seeded(42);
  dctx.globalAlpha = 0.9;
  for (let i = 0; i < Math.round(opts.dirt * 140); i++) {
    dctx.fillStyle = ['#6b4a2b', '#7d5733', '#5a3d22'][i % 3];
    dctx.beginPath(); dctx.arc(20 + rnd() * 90, 30 + rnd() * 60, 0.8 + rnd() * 2.2, 0, 7); dctx.fill();
  }
  dctx.globalCompositeOperation = 'destination-in';
  dctx.drawImage(frame, 0, 0);
  const dirtLeft = () => { const d = dctx.getImageData(0, 0, 128, 128).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n; };
  const dirtStart = Math.max(1, dirtLeft());
  const manure = Array.from({ length: Math.max(1, Math.round(opts.dirt * 4)) }, () => ({ x: 0.15 + rnd() * 0.5, y: rnd(), gone: false }));
  const hay = { x: 0, y: 0, home: true, dragging: false, inManger: false };
  const done = new Set<Care>();
  const sparkles: { x: number; y: number; age: number }[] = [];
  const finish = (what: Care) => {
    if (done.has(what)) return;
    done.add(what);
    for (let i = 0; i < 8; i++) sparkles.push({ x: L.cx - 30 + Math.random() * 60, y: L.foot - 70 + Math.random() * 50, age: -i * 0.08 });
    opts.onDone(what);
  };

  function fit() {
    S = Math.min(2, fitPixels(innerWidth, innerHeight).scale) * 3;
    W = Math.floor(innerWidth / S); H = Math.floor(innerHeight / S);
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * S}px`; canvas.style.height = `${H * S}px`;
    L.foot = Math.round(H * 0.72); L.cx = Math.round(W * 0.36); L.mx = Math.round(W * 0.62); L.my = L.foot + 2;
    if (hay.home) { hay.x = 8; hay.y = 24; }
  }

  function frameDraw(now: number) {
    if (!running) return;
    t = now / 1000;
    ctx.imageSmoothingEnabled = false;
    for (let x = 0; x < W; x += 12) {
      ctx.fillStyle = (x / 12) % 2 ? '#8a5530' : '#7f4d2b'; ctx.fillRect(x, 0, 12, L.foot - 6);
      ctx.fillStyle = '#5a3419'; ctx.fillRect(x, 0, 1, L.foot - 6);
    }
    ctx.fillStyle = '#d9b75a'; ctx.fillRect(0, L.foot - 6, W, H);
    ctx.fillStyle = '#c49f45';
    for (let i = 0; i < 160; i++) ctx.fillRect((i * 37) % W, L.foot - 4 + ((i * 53) % (H - L.foot + 4)), 3, 1);
    // manure on the straw
    for (const m of manure) if (!m.gone) {
      const x = Math.round(L.cx - 50 + m.x * 60), y = Math.round(L.foot + 6 + m.y * Math.max(4, H - L.foot - 12));
      ctx.fillStyle = '#5a3d22'; ctx.fillRect(x - 3, y - 1, 7, 3); ctx.fillRect(x - 2, y - 3, 5, 2); ctx.fillStyle = '#7d5733'; ctx.fillRect(x - 1, y - 3, 2, 1);
    }
    blit(ctx, deco, hay.inManger ? MANGER_FULL : MANGER_EMPTY, L.mx, L.my - (hay.inManger ? 46 : 32));
    shadow(ctx, L.cx, L.foot - 1, 28, 3, 0.25);
    const hx = L.cx - 64, hy = L.foot - 1 - bottom;
    ctx.drawImage(frame, hx, hy);
    ctx.drawImage(dirt, hx, hy);
    // hoof rings to tap, while the hoof pick is out
    if (tool === 'hooves') for (const h of hooves) {
      ctx.fillStyle = h.done ? '#3c9a3c' : `rgba(255, 255, 255, ${0.55 + 0.45 * Math.sin(t * 5)})`;
      const x = Math.round(hx + h.x), y = L.foot + 3;
      ctx.fillRect(x - 3, y - 1, 7, 1); ctx.fillRect(x - 3, y + 1, 7, 1); ctx.fillRect(x - 4, y, 1, 1); ctx.fillRect(x + 4, y, 1, 1);
      if (h.done) ctx.fillRect(x - 2, y, 5, 1);
    }
    if (tool === 'feed' && !hay.inManger) blit(ctx, deco, HAY, Math.round(hay.x), Math.round(hay.y));
    for (const s of sparkles) {
      s.age += 1 / 60;
      if (s.age < 0 || s.age > 1.2) continue;
      ctx.fillStyle = `rgba(255, 250, 200, ${1 - s.age / 1.2})`;
      const y = Math.round(s.y - s.age * 12);
      ctx.fillRect(Math.round(s.x) - 1, y, 3, 1); ctx.fillRect(Math.round(s.x), y - 1, 1, 3);
    }
    requestAnimationFrame(frameDraw);
  }

  // gestures: one finger, in logical pixels
  let down = false;
  const at = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / S, (e.clientY - r.top) / S] as const; };
  function move(x: number, y: number) {
    if (tool === 'groom') {
      dctx.globalCompositeOperation = 'destination-out';
      dctx.beginPath(); dctx.arc(x - (L.cx - 64), y - (L.foot - 1 - bottom), 6, 0, 7); dctx.fill();
      if (dirtLeft() < dirtStart * 0.08) { dctx.clearRect(0, 0, 128, 128); finish('groom'); }
    }
    if (tool === 'muck') {
      for (const m of manure) {
        const mx = L.cx - 50 + m.x * 60, my = L.foot + 6 + m.y * Math.max(4, H - L.foot - 12);
        if (Math.hypot(mx - x, my - y) < 9) m.gone = true;
      }
      if (manure.every((m) => m.gone)) finish('muck');
    }
    if (tool === 'feed' && hay.dragging) { hay.x = x - 16; hay.y = y - 16; }
  }
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = at(e);
    down = true;
    canvas.setPointerCapture(e.pointerId);
    if (tool === 'hooves') {
      const hx = L.cx - 64;
      for (const h of hooves) if (Math.abs(hx + h.x - x) < 6 && Math.abs(L.foot + 1 - y) < 8) h.done = true;
      if (hooves.every((h) => h.done)) finish('hooves');
    }
    if (tool === 'feed' && !hay.inManger && x >= hay.x && x < hay.x + 32 && y >= hay.y && y < hay.y + 32) { hay.dragging = true; hay.home = false; }
    move(x, y);
  });
  canvas.addEventListener('pointermove', (e) => { if (down) move(...at(e)); });
  const up = () => {
    down = false;
    if (hay.dragging) {
      hay.dragging = false;
      if (hay.x + 16 > L.mx && hay.x + 16 < L.mx + 78 && hay.y + 16 > L.my - 50) { hay.inManger = true; finish('feed'); }
      else { hay.home = true; hay.x = 8; hay.y = 24; }
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  fit();
  addEventListener('resize', fit);
  requestAnimationFrame(frameDraw);
  return {
    setTool(what: Care) { tool = what; },
    /** Marks a care action done without its gesture (quick care). */
    skip(what: Care) {
      if (what === 'groom') dctx.clearRect(0, 0, 128, 128);
      if (what === 'hooves') hooves.forEach((h) => { h.done = true; });
      if (what === 'feed') hay.inManger = true;
      if (what === 'muck') manure.forEach((m) => { m.gone = true; });
      done.add(what);
    },
    /** Where things are, in CSS pixels, for tests and hints. */
    spots() {
      const css = (x: number, y: number) => ({ x: x * S, y: y * S });
      return {
        coat: css(L.cx, L.foot - 30), hooves: hooves.map((h) => css(L.cx - 64 + h.x, L.foot + 1)),
        hay: css(hay.x + 16, hay.y + 16), manger: css(L.mx + 39, L.my - 20),
        manure: manure.map((m) => css(L.cx - 50 + m.x * 60, L.foot + 6 + m.y * Math.max(4, H - L.foot - 12))),
      };
    },
    stop() { running = false; removeEventListener('resize', fit); },
  };
}
