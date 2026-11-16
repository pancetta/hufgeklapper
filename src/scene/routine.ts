/**
 * The care course (#72) in the stable aisle, side view at the farm's pixel size: the box on the left, the tie ring,
 * the horse, the rider, the tap, the tack room and the way out to the arena on the right. The child taps a place or a
 * part of the horse; the scene says which (`onTap`), the Sim decides. Some steps then need a gesture here: brush
 * strokes over the horse, a tap on each hoof, a tap on each buckle. Halter, bridle and rope are drawn over the LPC
 * horse (our own pixels); the saddle is the LPC tack layer.
 */
import { horseSheet } from '../horses/compose';
import type { Look } from '../horses/look';
import { fitPixels } from '../pixel';
import type { Kid } from '../riders/look';
import type { Spot, StepId } from '../sim/routine';
import { shadow } from './draw';
import { drawKid } from './kids';

export type Gesture = 'brush' | 'hooves' | 'buckles';
export type RoutineOptions = { look: Look; kid: Kid; straps: number; onTap: (at: Spot) => void };

const HALTER = '#c0392b', LEATHER = '#5a3419', ROPE = '#d9c27a', METAL = '#cfd8dc';
/** Brushing: how far the finger must stroke over the right part, in logical pixels. */
const STROKES = 160;

export async function startRoutine(canvas: HTMLCanvasElement, o: RoutineOptions) {
  const [plain, saddled] = await Promise.all([horseSheet(o.look, 'idle'), horseSheet({ ...o.look, saddle: true, blanket: o.look.blanket ?? '#3d6fd9' }, 'idle')]);
  const ctx = canvas.getContext('2d')!;
  let W = 0, H = 0, S = 1, running = true, t = 0, done = new Set<StepId>();
  // the horse's side view (west), and where its head, neck and hooves are
  const frame = document.createElement('canvas');
  frame.width = frame.height = 128;
  const fctx = frame.getContext('2d', { willReadFrequently: true })!;
  fctx.drawImage(plain, 128, 0, 128, 128, 0, 0, 128, 128);
  const px = fctx.getImageData(0, 0, 128, 128).data;
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < 128 && y < 128 && px[(y * 128 + x) * 4 + 3] > 0;
  let x0 = 128, x1 = 0, top = 128, bottom = 0;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) if (opaque(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  const span = (x: number) => { let a = -1, b = -1; for (let y = 0; y < 128; y++) if (opaque(x, y)) { if (a < 0) a = y; b = y; } return [a, b] as const; };
  const w = x1 - x0, bodyX = x0 + Math.round(w * 0.6), back = span(bodyX)[0];
  // the belly's underside: where the body ends between the front and hind legs; below it are the legs
  let legs = back;
  while (legs < bottom && opaque(bodyX, legs + 1)) legs++;
  const belly = legs - Math.max(4, Math.round((legs - back) / 3));
  const muzzle = span(x0 + 2), headX = x0 + Math.round(w * 0.2), poll = span(headX)[0], neckX = x0 + Math.round(w * 0.32), neck = span(neckX);
  const hooves: { x: number; done: boolean }[] = [];
  for (let x = 0, start = -1; x <= 128; x++) {
    const on = x < 128 && [0, 1, 2].some((d) => opaque(x, bottom - d));
    if (on && start < 0) start = x;
    if (!on && start >= 0) { hooves.push({ x: (start + x - 1) / 2, done: false }); start = -1; }
  }
  const buckles = Array.from({ length: o.straps }, (_, i) => ({ x: x0 + 4 + Math.round(((headX - x0) * (i + 1)) / (o.straps + 1)), y: [muzzle[0] + 2, poll + 6, Math.round((muzzle[0] + poll) / 2) + 3][i % 3], done: false }));

  // places along the aisle, as shares of the width; the horse stands at the box, the ring or out on the arena
  const L = { foot: 0, box: 0, ring: 0, horse: 0, rider: 0, tap: 0, tack: 0, arena: 0 };
  const where = () => (done.has('toBox') ? 'box' : done.has('back') ? 'ring' : done.has('toArena') ? 'arena' : done.has('leadOut') ? 'ring' : 'box');
  const horseX = () => ({ box: L.box, ring: L.horse, arena: L.arena + 40 })[where()];
  const has = (on: StepId, off?: StepId) => done.has(on) && !(off && done.has(off));

  function fit() {
    // up to twice the farm's pixels (halter, bridle and buckles must show), as long as the aisle fits: about 300 wide
    S = Math.max(1, Math.min(fitPixels(innerWidth, innerHeight).scale * 2, Math.floor(innerWidth / 300), Math.floor(innerHeight / 200)));
    W = Math.floor(innerWidth / S); H = Math.floor(innerHeight / S);
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * S}px`; canvas.style.height = `${H * S}px`;
    L.foot = Math.round(H * 0.68);
    // left to right, as close as the horse's size allows; what is left over goes to the arena
    const ring = 84, horse = ring + 64 - x0 + 4, rider = horse - 64 + x1 + 14, tap = rider + 22, tack = tap + 36;
    Object.assign(L, { box: 34, ring, horse, rider, tap, tack, arena: Math.max(tack + 32, W - 40) });
    targets();
  }

  // gestures: what is being done with the finger now
  let gesture: { kind: Gesture; at: Spot; left: number; ok: (done: boolean) => void } | null = null;
  const hx = () => horseX() - 64, hy = () => L.foot - 1 - bottom;

  /** Where on the scene a point is: a part of the horse, or a place. */
  function spotAt(x: number, y: number): Spot | null {
    const shut = !done.has('open') || done.has('close');
    if (x < L.box + 44 && y > L.foot - 52 && y < L.foot + 10 && (shut || x > L.box + 34)) return 'box'; // the door (shut, in front of a horse inside, or swung open)
    const fx = Math.round(x - hx()), fy = Math.round(y - hy());
    if (where() !== 'arena' && [-3, 0, 3].some((d) => opaque(fx + d, fy) || opaque(fx, fy + d))) {
      if (fy > legs) return 'legs';
      if (fx > x0 + w * 0.88) return 'tail';
      if (fx < headX + 4) return 'head';
      if (fx < neckX + 6 && fy < belly) return 'neck';
      return fy > belly ? 'belly' : 'body';
    }
    if (Math.abs(x - L.ring) < 10 && Math.abs(y - (L.foot - 64)) < 12) return 'ring';
    if (Math.abs(x - L.rider) < 10 && y > L.foot - 32 && y < L.foot + 4) return 'rider';
    if (Math.abs(x - L.tap) < 10 && y > L.foot - 52 && y < L.foot - 24) return 'tap';
    if (x > L.tack - 22 && x < L.tack + 22 && y > L.foot - 70 && y < L.foot) return 'tack';
    if (x > L.arena - 10 && y < L.foot + 30) return 'arena';
    if (x < L.box + 38 && y < L.foot + 10) return 'box';
    return null;
  }

  /** For Playwright: where each place and part is on the screen, and the hooves or buckles a gesture waits for. */
  function targets() {
    const r = canvas.getBoundingClientRect(), at = (x: number, y: number) => `${Math.round(r.left + x * S)},${Math.round(r.top + y * S)}`;
    const X = hx(), Y = hy();
    canvas.dataset.spots = JSON.stringify({
      box: at(!done.has('open') || done.has('close') ? L.box + 26 : L.box + 38, L.foot - 20), ring: at(L.ring, L.foot - 64), rider: at(L.rider, L.foot - 14), tap: at(L.tap, L.foot - 38), tack: at(L.tack, L.foot - 36), arena: at(L.arena + 30, L.foot - 20),
      head: at(X + x0 + 6, Y + muzzle[0] + 3), neck: at(X + neckX, Y + Math.round((neck[0] + belly) / 2)), body: at(X + bodyX, Y + Math.round((back + belly) / 2)),
      belly: at(X + bodyX, Y + legs - 2), legs: at(X + hooves[0]?.x, Y + Math.round((legs + bottom) / 2) + 2), tail: at(X + x1 - 3, Y + Math.round((top + legs) / 2) + 6),
    });
    canvas.dataset.marks = !gesture || gesture.kind === 'brush' ? '' : (gesture.kind === 'hooves' ? hooves.filter((h) => !h.done).map((h) => at(X + h.x, L.foot + 1)) : buckles.filter((b) => !b.done).map((b) => at(X + b.x, Y + b.y))).join(' ');
  }

  /** A pixel line from a to b. */
  function line(color: string, ax: number, ay: number, bx: number, by: number) {
    ctx.fillStyle = color;
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(ax + ((bx - ax) * i) / n), Math.round(ay + ((by - ay) * i) / n), 1, 1);
  }

  function drawAisle() {
    ctx.imageSmoothingEnabled = false;
    // wall planks and the stone floor
    for (let x = 0; x < W; x += 12) { ctx.fillStyle = (x / 12) % 2 ? '#8a5530' : '#7f4d2b'; ctx.fillRect(x, 0, 12, L.foot - 6); ctx.fillStyle = '#5a3419'; ctx.fillRect(x, 0, 1, L.foot - 6); }
    ctx.fillStyle = '#9a9286'; ctx.fillRect(0, L.foot - 6, W, H);
    ctx.fillStyle = '#857d72';
    for (let y = L.foot - 6; y < H; y += 8) for (let x = (y / 8) % 2 ? 0 : 10; x < W; x += 20) ctx.fillRect(x, y, 1, 8), ctx.fillRect(x, y, 20, 1);
    // the box: bars above, a door below (swung open against the wall when open)
    const bx = L.box - 34;
    ctx.fillStyle = '#3b2412'; ctx.fillRect(bx, L.foot - 96, 68, 96);
    ctx.fillStyle = '#5a3419'; ctx.fillRect(bx, L.foot - 100, 72, 5); ctx.fillRect(bx + 67, L.foot - 100, 5, 100);
    ctx.fillStyle = '#c9a75a'; ctx.fillRect(bx, L.foot - 8, 68, 8); // straw
    // the tie ring on its plate
    ctx.fillStyle = '#4a4a5e'; ctx.fillRect(L.ring - 3, L.foot - 70, 6, 6);
    ctx.fillStyle = METAL; ctx.fillRect(L.ring - 4, L.foot - 64, 8, 1); ctx.fillRect(L.ring - 4, L.foot - 57, 8, 1); ctx.fillRect(L.ring - 5, L.foot - 63, 1, 6); ctx.fillRect(L.ring + 4, L.foot - 63, 1, 6);
    // the tap and its bucket
    ctx.fillStyle = METAL; ctx.fillRect(L.tap - 1, L.foot - 48, 3, 10); ctx.fillRect(L.tap - 1, L.foot - 40, 8, 3); ctx.fillStyle = '#c0392b'; ctx.fillRect(L.tap - 3, L.foot - 50, 7, 2);
    ctx.fillStyle = '#3d6fd9'; ctx.fillRect(L.tap - 2, L.foot - 12, 12, 11); ctx.fillStyle = '#2f4f9a'; ctx.fillRect(L.tap - 2, L.foot - 12, 12, 2);
    // the tack room door with a saddle on its sign
    ctx.fillStyle = '#5a3419'; ctx.fillRect(L.tack - 22, L.foot - 72, 44, 66);
    ctx.fillStyle = '#9b6a3c'; ctx.fillRect(L.tack - 19, L.foot - 69, 38, 63);
    ctx.fillStyle = '#efe6d0'; ctx.fillRect(L.tack - 12, L.foot - 64, 24, 12);
    ctx.fillStyle = LEATHER; ctx.fillRect(L.tack - 8, L.foot - 60, 16, 3); ctx.fillRect(L.tack - 9, L.foot - 61, 3, 2); ctx.fillRect(L.tack + 6, L.foot - 62, 3, 3); ctx.fillRect(L.tack - 1, L.foot - 57, 2, 4);
    ctx.fillStyle = '#e8c35a'; ctx.fillRect(L.tack + 12, L.foot - 38, 3, 3);
    // the way out to the arena: daylight and sand
    ctx.fillStyle = '#bfe3f5'; ctx.fillRect(L.arena, 0, W - L.arena, L.foot - 6);
    ctx.fillStyle = '#e3c88a'; ctx.fillRect(L.arena, L.foot - 6, W - L.arena, H);
    ctx.fillStyle = '#f5f0e0'; ctx.fillRect(L.arena + 6, L.foot - 30, W - L.arena, 3); ctx.fillRect(L.arena + 6, L.foot - 18, W - L.arena, 3);
    for (let x = L.arena + 10; x < W; x += 24) ctx.fillRect(x, L.foot - 34, 3, 30);
    ctx.fillStyle = '#5a3419'; ctx.fillRect(L.arena - 4, 0, 6, L.foot - 6);
  }

  /** The box front: bars above and the door below, in front of a horse inside; swung open against the wall when open. */
  function drawDoor() {
    const bx = L.box - 34;
    ctx.fillStyle = METAL; for (let x = bx + 4; x < bx + 68; x += 8) ctx.fillRect(x, L.foot - 96, 2, 44);
    if (!done.has('open') || done.has('close')) {
      ctx.fillStyle = '#9b6a3c'; ctx.fillRect(bx, L.foot - 52, 68, 52);
      ctx.fillStyle = '#7f4d2b'; for (let x = bx; x < bx + 68; x += 10) ctx.fillRect(x, L.foot - 52, 1, 52);
      ctx.fillStyle = '#5a3419'; ctx.fillRect(bx, L.foot - 52, 68, 3);
      ctx.fillStyle = '#2b2b3a'; ctx.fillRect(bx + 58, L.foot - 32, 6, 3); // the bolt
    } else { ctx.fillStyle = '#9b6a3c'; ctx.fillRect(bx + 68, L.foot - 52, 8, 52); ctx.fillStyle = '#7f4d2b'; ctx.fillRect(bx + 68, L.foot - 52, 1, 52); }
  }

  function drawHorse() {
    if (where() === 'arena') return;
    const X = hx(), Y = hy(), up = Math.sin(t * 1.8) > 0.6 ? 1 : 0;
    const sheet = has('saddleOn', 'saddleOff') ? saddled : plain;
    shadow(ctx, X + 64, L.foot - 1, 28, 3, 0.25);
    ctx.drawImage(sheet, 128, 0, 128, legs, X, Y - up, 128, legs);
    ctx.drawImage(sheet, 128, legs, 128, 128 - legs, X, Y + legs, 128, 128 - legs);
    const P = (x: number, y: number) => [X + x, Y + y - up] as const;
    const [mx, my] = P(x0 + 5, muzzle[0]), [px_, py] = P(headX, poll + 1), [chx, chy] = P(x0 + 7, muzzle[1] + 1);
    // the halter on the head: noseband, cheek strap up to the poll; or buckled round the neck
    const halterHead = has('halter', 'halterNeck') || has('halterOn', 'halterOff2'), halterNeck = has('halterNeck', 'halterOff') || has('halterNeck2', 'halterOn');
    if (halterHead) { line(HALTER, mx, my - 1, chx, chy); line(HALTER, mx + 1, my - 1, mx + 1, my - 1); line(HALTER, chx, chy, px_, py); line(HALTER, mx, my - 1, px_ - 2, py + 4); }
    const [nx, ny] = P(neckX, neck[0]);
    if (halterNeck) line(HALTER, nx, ny, nx - 3, Y + belly - 14);
    // the bridle: cheek pieces, noseband, brow band, the bit; reins over the neck
    const bridle = has('bridleOn', 'bridleOff');
    if (bridle) { line(LEATHER, mx + 2, my, mx + 2, chy - 1); line(LEATHER, mx + 2, my + 1, px_ + 1, py); line(LEATHER, px_ - 3, py + 2, px_ - 6, py + 6); ctx.fillStyle = METAL; ctx.fillRect(chx - 4, chy - 3, 2, 2); }
    if (has('reins', 'bridleOff')) line(LEATHER, bridle ? chx - 3 : nx - 4, bridle ? chy - 2 : ny + 8, ...P(x0 + w * 0.45, belly - 22));
    // the rope from the halter to the ring, or hanging from it while being led
    const tied = has('tie', 'untie') || has('tie2', 'untie2');
    if (tied) line(ROPE, halterNeck ? nx - 2 : chx, halterNeck ? ny + 10 : chy, L.ring, L.foot - 57);
    // hooves and buckles a gesture waits for
    if (gesture?.kind === 'hooves') for (const h of hooves) ring(X + h.x, L.foot + 2, h.done);
    if (gesture?.kind === 'buckles') for (const b of buckles) ring(X + b.x, Y + b.y - up, b.done);
  }
  function ring(x: number, y: number, ok: boolean) {
    ctx.fillStyle = ok ? '#3c9a3c' : `rgba(255, 255, 255, ${0.55 + 0.45 * Math.sin(t * 5)})`;
    x = Math.round(x); y = Math.round(y);
    ctx.fillRect(x - 3, y - 2, 7, 1); ctx.fillRect(x - 3, y + 2, 7, 1); ctx.fillRect(x - 4, y - 1, 1, 3); ctx.fillRect(x + 4, y - 1, 1, 3);
    if (ok) ctx.fillRect(x - 2, y, 5, 1);
  }

  function drawThings() {
    // the grooming kit on the floor by the ring while it is out
    if (!has('kit', 'kitAway')) return;
    const x = L.ring - 18;
    ctx.fillStyle = '#2f6b3a'; ctx.fillRect(x, L.foot - 8, 18, 8); ctx.fillStyle = '#43a047'; ctx.fillRect(x, L.foot - 8, 18, 2);
    ctx.fillStyle = '#e8c35a'; ctx.fillRect(x + 3, L.foot - 11, 4, 3); ctx.fillStyle = '#5a3419'; ctx.fillRect(x + 10, L.foot - 12, 5, 4);
  }

  function drawRider() {
    if (where() === 'arena' && !done.has('back')) return;
    const gear = { helmet: done.has('helmet'), vest: done.has('vest'), gloves: done.has('gloves') };
    drawKid(ctx, o.kid, L.rider, L.foot + 4, 'W', 0, gear);
    if (has('whip', 'whipAway')) line('#2a1d14', L.rider - 5, L.foot - 8, L.rider - 12, L.foot - 26);
  }

  const dust: { x: number; y: number; age: number }[] = [], sparkles: { x: number; y: number; age: number }[] = [];
  function drawBits() {
    for (const d of dust) { d.age += 1 / 60; if (d.age > 0.8) continue; ctx.fillStyle = `rgba(160, 130, 90, ${1 - d.age / 0.8})`; ctx.fillRect(Math.round(d.x), Math.round(d.y + d.age * 14), 1, 1); }
    for (const s of sparkles) {
      s.age += 1 / 60;
      if (s.age < 0 || s.age > 1.2) continue;
      ctx.fillStyle = `rgba(255, 250, 200, ${1 - s.age / 1.2})`;
      const y = Math.round(s.y - s.age * 12);
      ctx.fillRect(Math.round(s.x) - 1, y, 3, 1); ctx.fillRect(Math.round(s.x), y - 1, 1, 3);
    }
    while (dust.length > 200) dust.shift();
  }

  function frameDraw(now: number) {
    if (!running) return;
    t = now / 1000;
    drawAisle(); drawThings(); drawHorse(); drawDoor(); drawRider(); drawBits();
    requestAnimationFrame(frameDraw);
  }

  const finish = () => {
    const g = gesture!;
    gesture = null;
    for (let i = 0; i < 8; i++) sparkles.push({ x: horseX() - 30 + Math.random() * 60, y: L.foot - 70 + Math.random() * 50, age: -i * 0.08 });
    targets();
    g.ok(true);
  };
  // one finger (a second one or a palm doesn't take over), in logical pixels
  let finger: number | null = null, last: [number, number] | null = null;
  const at = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / S, (e.clientY - r.top) / S] as [number, number]; };
  const brushes = (want: Spot, on: Spot | null) => on === want || (want === 'body' && (on === 'belly' || on === 'neck'));
  canvas.addEventListener('pointerdown', (e) => {
    if (finger !== null) return;
    finger = e.pointerId; last = at(e);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer knows */ }
    const [x, y] = last;
    if (gesture?.kind === 'hooves' || gesture?.kind === 'buckles') {
      const X = hx(), Y = hy();
      const marks = gesture.kind === 'hooves' ? hooves.map((h) => ({ m: h, x: X + h.x, y: L.foot + 2 })) : buckles.map((b) => ({ m: b, x: X + b.x, y: Y + b.y }));
      const near = marks.filter((k) => !k.m.done).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      if (near && Math.hypot(near.x - x, near.y - y) < 8) { near.m.done = true; targets(); }
      if (marks.every((k) => k.m.done)) finish();
      return;
    }
    if (gesture?.kind === 'brush') return;
    const spot = spotAt(x, y);
    if (spot) o.onTap(spot);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== finger || !last) return;
    const p = at(e);
    if (gesture?.kind === 'brush' && brushes(gesture.at, spotAt(...p))) {
      gesture.left -= Math.hypot(p[0] - last[0], p[1] - last[1]);
      if (Math.random() < 0.5) dust.push({ x: p[0], y: p[1], age: 0 });
      if (gesture.left <= 0) finish();
    }
    last = p;
  });
  const up = (e: PointerEvent) => { if (e.pointerId === finger) { finger = null; last = null; } };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  fit();
  addEventListener('resize', fit);
  requestAnimationFrame(frameDraw);
  return {
    /** The steps done so far: where the horse is and what it wears. */
    set(steps: readonly StepId[]) { done = new Set(steps); targets(); },
    /** Waits for a gesture on a part of the horse: true once it is complete, false if it is called off. The finger already down counts. */
    gesture(kind: Gesture, spot: Spot) {
      gesture?.ok(false);
      return new Promise<boolean>((ok) => {
        (kind === 'hooves' ? hooves : buckles).forEach((m) => { m.done = false; });
        gesture = { kind, at: spot, left: STROKES, ok };
        targets();
      });
    },
    /** Another thing picked up: the gesture is off. */
    cancel() { gesture?.ok(false); gesture = null; targets(); },
    stop() { running = false; removeEventListener('resize', fit); },
  };
}
