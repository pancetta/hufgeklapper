/**
 * Everything that moves on the farm: horses and ponies on the pasture, a pony cantering over the jumps,
 * chickens, sheep, a sleeping cat, a dog on the path, butterflies, cloud shadows and glints on the pond.
 * Pure animation, no game rules; a seeded random generator keeps it repeatable.
 */
import { horseSheet } from '../horses/compose';
import { type Anim, COATS, type Look } from '../horses/look';
import { canterLoop, inside, jumps, type Plot, track, waitingSpots } from './buildings';
import { blit, type Rect, shadow } from './draw';
import { WINDMILL } from './farm';
import type { Kid } from '../riders/look';
import { drawKid, drawRider } from './kids';
import { drawWindmill } from './windmill';

export type Drawable = { y: number; draw: (ctx: CanvasRenderingContext2D, t: number) => void };
type Images = Record<string, CanvasImageSource>;

/** mulberry32: small, fast, seeded. */
export function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Dir = 'N' | 'W' | 'S' | 'E';
const ROW: Record<Dir, number> = { N: 0, W: 1, S: 2, E: 3 };
const dirOf = (dx: number, dy: number): Dir => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'W' : 'E') : dy < 0 ? 'N' : 'S');

type HorseAnim = Anim | 'eat';

/**
 * Where a horse's sheet for an animation lives in the image map. Walking, standing and galloping use the look's
 * composed sheet; grazing comes from the classic LPC sheet, which has no layers.
 */
function horseKey(look: Look, anim: HorseAnim) {
  if (anim === 'eat') return `horses/${look.build === 'pony' ? 'pony-' : ''}classic-${COATS[look.coat].sheet}.png`;
  return `horse:${anim}:${JSON.stringify(look)}`;
}

function horseFrame(anim: HorseAnim, dir: Dir, f: number): Rect {
  if (anim === 'idle') return [ROW[dir] * 128, 0, 128, 128];
  if (anim === 'eat') return [(f % 4) * 128, (9 + ROW[dir]) * 128, 128, 128];
  return [(f % 6) * 128, ROW[dir] * 128, 128, 128];
}

/** A horse drawn at its hooves (x, y); lift raises it for a jump while the shadow stays on the ground. */
function drawHorse(ctx: CanvasRenderingContext2D, img: Images, look: Look, anim: HorseAnim, dir: Dir, f: number, x: number, y: number, lift = 0) {
  const side = dir === 'W' || dir === 'E';
  shadow(ctx, x, y - 1, side ? (look.build === 'pony' ? 22 : 26) : 11, 4, 0.24 - lift * 0.004);
  blit(ctx, img[horseKey(look, anim)], horseFrame(anim, dir, f), x - 64, y - 93 - lift);
}

/** The point `d` pixels along a closed loop, and which way it heads there. */
function along(loop: [number, number][], d: number) {
  for (let i = 0; ; i = (i + 1) % loop.length) {
    const a = loop[i], b = loop[(i + 1) % loop.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= len) return { x: a[0] + ((b[0] - a[0]) * d) / len, y: a[1] + ((b[1] - a[1]) * d) / len, dir: dirOf(b[0] - a[0], b[1] - a[1]) };
    d -= len;
  }
}
const loopLength = (loop: [number, number][]) => loop.reduce((n, a, i) => { const b = loop[(i + 1) % loop.length]; return n + Math.hypot(b[0] - a[0], b[1] - a[1]); }, 0);

/** Where a rider sits, from the horse's hooves (measured on the LPC frames): seen from the side, just behind the withers. */
export function seat(build: Look['build'], dir: Dir) {
  const pony = build === 'pony', side = dir === 'W' || dir === 'E';
  // coming towards us the child shows above the horse's head, so it sits higher in the picture
  const dy = side ? (pony ? -33 : -40) : dir === 'S' ? (pony ? -44 : -48) : pony ? -30 : -34;
  return { dx: side ? (pony ? 4 : 7) * (dir === 'W' ? -1 : 1) : 0, dy };
}

export type Walker = { x: number; y: number; tx: number; ty: number; wait: number; dir: Dir; mode: 'walk' | 'stand' | 'eat'; phase: number };
type Area = readonly [x0: number, y0: number, x1: number, y1: number];

/** Walk to a target, then stand or graze a while; a new target keeps clear of the others in `crowd`. */
export function wander(w: Walker, area: Area, speed: number, dt: number, rnd: () => number, eats = true, crowd: Walker[] = []) {
  const dx = w.tx - w.x, dy = w.ty - w.y, dist = Math.hypot(dx, dy);
  if (w.mode === 'walk') {
    if (dist < 1) { w.mode = eats && rnd() < 0.6 ? 'eat' : 'stand'; w.wait = 2 + rnd() * 5; return; }
    const step = Math.min(dist, speed * dt);
    w.x += (dx / dist) * step; w.y += (dy / dist) * step; w.dir = dirOf(dx, dy);
    return;
  }
  w.wait -= dt;
  if (w.wait > 0) return;
  for (let i = 0; i < 6; i++) {
    w.tx = area[0] + rnd() * (area[2] - area[0]); w.ty = area[1] + rnd() * (area[3] - area[1]);
    if (crowd.every((o) => o === w || Math.hypot(o.tx - w.tx, (o.ty - w.ty) * 2) > 60)) break;
  }
  w.mode = 'walk';
}

export const walker = (area: Area, rnd: () => number): Walker => {
  const x = area[0] + rnd() * (area[2] - area[0]), y = area[1] + rnd() * (area[3] - area[1]);
  return { x, y, tx: x, ty: y, wait: rnd() * 3, dir: (['W', 'E', 'S'] as Dir[])[Math.floor(rnd() * 3)], mode: 'stand', phase: rnd() * 10 };
};

const YARD: Area = [180, 425, 350, 465];

export const START_HERD: Look[] = [
  { build: 'pony', coat: 'isabell' },
  { build: 'horse', coat: 'brauner' },
  { build: 'horse', coat: 'falbe' },
  { build: 'pony', coat: 'rappe', face: 'stern', legs: 'socken' },
];
const RIDER_PONY: Look = { build: 'pony', coat: 'schimmel', mane: 'blond', blanket: '#d94f3d' };
/**
 * Grazing uses the classic sheet, which has no layers and a black mane painted in: only plain horses whose coat
 * has a black mane can graze without changing their looks.
 */
const grazes = (l: Look) => l.build === 'horse' && !l.mane && !l.face && !l.legs && !l.saddle && !l.blanket && COATS[l.coat].mane === 'schwarz';

/** Every plain image the farm's life draws from (for preloading). */
export function lifeSheets(herd: Look[]) {
  return ['farm/windmill-blades.png', 'animals/chicken-walk.png', 'animals/chicken-eat.png', 'animals/sheep-walk.png', 'animals/sheep-eat.png', 'animals/cat.png', 'animals/dog.png',
    ...herd.filter(grazes).map((l) => horseKey(l, 'eat'))];
}

/** Composes the herd's and the rider pony's sheets into the image map. */
export async function loadHorses(img: Images, herd: Look[], canter: boolean) {
  const wanted: [Look, Anim][] = [...herd.flatMap((l) => [[l, 'idle'], [l, 'walk']] as [Look, Anim][]), ...(canter ? [[RIDER_PONY, 'gallop'] as [Look, Anim]] : [])];
  await Promise.all(wanted.map(async ([l, a]) => { img[horseKey(l, a)] = await horseSheet(l, a); }));
}

/** A cloud's shadow: a few overlapping puffs in stepped pixel rows, drawn once. */
function cloudShape(s: number) {
  const c = document.createElement('canvas');
  c.width = Math.round(240 * s); c.height = Math.round(150 * s);
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(25, 35, 70)';
  for (const [dx, dy, r] of [[0, 0, 60], [55, 10, 45], [-50, 14, 40], [20, -25, 38]] as const) {
    const rr = Math.round(r * s), cx = c.width / 2 + dx * s, cy = c.height / 2 + dy * s;
    for (let yy = -rr; yy <= rr; yy += 2) {
      const w = Math.round(Math.sqrt(rr * rr - yy * yy) * 1.4);
      g.fillRect(Math.round(cx - w), Math.round(cy + yy), w * 2, 2);
    }
  }
  return c;
}

/** The farm's life: `herd` roams the pasture; with `canter`, a pony canters over the jumps in the arena. */
export function createLife(seed: number, plots: Plot[], herd: Look[], canter: boolean) {
  const rnd = random(seed);
  // the herd lives on the first pasture, the pony canters in the first arena
  const PASTURE = inside(plots.find((p) => p.building === 'pasture')!);
  const arena = plots.find((p) => p.building === 'arena')!;
  const LOOP = canterLoop(arena), JUMPS = jumps(arena);
  const horses = herd.map((look) => ({ look, w: walker(PASTURE, rnd) }));
  const sheep = [walker(PASTURE, rnd)];
  const chickens = [0, 1, 2, 3, 4].map(() => walker(YARD, rnd));
  const dog = { x: 420, dir: 1, wait: 0 };
  const TRACK = track(arena), LAP = loopLength(LOOP), TRACK_LAP = loopLength(TRACK), SPOTS = waitingSpots(arena);
  let ride = 0, waiting: Kid[] = [];
  let lesson: { horse: number; kid: Kid; d: number; done: () => void } | null = null, lessons = Promise.resolve();
  let away = new Set<number>(); // herd horses not on the pasture (sick or resting, in the stable)
  const butterflies = ['#ffe066', '#ffffff', '#ff9f43', '#7ec8ff', '#ff8fc7'].map((color, i) => ({
    color, hx: [250, 430, 600, 300, 820][i], hy: [528, 520, 536, 120, 150][i], phase: rnd() * 10, speed: 0.6 + rnd() * 0.5,
  }));
  const clouds = [0, 1, 2].map((i) => ({ x: i * 420 - 200, y: 60 + i * 170, shape: cloudShape(0.8 + rnd() * 0.5) }));
  const ripples = [0, 1].map(() => ({ x: 0, y: 0, age: 9 + rnd() * 4 }));
  const birds = [0, 1].map((i) => ({ x: -40 - i * 500, y: 140 + i * 160, phase: rnd() * 6 }));
  const glints = [0, 1, 2, 3, 4, 5].map(() => ({ x: 362 + rnd() * 108, y: 110 + rnd() * 70, phase: rnd() * 6 }));

  function update(dt: number) {
    const crowd = [...horses.map((h) => h.w), ...sheep];
    for (const h of horses) wander(h.w, PASTURE, h.look.build === 'pony' ? 13 : 16, dt, rnd, grazes(h.look), crowd);
    for (const s of sheep) wander(s, PASTURE, 8, dt, rnd, true, crowd);
    for (const c of chickens) wander(c, YARD, 14, dt, rnd);
    if (dog.wait > 0) dog.wait -= dt;
    else {
      dog.x += dog.dir * 22 * dt;
      if (dog.x > 690 || dog.x < 300) { dog.dir *= -1; dog.wait = 1.5 + rnd() * 2; }
    }
    // the canter pony moves along the loop at a steady speed; a lesson walks it once round
    if (canter) ride = (ride + 60 * dt) % LAP;
    if (lesson && (lesson.d += 55 * dt) >= TRACK_LAP) { lesson.done(); lesson = null; }
    for (const c of clouds) { c.x += 7 * dt; if (c.x > 1100) c.x = -300; }
    for (const r of ripples) {
      r.age += dt;
      if (r.age > 6 + rnd() * 6) { r.age = 0; r.x = 372 + rnd() * 90; r.y = 118 + rnd() * 56; }
    }
    for (const b of birds) { b.x += 38 * dt; b.y -= 6 * dt; if (b.x > 1000) { b.x = -60 - rnd() * 400; b.y = 120 + rnd() * 300; } }
  }

  function drawables(t: number, img: Images): Drawable[] {
    const out: Drawable[] = [];
    horses.forEach(({ look, w }, i) => {
      if (i === lesson?.horse || away.has(i)) return;
      const anim: HorseAnim = w.mode === 'walk' ? 'walk' : w.mode === 'eat' ? 'eat' : 'idle';
      const f = Math.floor((t + w.phase) * (anim === 'eat' ? 3 : 7));
      out.push({ y: w.y, draw: (ctx) => drawHorse(ctx, img, look, anim, w.dir, f, w.x, w.y) });
    });
    out.push({ y: WINDMILL.y, draw: (ctx) => drawWindmill(ctx, img['farm/windmill-blades.png'], WINDMILL.x, WINDMILL.y, t) });
    // pupils wait by the arena; one rides in it
    waiting.slice(0, SPOTS.length).forEach((kid, i) => {
      const [x, y] = SPOTS[i];
      out.push({ y, draw: (ctx) => drawKid(ctx, kid, x, y, Math.sin(t * 0.7 + i * 2) > 0.8 ? 'W' : 'S') });
    });
    if (lesson) {
      const { kid } = lesson, look = horses[lesson.horse].look, p = along(TRACK, lesson.d), s = seat(look.build, p.dir), f = Math.floor(t * 8);
      out.push({ y: p.y, draw: (ctx) => {
        drawHorse(ctx, img, look, 'walk', p.dir, f, p.x, p.y);
        drawRider(ctx, kid, p.x + s.dx, p.y + s.dy, p.dir);
        if (p.dir !== 'S') return;
        // coming towards us, the horse's head and neck are in front of the child: draw them again over it
        ctx.save();
        ctx.beginPath(); ctx.rect(p.x - 64, p.y - 93, 128, 93 + s.dy - 2); ctx.clip();
        blit(ctx, img[horseKey(look, 'walk')], horseFrame('walk', 'S', f), p.x - 64, p.y - 93);
        ctx.restore();
      } });
    }
    for (const s of sheep) {
      const sheet = s.mode === 'walk' ? 'animals/sheep-walk.png' : 'animals/sheep-eat.png';
      const f = s.mode === 'stand' ? 0 : Math.floor((t + s.phase) * (s.mode === 'eat' ? 2 : 6)) % 4;
      out.push({ y: s.y, draw: (ctx) => { shadow(ctx, s.x, s.y - 1, s.dir === 'W' || s.dir === 'E' ? 16 : 9, 3); blit(ctx, img[sheet], [f * 128, ROW[s.dir] * 128, 128, 128], s.x - 64, s.y - 82); } });
    }
    for (const c of chickens) {
      const sheet = c.mode === 'walk' ? 'animals/chicken-walk.png' : 'animals/chicken-eat.png';
      const f = c.mode === 'stand' ? 0 : Math.floor((t + c.phase) * 6) % 4;
      out.push({ y: c.y, draw: (ctx) => { shadow(ctx, c.x, c.y - 1, 6, 2); blit(ctx, img[sheet], [f * 32, ROW[c.dir] * 32, 32, 32], c.x - 16, c.y - 28); } });
    }
    // the cat sleeps on the haystack and breathes
    out.push({ y: 419, draw: (ctx) => blit(ctx, img['animals/cat.png'], [128 + 96, 0, 32, 32], 104, 360 + (Math.sin(t * 2) > 0.6 ? 1 : 0)) });
    // the dog trots along the path (row 0 faces right, row 3 left), sits while it waits
    const df = dog.wait > 0 ? 0 : Math.floor(t * 8) % 3;
    out.push({ y: 466, draw: (ctx) => { shadow(ctx, dog.x, 465, 8, 2); blit(ctx, img['animals/dog.png'], [df * 32, (dog.dir > 0 ? 0 : 3) * 32, 32, 32], dog.x - 16, 466 - 28); } });
    // the pony in the arena: gallop, lifting over a jump as it passes
    if (canter) {
      const { x: px, y: py, dir } = along(LOOP, ride);
      let lift = 0;
      for (const { x: jx, y: jy } of JUMPS) if (Math.abs(py - jy) < 20 && Math.abs(px - jx) < 26) lift = Math.max(lift, 14 * Math.cos(((px - jx) / 26) * (Math.PI / 2)));
      out.push({ y: py, draw: (ctx) => drawHorse(ctx, img, RIDER_PONY, 'gallop', dir, Math.floor(t * 11), px, py, Math.round(lift)) });
    }
    return out;
  }

  /** Drawn over everything: glints on the pond, butterflies, drifting cloud shadows. */
  function overlay(ctx: CanvasRenderingContext2D, t: number) {
    for (const g of glints) {
      const v = Math.sin(t * 2 + g.phase);
      if (v < 0.75) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(Math.round(g.x), Math.round(g.y), 1, 1);
      if (v > 0.92) { ctx.fillRect(Math.round(g.x) - 1, Math.round(g.y), 3, 1); ctx.fillRect(Math.round(g.x), Math.round(g.y) - 1, 1, 3); }
    }
    // a fish rose: one ring growing and fading on the pond
    for (const r of ripples) {
      if (r.age > 1.6) continue;
      const rx = Math.round(2 + r.age * 7), ry = Math.max(1, Math.round(rx / 2.5));
      ctx.fillStyle = `rgba(220, 245, 255, ${0.7 - r.age * 0.42})`;
      for (let a = 0; a < 24; a++) ctx.fillRect(Math.round(r.x + Math.cos((a / 24) * 6.283) * rx), Math.round(r.y + Math.sin((a / 24) * 6.283) * ry), 1, 1);
    }
    for (const b of butterflies) {
      const k = t * b.speed + b.phase, x = Math.round(b.hx + Math.sin(k) * 34 + Math.sin(k * 2.3) * 9), y = Math.round(b.hy + Math.cos(k * 1.3) * 16 - 14);
      shadow(ctx, x, y + 18, 2, 1, 0.15);
      const open = Math.floor(t * 9 + b.phase) % 2 === 0;
      ctx.fillStyle = b.color;
      if (open) { ctx.fillRect(x - 2, y - 1, 2, 2); ctx.fillRect(x + 1, y - 1, 2, 2); ctx.fillRect(x - 1, y + 1, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1); }
      else { ctx.fillRect(x - 1, y - 2, 1, 2); ctx.fillRect(x + 1, y - 2, 1, 2); }
      ctx.fillStyle = '#3b2a1a'; ctx.fillRect(x, y - 1, 1, 3);
    }
    // birds fly high: their shadow falls far below them
    for (const b of birds) {
      const up = Math.floor(t * 5 + b.phase) % 2 === 0, x = Math.round(b.x), y = Math.round(b.y);
      shadow(ctx, x + 10, y + 70, 3, 1, 0.18);
      ctx.fillStyle = '#3a3226';
      ctx.fillRect(x - 3, y - (up ? 1 : 0), 3, 1); ctx.fillRect(x + 1, y - (up ? 1 : 0), 3, 1); ctx.fillRect(x, y, 1, 1);
      if (up) { ctx.fillRect(x - 4, y - 2, 1, 1); ctx.fillRect(x + 4, y - 2, 1, 1); }
    }
    // cloud shadows: each cloud is one shape, so overlapping puffs don't darken
    ctx.globalAlpha = 0.13;
    for (const c of clouds) ctx.drawImage(c.shape, Math.round(c.x - c.shape.width / 2), Math.round(c.y - c.shape.height / 2));
    ctx.globalAlpha = 1;
  }

  return {
    update, drawables, overlay,
    /** Herd horses (by index) that are not on the pasture. */
    setAway(horses: number[]) { away = new Set(horses); },
    /** The pupils waiting by the arena. */
    setWaiting(kids: Kid[]) { waiting = kids; },
    /** Herd horse `horse` walks one lap of the arena with `kid` on its back, after the lessons before it; resolves when it is back. */
    lesson(horse: number, kid: Kid) {
      return (lessons = lessons.then(() => new Promise<void>((done) => { lesson = { horse, kid, d: 0, done }; })));
    },
  };
}
