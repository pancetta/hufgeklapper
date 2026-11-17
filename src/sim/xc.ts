/**
 * A cross-country round ("Gelände", #73), seen from the side: the horse goes along a track of `length` metres at the
 * pace the child picks, and the child taps "Hopp!" in front of each obstacle. Pure and step by step, like round.ts:
 * the scene only draws it and feeds in the pace and the taps.
 */
import { DATA } from './data';

export type Pace = 'walk' | 'trot' | 'gallop';
export const PACES: Pace[] = ['walk', 'trot', 'gallop'];
export type XcKind = 'log' | 'hedge' | 'bank' | 'ditch' | 'water';
export type XcObstacle = { at: number; kind: XcKind };
/** A track: its length in metres, its obstacles in order, and the optimum time (seconds) to arrive in. */
export type XcCourse = { length: number; obstacles: XcObstacle[]; optimum: [number, number] };
/** Why a refusal: no "Hopp!" in time, too fast at water or a ditch, or too slow (a walk) to jump. */
export type Refusal = 'late' | 'fast' | 'slow';
export type XcRound = {
  s: number; v: number; // metres along, metres a second
  pace: Pace; stamina: number; // 0–1
  t: number; next: number; faults: number;
  air: { from: number; to: number } | null; // in the air over the next obstacle (seconds)
  stopped: number; // seconds still standing after a refusal
  refused: Refusal | null; // the last refusal, for the child
  done: boolean;
};

const X = DATA.crossCountry;
const isJump = (k: XcKind) => k !== 'water';
/** The take-off window now: a tired horse (stamina under `tired`) gives the child less time, down to half. */
const windowNow = (r: XcRound, window: number) => window * (r.stamina >= X.tired ? 1 : 0.5 + (0.5 * r.stamina) / X.tired);
const careful = (k: XcKind) => k === 'water' || k === 'ditch'; // not at a gallop

/** A practice track from a seed: six obstacles, water and a ditch among them, spaced along the way. */
export function xcCourse(seed: number): XcCourse {
  let n = Math.abs(Math.floor(seed)) % 2147483646 + 1;
  const rnd = () => (n = (n * 16807) % 2147483647) / 2147483647;
  const kinds: XcKind[] = ['log', 'hedge', 'bank', 'log', 'ditch', 'water'];
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const gap = (X.length - 60) / X.obstacles;
  const obstacles = kinds.slice(0, X.obstacles).map((kind, i) => ({ kind, at: Math.round(40 + i * gap + rnd() * gap * 0.4) }));
  const optimum = X.length / X.typical;
  return { length: X.length, obstacles, optimum: [Math.round(optimum - X.tolerance), Math.round(optimum + X.tolerance)] };
}

export const newXcRound = (stamina: number): XcRound =>
  ({ s: 0, v: 0, pace: 'trot', stamina: Math.max(0, Math.min(1, stamina)), t: 0, next: 0, faults: 0, air: null, stopped: 0, refused: null, done: false });

/** Seconds until (negative) or since the take-off point of the next jump, at the speed now; null if none is near. */
export function xcOffset(r: XcRound, c: XcCourse) {
  const o = c.obstacles[r.next];
  if (!o || !isJump(o.kind) || r.air || r.stopped) return null;
  const d = r.s - (o.at - X.takeoff);
  return d < -X.early * Math.max(r.v, 1) - 6 ? null : d / Math.max(r.v, 1);
}

/** Time faults: each started `timeFault` seconds before or after the optimum window. */
const timeFaults = (t: number, [lo, hi]: [number, number]) => (t < lo ? Math.ceil((lo - t) / X.timeFault) : t > hi ? Math.ceil((t - hi) / X.timeFault) : 0);

/**
 * The round `dt` seconds later at pace `pace`, for a horse with drain factor `drain` (less with skill). `window`: the
 * take-off window in seconds (the horse's, see `xcWindow`); missing it at a jump, or meeting water or a ditch at a
 * gallop, is a refusal.
 */
export function xcStep(r: XcRound, c: XcCourse, dt: number, pace: Pace, window: number, drain = 1): XcRound {
  if (r.done) return r;
  const t = r.t + dt;
  if (t > c.optimum[1] * X.giveUp) return { ...r, t, done: true, faults: r.faults + (c.obstacles.length - r.next) + timeFaults(t, c.optimum) };
  if (r.stopped > 0) return { ...r, t, pace, v: 0, stopped: Math.max(0, r.stopped - dt), stamina: Math.min(1, r.stamina + -X.drain.walk * dt) };
  // the horse goes no faster than its stamina allows: worn out it only walks; in the water no more than a trot
  const o = c.obstacles[r.next], inWater = o?.kind === 'water' && r.s >= o.at && r.s < o.at + X.waterLength;
  const want = r.stamina <= 0 ? 'walk' : pace;
  const top = r.air ? r.v : Math.min(X.pace[want], inWater ? X.pace.trot * 0.6 : Infinity);
  const v = r.air ? r.v : r.v < top ? Math.min(top, r.v + X.accel * dt) : Math.max(top, r.v - X.accel * 2 * dt);
  const stamina = Math.max(0, Math.min(1, r.stamina - X.drain[want] * (X.drain[want] > 0 ? drain : 1) * dt));
  const s = r.s + v * dt;
  let next = r.next;
  let out: XcRound = { ...r, t, v, s, pace, stamina };
  if (r.air) {
    if (t >= r.air.to) out = { ...out, air: null, next: r.next + 1 };
    return finishLine(out, c);
  }
  if (o) {
    // water: in at a walk or trot; through it, the next one
    if (o.kind === 'water') {
      if (r.s < o.at && s >= o.at && v > X.pace.trot + 0.1) return refuse(out, o, 'fast');
      if (s >= o.at + X.waterLength) next = r.next + 1;
    } else {
      // a jump: past the take-off point (and the window's late half) without "Hopp!" is a refusal; a ditch at a gallop too
      const late = o.at - X.takeoff + (windowNow(r, window) / 2) * Math.max(v, 1);
      if (careful(o.kind) && r.s < o.at - X.takeoff && s >= o.at - X.takeoff && v > X.pace.trot + 0.1) return refuse(out, o, 'fast');
      if (s >= late) return refuse(out, o, 'late');
    }
  }
  return finishLine({ ...out, next }, c);
}

function refuse(r: XcRound, o: XcObstacle, why: Refusal): XcRound {
  return { ...r, s: Math.max(0, o.at - X.back), v: 0, stopped: X.stop, refused: why, faults: r.faults + 1 };
}
function finishLine(r: XcRound, c: XcCourse): XcRound {
  return r.s >= c.length && r.next >= c.obstacles.length ? { ...r, done: true, faults: r.faults + timeFaults(r.t, c.optimum) } : r;
}

/**
 * "Hopp!": a jump if the next obstacle's take-off is within half the window (judged by `clears`), nothing if too early,
 * and at a walk the horse won't jump (a refusal).
 */
export function xcHopp(r: XcRound, c: XcCourse, window: number): XcRound {
  const off = xcOffset(r, c), o = c.obstacles[r.next];
  if (off === null || !o) return r;
  if (off < -windowNow(r, window) / 2) return r; // too early: not yet
  if (r.v < X.pace.trot - 0.2) return refuse(r, o, 'slow');
  const fly = (X.takeoff + X.landing - off * r.v) / Math.max(r.v, 1);
  return { ...r, air: { from: r.t, to: r.t + Math.max(0.3, fly) } };
}
