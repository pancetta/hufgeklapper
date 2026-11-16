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

export type CareOptions = { look: Look; dirt: number; cared: Care[]; onDone: (what: Care) => void }; // dirt: 0 clean … 1 very dirty

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
  // a little life, as the LPC idle sheet has one still frame: breathing, a tail swish, blinking, and a happy hop with
  // hearts after each finished care. The tail is what lies behind the hind hoof; the eye is the glint the asset
  // script painted in (none on a very dark coat), closed with the coat colour around it.
  const tailX = Math.round(Math.max(...hooves.map((h) => h.x))) + 3, legs = bottom - 12; // below `legs` nothing moves
  let tailTop = legs, tailEnd = 0;
  for (let y = 0; y < legs; y++) for (let x = tailX; x < 128; x++) if (opaque(x, y)) { tailTop = Math.min(tailTop, y); tailEnd = y; }
  const lum = (i: number) => px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
  const lid: [number, number][] = [];
  let lidColor = '';
  for (let i = 0; i < px.length; i += 4) if (px[i] === 255 && px[i + 1] === 251 && px[i + 2] === 232) {
    const gx = (i / 4) % 128, gy = Math.floor(i / 4 / 128);
    let bright = -1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = ((gy + dy) * 128 + gx + dx) * 4;
      if (!dx && !dy || lum(j) < 110) lid.push([gx + dx, gy + dy]);
      else if (lum(j) > bright) { bright = lum(j); lidColor = `rgb(${px[j]}, ${px[j + 1]}, ${px[j + 2]})`; }
    }
    break;
  }
  const body = document.createElement('canvas');
  body.width = body.height = 128;
  const bctx = body.getContext('2d')!;
  let happyAt = -9;
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
  const done = new Set<Care>(opts.cared);
  const sparkles: { x: number; y: number; age: number }[] = [], hearts: { x: number; y: number; age: number }[] = [];
  const finish = (what: Care) => {
    if (done.has(what)) return;
    done.add(what);
    for (let i = 0; i < 8; i++) sparkles.push({ x: L.cx - 30 + Math.random() * 60, y: L.foot - 70 + Math.random() * 50, age: -i * 0.08 });
    cheer();
    opts.onDone(what);
  };
  /** The horse is happy: a little hop and hearts. */
  const cheer = () => { for (let i = 0; i < 3; i++) hearts.push({ x: L.cx - 40 + i * 6, y: L.foot - 80, age: -i * 0.25 }); happyAt = t; };

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
    // the pose: coat and dirt, eyes shut for a moment every few seconds; the body breathes and hops, the legs stay on
    // the straw (they hop along), the tail swishes now and then
    bctx.clearRect(0, 0, 128, 128); bctx.drawImage(frame, 0, 0); bctx.drawImage(dirt, 0, 0);
    if (lid.length && t % 3.7 < 0.14) { bctx.fillStyle = lidColor; for (const [x, y] of lid) bctx.fillRect(x, y, 1, 1); }
    const hop = t - happyAt < 0.5 ? Math.round(Math.sin((t - happyAt) / 0.5 * Math.PI) * 3) : 0;
    const up = hy - hop - (Math.sin(t * 1.8) > 0.6 ? 1 : 0);
    const swish = t % 4.3 < 0.9 ? Math.sin((t % 4.3) / 0.9 * Math.PI * 2) * 3 : 0;
    // one row more for the legs: it fills the gap when the body breathes up
    ctx.drawImage(body, 0, legs - 1, 128, 129 - legs, hx, hy - hop + legs - 1, 128, 129 - legs);
    if (!swish) ctx.drawImage(body, 0, 0, 128, legs, hx, up, 128, legs);
    else {
      ctx.drawImage(body, 0, 0, tailX, legs, hx, up, tailX, legs);
      for (let y = 0; y < legs; y++) {
        const dx = y > tailTop && y <= tailEnd ? Math.round(swish * ((y - tailTop) / Math.max(1, tailEnd - tailTop)) ** 1.5) : 0;
        ctx.drawImage(body, tailX, y, 128 - tailX, 1, hx + tailX + dx, up + y, 128 - tailX, 1);
      }
    }
    // hoof rings to tap, while the hoof pick is out
    if (tool === 'hooves') for (const h of hooves) {
      ctx.fillStyle = h.done ? '#3c9a3c' : `rgba(255, 255, 255, ${0.55 + 0.45 * Math.sin(t * 5)})`;
      const x = Math.round(hx + h.x), y = L.foot + 3;
      ctx.fillRect(x - 3, y - 1, 7, 1); ctx.fillRect(x - 3, y + 1, 7, 1); ctx.fillRect(x - 4, y, 1, 1); ctx.fillRect(x + 4, y, 1, 1);
      if (h.done) ctx.fillRect(x - 2, y, 5, 1);
    }
    if (tool === 'feed' && !hay.inManger) blit(ctx, deco, HAY, Math.round(hay.x), Math.round(hay.y));
    for (const h of hearts) {
      h.age += 1 / 60;
      if (h.age < 0 || h.age > 1.5) continue;
      const x = Math.round(h.x + Math.sin(h.age * 6) * 2), y = Math.round(h.y - h.age * 16);
      ctx.globalAlpha = 1 - h.age / 1.5; ctx.fillStyle = '#e8507a';
      ctx.fillRect(x, y, 2, 1); ctx.fillRect(x + 3, y, 2, 1); ctx.fillRect(x - 1, y + 1, 7, 2); ctx.fillRect(x, y + 3, 5, 1); ctx.fillRect(x + 1, y + 4, 3, 1); ctx.fillRect(x + 2, y + 5, 1, 1);
      ctx.globalAlpha = 1;
    }
    for (const s of sparkles) {
      s.age += 1 / 60;
      if (s.age < 0 || s.age > 1.2) continue;
      ctx.fillStyle = `rgba(255, 250, 200, ${1 - s.age / 1.2})`;
      const y = Math.round(s.y - s.age * 12);
      ctx.fillRect(Math.round(s.x) - 1, y, 3, 1); ctx.fillRect(Math.round(s.x), y - 1, 1, 3);
    }
    requestAnimationFrame(frameDraw);
  }

  // gestures: one finger (a second finger or a palm doesn't take over), in logical pixels
  let finger: number | null = null;
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
    if (finger !== null) return;
    const [x, y] = at(e);
    finger = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    if (tool === 'hooves' && Math.abs(L.foot + 1 - y) < 8) {
      // the nearest hoof only: neighbouring hooves are less than two rings apart
      const hx = L.cx - 64, near = hooves.reduce((a, b) => (Math.abs(hx + b.x - x) < Math.abs(hx + a.x - x) ? b : a));
      if (Math.abs(hx + near.x - x) < 6) near.done = true;
      if (hooves.every((h) => h.done)) finish('hooves');
    }
    if (tool === 'feed' && !hay.inManger && x >= hay.x && x < hay.x + 32 && y >= hay.y && y < hay.y + 32) { hay.dragging = true; hay.home = false; }
    move(x, y);
  });
  canvas.addEventListener('pointermove', (e) => { if (e.pointerId === finger) move(...at(e)); });
  const up = (e: PointerEvent) => {
    if (e.pointerId !== finger) return;
    finger = null;
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
      if (!done.has(what)) cheer();
      done.add(what);
    },
    stop() { running = false; removeEventListener('resize', fit); },
  };
}
