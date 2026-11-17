/**
 * The care course (#72) in the stable aisle, side view: the box on the left, the tie ring, the horse, the child, the
 * saddle rack, the tap, the tack room and the way out to the arena on the right, under the roof. Everything is sized
 * in metres from the horse's own height, so box, doors and child fit the horse. The child taps a place or a part of
 * the horse; the scene says which (`onTap`), the Sim decides. Some steps then need a gesture here: brush strokes over
 * the horse, a tap on each hoof, a tap on each buckle. Halter, bridle and rope are our own pixels over the LPC horse;
 * the saddle is the LPC tack layer.
 */
import { horseSheet } from '../horses/compose';
import type { Look } from '../horses/look';
import type { Kid } from '../riders/look';
import type { Spot, StepId } from '../sim/routine';
import { shadow } from './draw';
import { drawKid, type Gear } from './kids';

export type Gesture = 'brush' | 'hooves' | 'buckles';
export type RoutineOptions = { look: Look; kid: Kid; straps: number; onTap: (at: Spot) => void };

const HALTER = '#d0392b', LEATHER = '#a0623a', LEATHER_DARK = '#5a3419', ROPE = '#e3cf8a', METAL = '#cfd8dc', WOOD = '#9b6a3c', WOOD_DARK = '#7f4d2b';
/** Brushing: how far the finger must stroke over the right part, in metres of the horse. */
const STROKES = 5;

export async function startRoutine(canvas: HTMLCanvasElement, o: RoutineOptions) {
  const [plain, saddled] = await Promise.all([horseSheet(o.look, 'idle'), horseSheet({ ...o.look, saddle: true, blanket: o.look.blanket ?? '#3d6fd9' }, 'idle')]);
  const ctx = canvas.getContext('2d')!;
  let W = 0, H = 0, S = 1, running = true, t = 0, done = new Set<StepId>();
  // the horse's side view (west), and where its head, neck, belly and hooves are
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
  const belly = legs - Math.max(6, Math.round((legs - back) * 0.45));
  const muzzle = span(x0 + 2), headX = x0 + Math.round(w * 0.2), poll = span(headX)[0], neckX = x0 + Math.round(w * 0.32), neck = span(neckX);
  const hooves: { x: number; done: boolean }[] = [];
  for (let x = 0, start = -1; x <= 128; x++) {
    const on = x < 128 && [0, 1, 2].some((d) => opaque(x, bottom - d));
    if (on && start < 0) start = x;
    if (!on && start >= 0) { hooves.push({ x: (start + x - 1) / 2, done: false }); start = -1; }
  }
  // the bridle's buckles: at the noseband, the cheek and the throat
  const buckles = [[x0 + 5, muzzle[0] + 2], [headX - 1, poll + 4], [headX + 3, Math.round((poll + muzzle[1]) / 2) + 2]].slice(0, o.straps).map(([x, y]) => ({ x, y, done: false }));

  // metres to pixels: the horse is about 1.75 m (pony) or 2.15 m (horse) to the tip of its ears
  const M = (bottom - top) / (o.look.build === 'pony' ? 1.75 : 2.15), m = (v: number) => Math.round(v * M);
  // the child: drawn 1½ times so it is about 1.45 m (a small one 1.25 m) next to the horse
  const KID = 1.5;
  // places along the aisle, left to right (x in pixels; the horse's frame left edge where it stands)
  const L = { foot: 0, box: 0, boxW: m(3), ring: 0, ringY: m(1.4), horse: 0, rider: 0, rack: 0, tap: 0, tack: 0, arena: 0, beam: m(2.6) };
  const where = () => (done.has('toBox') ? 'box' : done.has('back') ? 'ring' : done.has('toArena') ? 'arena' : done.has('leadOut') ? 'ring' : 'box');
  const has = (on: StepId, off?: StepId) => done.has(on) && !(off && done.has(off));
  const hx = () => ({ box: L.box + Math.round((L.boxW - w) / 2) - x0, ring: L.horse, arena: L.arena - x1 + m(0.4) })[where()], hy = () => L.foot - 1 - bottom;

  function fit() {
    L.box = 4; L.ring = L.box + L.boxW + m(0.5); L.horse = L.ring + m(0.15) - x0;
    L.rider = L.horse + x1 + m(0.5); L.rack = L.rider + m(0.75); L.tap = L.rack + m(0.95); L.tack = L.tap + m(0.95);
    const need = L.tack + m(0.5) + m(0.4) + m(1.5);
    // as big as the aisle allows on the screen: its width, and the roof above the box over the bar of things below
    // in whole device pixels (crisp), not whole CSS pixels: on a 2× iPad steps of ½, so the aisle grows (#103)
    const d = devicePixelRatio || 1;
    S = Math.max(1, Math.min(Math.floor((innerWidth * d) / need), Math.floor(((innerHeight - 170) * d) / m(3.6)))) / d;
    W = Math.floor(innerWidth / S); H = Math.floor(innerHeight / S);
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * S}px`; canvas.style.height = `${H * S}px`;
    L.foot = Math.min(H - Math.round(95 / S) - m(0.3), Math.round(H * 0.74)); // above the two rows of things; the loft fills the top
    L.arena = Math.max(L.tack + m(0.5) + m(0.4), W - m(1.5));
    targets();
  }

  // gestures: what is being done with the finger now
  let gesture: { kind: Gesture; at: Spot; left: number; ok: (done: boolean) => void } | null = null;

  /** Where on the scene a point is: a part of the horse, or a place. */
  function spotAt(x: number, y: number): Spot | null {
    const shut = !done.has('open') || done.has('close'), boxR = L.box + L.boxW;
    if (x < boxR + 6 && y > L.foot - m(1.3) && y < L.foot + 10 && (shut || x > boxR - 2)) return 'box'; // the door (shut, in front of a horse inside, or swung open)
    const fx = Math.round(x - hx()), fy = Math.round(y - hy());
    if (where() !== 'arena' && [-3, 0, 3].some((d) => opaque(fx + d, fy) || opaque(fx, fy + d))) {
      if (fy > legs + 1) return 'legs';
      if (fx > x0 + w * 0.88) return 'tail';
      if (fx < headX + 4) return 'head';
      if (fx < neckX + 6 && fy < belly) return 'neck';
      return fy > belly ? 'belly' : 'body';
    }
    if (Math.abs(x - L.ring) < 10 && Math.abs(y - (L.foot - L.ringY)) < 12) return 'ring';
    if (Math.abs(x - L.rider) < 6 * KID + 2 && y > L.foot - 28 * KID && y < L.foot + 4) return 'rider';
    if (x > L.tap - 8 && x < L.tap + 14 && y > L.foot - m(1.3) && y < L.foot) return 'tap';
    if (x > L.tack - m(0.55) && x < L.tack + m(0.55) && y > L.foot - m(2.1) && y < L.foot) return 'tack';
    if (x > L.arena - 6 && y < L.foot + 30) return 'arena';
    if (x < boxR && y < L.foot + 10 && y > L.foot - m(2.4)) return 'box';
    return null;
  }

  /** For Playwright: where each place and part is on the screen, and the hooves or buckles a gesture waits for. */
  function targets() {
    const r = canvas.getBoundingClientRect(), at = (x: number, y: number) => `${Math.round(r.left + x * S)},${Math.round(r.top + y * S)}`;
    const X = hx(), Y = hy(), shut = !done.has('open') || done.has('close');
    canvas.dataset.spots = JSON.stringify({
      box: at(shut ? L.box + L.boxW - 12 : L.box + L.boxW + 3, L.foot - m(0.5)), ring: at(L.ring, L.foot - L.ringY), rider: at(L.rider, L.foot - 14 * KID), tap: at(L.tap, L.foot - m(0.6)),
      tack: at(L.tack, L.foot - m(1)), arena: at(Math.min(W - 6, L.arena + m(0.7)), L.foot - m(0.6)),
      head: at(X + x0 + 6, Y + muzzle[0] + 3), neck: at(X + neckX, Y + Math.round((neck[0] + belly) / 2)), body: at(X + bodyX, Y + Math.round((back + belly) / 2)),
      belly: at(X + bodyX, Y + Math.round((belly + legs) / 2) + 1), legs: at(X + hooves[0]?.x, Y + Math.round((legs + bottom) / 2) + 2), tail: at(X + x1 - 3, Y + Math.round((top + legs) / 2) + 6),
    });
    canvas.dataset.marks = !gesture || gesture.kind === 'brush' ? '' : (gesture.kind === 'hooves' ? hooves.filter((h) => !h.done).map((h) => at(X + h.x, L.foot + 1)) : buckles.filter((b) => !b.done).map((b) => at(X + b.x, Y + b.y))).join(' ');
  }

  /** A pixel line from a to b. */
  function line(color: string, ax: number, ay: number, bx: number, by: number) {
    ctx.fillStyle = color;
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(ax + ((bx - ax) * i) / n), Math.round(ay + ((by - ay) * i) / n), 1, 1);
  }
  const rect = (color: string, x: number, y: number, ww: number, hh: number) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh)); };

  /** Above the aisle: the hay loft on its beam, bales stacked under the roof trusses, a skylight and lamps. */
  function drawRoof() {
    const beam = L.foot - L.beam;
    rect('#4a2c17', 0, 0, W, beam);
    for (let x = 0; x < W; x += 16) rect('#3b2412', x, 0, 1, beam);
    for (let x = m(1.5); x < W; x += m(3.2)) { line('#6b4226', x, beam, x + m(1.6), 0); line('#6b4226', x + 1, beam, x + m(1.6) + 1, 0); line('#6b4226', x, beam, x - m(1.6), 0); }
    const sky = Math.round(W * 0.62), skyY = Math.max(2, beam - m(2.6));
    rect('#bfe3f5', sky, skyY, m(0.9), m(0.6)); rect('#3b2412', sky + Math.round(m(0.9) / 2), skyY, 1, m(0.6));
    // hay bales on the loft floor: stacks of different heights, a gap under the skylight
    const bw = m(0.9), bh = m(0.42), floor = beam - 6;
    let x = 2, n = 0;
    while (x + bw < W) {
      if (x + bw > sky - 4 && x < sky + m(0.9) + 4) { x = sky + m(0.9) + 6; continue; }
      const high = [3, 2, 4, 1, 3, 2][n++ % 6];
      for (let k = 0; k < high && floor - (k + 1) * bh > 4; k++) {
        const y = floor - (k + 1) * bh, off = k % 2 ? Math.round(bw / 2) : 0;
        if (x + off + bw > W) continue;
        rect('#d9b75a', x + off, y, bw - 1, bh - 1); rect('#c49f45', x + off, y + bh - 3, bw - 1, 2); rect('#e8cc7a', x + off + 1, y + 1, bw - 3, 1);
        rect('#8a6a2a', x + off + Math.round(bw / 3), y, 1, bh - 1); rect('#8a6a2a', x + off + Math.round((2 * bw) / 3), y, 1, bh - 1); // the strings
      }
      x += bw * (high > 2 ? 2 : 1) + m(0.3);
    }
    rect('#6b4226', 0, beam - 6, W, 6); rect('#5a3419', 0, beam - 1, W, 1); rect('#7f5030', 0, beam - 6, W, 1);
    // lamps hanging from the beam
    for (const lx of [Math.round(W * 0.3), Math.round(W * 0.8)]) {
      rect('#2b2b3a', lx, beam, 1, m(0.25)); rect('#2b2b3a', lx - 4, beam + m(0.25), 9, 3);
      rect(`rgba(255, 236, 150, ${0.85 + 0.15 * Math.sin(t * 2)})`, lx - 2, beam + m(0.25) + 3, 5, 2);
    }
  }

  function drawAisle() {
    ctx.imageSmoothingEnabled = false;
    drawRoof();
    const beam = L.foot - L.beam;
    // wall planks and the stone floor
    for (let x = 0; x < W; x += 12) { rect((x / 12) % 2 ? '#8a5530' : '#7f4d2b', x, beam, 12, L.foot - 6 - beam); rect('#5a3419', x, beam, 1, L.foot - 6 - beam); }
    rect('#9a9286', 0, L.foot - 6, W, H);
    ctx.fillStyle = '#857d72';
    for (let y = L.foot - 6; y < H; y += 8) for (let x = (y / 8) % 2 ? 0 : 10; x < W; x += 20) ctx.fillRect(x, y, 1, 8), ctx.fillRect(x, y, 20, 1);
    // the box: inside dark with straw, posts, a name plate; the bars and door come in front of a horse inside (drawDoor)
    const bx = L.box, bw = L.boxW, bh = m(2.3);
    rect('#3b2412', bx, L.foot - bh, bw, bh); rect('#c9a75a', bx, L.foot - 8, bw, 8);
    rect(LEATHER_DARK, bx - 3, L.foot - bh - 4, bw + 6, 4); rect(LEATHER_DARK, bx - 3, L.foot - bh, 3, bh); rect(LEATHER_DARK, bx + bw, L.foot - bh, 3, bh);
    // the tie ring on its plate, at the height of a horse's head
    const ry = L.foot - L.ringY;
    rect('#4a4a5e', L.ring - 3, ry - 6, 6, 6);
    rect(METAL, L.ring - 4, ry, 8, 1); rect(METAL, L.ring - 4, ry + 7, 8, 1); rect(METAL, L.ring - 5, ry + 1, 1, 6); rect(METAL, L.ring + 4, ry + 1, 1, 6);
    // the saddle rack: a wooden arm on the wall, with a hook for the bridle
    const rk = L.rack, rkY = L.foot - m(1.1);
    rect(WOOD_DARK, rk - m(0.3), rkY, m(0.6), 3); rect(WOOD_DARK, rk - 1, rkY, 3, m(0.25)); rect(METAL, rk + m(0.3) + 2, rkY - m(0.35), 2, 3);
    // the tap and its bucket
    const tapY = L.foot - m(1.0);
    rect(METAL, L.tap - 1, tapY - 6, 3, 8); rect(METAL, L.tap - 1, tapY, 8, 3); rect('#c0392b', L.tap - 3, tapY - 8, 7, 2);
    rect('#3d6fd9', L.tap - 2, L.foot - m(0.35), m(0.35), m(0.35)); rect('#2f4f9a', L.tap - 2, L.foot - m(0.35), m(0.35), 2);
    if (done.has('wash') && !done.has('bridleAway')) for (let i = 0; i < 3; i++) rect('#8fc8f0', L.tap + 5, tapY + 3 + ((t * 30 + i * 6) % 14), 1, 2); // water
    // the tack room door with a saddle on its sign
    const tw = m(1.0), th = m(2.05), tl = L.tack - Math.round(tw / 2);
    rect(LEATHER_DARK, tl - 3, L.foot - th - 3, tw + 6, th + 3); rect(WOOD, tl, L.foot - th, tw, th - 6);
    for (let x = tl + 4; x < tl + tw; x += 6) rect(WOOD_DARK, x, L.foot - th, 1, th - 6);
    rect('#efe6d0', L.tack - 9, L.foot - th + 6, 18, 9);
    rect(LEATHER_DARK, L.tack - 6, L.foot - th + 9, 12, 2); rect(LEATHER_DARK, L.tack - 7, L.foot - th + 8, 2, 2); rect(LEATHER_DARK, L.tack + 4, L.foot - th + 7, 2, 3); rect(LEATHER_DARK, L.tack - 1, L.foot - th + 11, 2, 3);
    rect('#e8c35a', tl + tw - 5, L.foot - m(1.05), 2, 2);
    // the way out to the arena: a big door frame, daylight, sand and the fence
    const ah = m(2.4);
    rect('#bfe3f5', L.arena, L.foot - ah, W - L.arena, ah - 6); rect('#7fb34a', L.arena, L.foot - m(0.9), W - L.arena, m(0.9) - 6);
    rect('#e3c88a', L.arena, L.foot - 6, W - L.arena, H);
    rect('#f5f0e0', L.arena + 4, L.foot - m(0.8), W - L.arena, 2); rect('#f5f0e0', L.arena + 4, L.foot - m(0.45), W - L.arena, 2);
    for (let x = L.arena + 8; x < W; x += m(1.2)) rect('#f5f0e0', x, L.foot - m(0.9), 2, m(0.9) - 6);
    rect(LEATHER_DARK, L.arena - 4, L.foot - ah - 4, W - L.arena + 4, 4); rect(LEATHER_DARK, L.arena - 4, L.foot - ah, 4, ah - 6);
  }

  /** The hook by the box for halter and rope, while they aren't on the horse; in front of the door swung open against it (#119). */
  function drawHook() {
    const hook = L.box + L.boxW + 6, hookY = L.foot - m(1.6);
    rect(METAL, hook, hookY, 2, 3);
    const halterOn = has('halter', 'halterOff') || has('halterNeck2', 'halterOff2'), tied = has('tie', 'untie') || has('tie2', 'untie2') || has('leadOut', 'tie');
    if (!halterOn) { line(HALTER, hook, hookY + 3, hook - 3, hookY + 12); line(HALTER, hook + 1, hookY + 3, hook + 4, hookY + 12); line(HALTER, hook - 3, hookY + 12, hook + 4, hookY + 12); }
    if (!tied) for (let i = 0; i < 3; i++) line(ROPE, hook - 2 + i, hookY + 4, hook - 2 + i * 2, hookY + 18);
  }

  /**
   * The box door, the whole front: wood below, bars above, in front of a horse inside. Open, it has swung right round
   * against the wall (seen edge on), so the opening is as high as the box and the horse walks out under nothing (#88).
   */
  function drawDoor() {
    const bx = L.box, bw = L.boxW, top_ = L.foot - m(2.3), door = m(1.3);
    if (!done.has('open') || done.has('close')) {
      ctx.fillStyle = METAL; for (let x = bx + 3; x < bx + bw; x += 7) ctx.fillRect(x, top_, 2, m(2.3) - door);
      rect(LEATHER_DARK, bx, top_ - 2, bw, 2); rect(LEATHER_DARK, bx, L.foot - door - 2, bw, 2);
      rect(WOOD, bx, L.foot - door, bw, door);
      ctx.fillStyle = WOOD_DARK; for (let x = bx; x < bx + bw; x += 8) ctx.fillRect(x, L.foot - door, 1, door);
      line(WOOD_DARK, bx + 2, L.foot - 3, bx + bw - 3, L.foot - door + 2); // the brace
      rect('#2b2b3a', bx + bw - 10, L.foot - m(0.75), 7, 3); // the bolt
      rect('#efe6d0', bx + Math.round(bw / 2) - 8, L.foot - door + 4, 16, 6); // the name plate
    } else { // swung open: the door's edge against the wall, bars and wood, the full height
      rect(METAL, bx + bw + 1, top_, 5, m(2.3) - door); rect(LEATHER_DARK, bx + bw, top_ - 2, 7, 2);
      rect(WOOD, bx + bw, L.foot - door, 7, door); rect(WOOD_DARK, bx + bw, L.foot - door, 1, door);
    }
  }

  // the horse walks to its new place (out of the box, back in, to the ring) instead of jumping there (#88); taps and
  // gestures use where it is going, so they don't wait for the walk
  let shownX: number | null = null, lastT = 0, walking = 0, was = where();
  function walk() {
    const goal = hx(), dt = Math.min(0.1, t - lastT);
    lastT = t;
    if (shownX === null || (where() !== was && (where() === 'arena' || was === 'arena'))) shownX = goal; // the first frame, or to and from the arena (the ride shows that way): no walk
    was = where();
    const dx = goal - shownX, step = m(3) * dt; // a brisk walk
    walking = Math.abs(dx) < 0.5 ? 0 : Math.sign(dx);
    shownX = Math.abs(dx) <= step ? goal : shownX + Math.sign(dx) * step;
  }

  function drawHorse() {
    const X = Math.round(shownX ?? hx()), Y = hy(), up = walking ? (Math.sin(t * 9) > 0 ? 1 : 0) : Math.sin(t * 1.8) > 0.6 ? 1 : 0;
    ctx.save();
    if (walking > 0) { ctx.translate(2 * X + x0 + x1, 0); ctx.scale(-1, 1); } // walking to the right: it faces the way it goes
    const sheet = has('saddleOn', 'saddleOff') ? saddled : plain;
    shadow(ctx, X + x0 + w / 2, L.foot - 1, w / 2, 3, 0.25);
    ctx.drawImage(sheet, 128, 0, 128, legs + up, X, Y - up, 128, legs + up); // bobbing up: one more row, no gap above the legs (#119)
    ctx.drawImage(sheet, 128, legs, 128, 128 - legs, X, Y + legs, 128, 128 - legs);
    const P = (x: number, y: number) => [X + x, Y + y - up] as const;
    const [mx, my] = P(x0 + 5, muzzle[0]), [px_, py] = P(headX, poll + 1), [chx, chy] = P(x0 + 7, muzzle[1] + 1);
    // the halter on the head: noseband, cheek strap up to the poll; or buckled round the neck
    const halterHead = has('halter', 'halterNeck') || has('halterOn', 'halterOff2'), halterNeck = has('halterNeck', 'halterOff') || has('halterNeck2', 'halterOn');
    if (halterHead) { line(HALTER, mx, my - 1, chx, chy); line(HALTER, chx, chy, px_, py); line(HALTER, mx, my - 1, px_ - 2, py + 4); }
    const [nx, ny] = P(neckX, neck[0]);
    if (halterNeck) line(HALTER, nx, ny, nx - 3, Y + belly - 10);
    // the bridle: cheek pieces, noseband, brow band, the bit; reins over the neck to the withers
    const bridle = has('bridleOn', 'bridleOff');
    if (bridle) {
      line(LEATHER, mx + 2, my, mx + 2, chy - 1); line(LEATHER, mx + 2, my + 1, px_ + 1, py); line(LEATHER, px_ - 3, py + 2, px_ - 6, py + 6); line(LEATHER, mx + 1, my + 2, chx - 2, my + 2);
      rect(METAL, chx - 4, chy - 3, 2, 2);
    }
    if (has('reins', 'bridleOff')) line(LEATHER, bridle ? chx - 3 : nx - 4, bridle ? chy - 2 : ny + 8, ...P(x0 + w * 0.45, back - 1));
    // the rope from the halter to the ring
    const tied = has('tie', 'untie') || has('tie2', 'untie2');
    if (tied && !walking) line(ROPE, // (not while it walks mirrored: tied mid-walk, the rope waits until it stands)
      halterNeck ? nx - 2 : chx, halterNeck ? ny + 10 : chy, L.ring, L.foot - L.ringY + 7);
    // hooves and buckles a gesture waits for; arrows where to brush
    if (gesture?.kind === 'hooves') for (const h of hooves) ring(X + h.x, L.foot + 2, h.done);
    if (gesture?.kind === 'buckles') for (const b of buckles) ring(X + b.x, Y + b.y - up, b.done);
    if (gesture?.kind === 'brush') {
      const s = JSON.parse(canvas.dataset.spots ?? '{}')[gesture.at] as string | undefined;
      if (s) {
        const r = canvas.getBoundingClientRect(), [sx, sy] = s.split(',').map(Number), ax = (sx - r.left) / S, ay = (sy - r.top) / S, d = Math.round(Math.sin(t * 6) * 3);
        ctx.fillStyle = '#ffffff';
        for (const k of [-1, 1]) { const x = ax + k * (7 + d); ctx.fillRect(x, ay - 2, 1, 5); ctx.fillRect(x + k, ay - 1, 1, 3); ctx.fillRect(x + 2 * k, ay, 1, 1); }
      }
    }
  }
  function ring(x: number, y: number, ok: boolean) {
    ctx.fillStyle = ok ? '#3c9a3c' : `rgba(255, 255, 255, ${0.55 + 0.45 * Math.sin(t * 5)})`;
    x = Math.round(x); y = Math.round(y);
    ctx.fillRect(x - 3, y - 2, 7, 1); ctx.fillRect(x - 3, y + 2, 7, 1); ctx.fillRect(x - 4, y - 1, 1, 3); ctx.fillRect(x + 4, y - 1, 1, 3);
    if (ok) ctx.fillRect(x - 2, y, 5, 1);
  }

  function drawThings() {
    // the grooming kit on the floor behind the horse while it is out
    if (has('kit', 'kitAway')) {
      const x = L.rider - 6 * KID - m(0.55);
      rect('#2f6b3a', x, L.foot - m(0.3), m(0.5), m(0.3)); rect('#43a047', x, L.foot - m(0.3), m(0.5), 2);
      rect('#e8c35a', x + 3, L.foot - m(0.3) - 3, 4, 3); rect(LEATHER_DARK, x + 9, L.foot - m(0.3) - 4, 5, 4);
    }
    // saddle and bridle on the rack while fetched (and the washed bridle until it is put away)
    const rk = L.rack, rkY = L.foot - m(1.1);
    if (has('saddleGet', 'saddleOn')) { rect('#3d6fd9', rk - m(0.32), rkY - 3, m(0.64), 4); rect(LEATHER_DARK, rk - m(0.28), rkY - 7, m(0.56), 5); rect(LEATHER_DARK, rk - m(0.3), rkY - 9, 3, 3); rect(LEATHER_DARK, rk + m(0.24), rkY - 10, 3, 4); }
    if (has('bridleGet', 'bridleOn') || has('bridleOff', 'bridleAway')) {
      const bx = rk + m(0.3) + 3, by = rkY - m(0.35) + 3;
      line(LEATHER, bx, by, bx - 3, by + 10); line(LEATHER, bx, by, bx + 3, by + 10); line(LEATHER, bx - 3, by + 10, bx + 3, by + 10); rect(METAL, bx - 1, by + 10, 3, 2);
    }
  }

  function drawRider() {
    const gear: Gear = { helmet: done.has('helmet'), vest: done.has('vest'), gloves: done.has('gloves') };
    ctx.save(); ctx.translate(L.rider, L.foot + 4); ctx.scale(KID, KID);
    drawKid(ctx, o.kid, 0, 0, 'W', 0, gear);
    ctx.restore();
    if (has('whip', 'whipAway')) line('#2a1d14', L.rider - 7, L.foot - 12, L.rider - 16, L.foot - 34);
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
    drawAisle(); drawThings();
    walk();
    const horse = () => { drawHorse(); ctx.restore(); };
    if (where() === 'box' && !walking) { horse(); drawDoor(); drawHook(); } else { drawDoor(); drawHook(); horse(); }
    drawRider(); drawBits();
    requestAnimationFrame(frameDraw);
  }

  const finish = () => {
    const g = gesture!;
    gesture = null;
    for (let i = 0; i < 8; i++) sparkles.push({ x: (shownX ?? hx()) + x0 + Math.random() * w, y: hy() + top + Math.random() * (bottom - top), age: -i * 0.08 });
    targets();
    g.ok(true);
  };
  // one finger (a second one or a palm doesn't take over), in logical pixels
  let finger: number | null = null, last: [number, number] | null = null;
  const at = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / S, (e.clientY - r.top) / S] as [number, number]; };
  const brushes = (want: Spot, on: Spot | null) => on === want || (want === 'body' && (on === 'belly' || on === 'neck' || on === 'legs'));
  canvas.addEventListener('pointerdown', (e) => {
    if (finger !== null) return;
    finger = e.pointerId; last = at(e);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer knows */ }
    const [x, y] = last;
    if (gesture?.kind === 'hooves' || gesture?.kind === 'buckles') {
      const X = hx(), Y = hy();
      const marks = gesture.kind === 'hooves' ? hooves.map((h) => ({ k: h, x: X + h.x, y: L.foot + 2 })) : buckles.map((b) => ({ k: b, x: X + b.x, y: Y + b.y }));
      const near = marks.filter((k) => !k.k.done).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      if (near && Math.hypot(near.x - x, near.y - y) < 8) { near.k.done = true; targets(); }
      if (marks.every((k) => k.k.done)) finish();
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
        (kind === 'hooves' ? hooves : buckles).forEach((k) => { k.done = false; });
        gesture = { kind, at: spot, left: STROKES * M, ok };
        targets();
      });
    },
    /** Another thing picked up: the gesture is off. */
    cancel() { gesture?.ok(false); gesture = null; targets(); },
    stop() { running = false; removeEventListener('resize', fit); },
  };
}
