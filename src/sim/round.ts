/**
 * A round on the show-jumping arena ("Springplatz", #43), seen from above: where the horse is, which jump is next,
 * the faults so far. Pure and step by step, so the scene only draws it and feeds in the finger and "Hopp!".
 * The horse canters on its own and turns towards the finger. "Hopp!" in front of the next jump takes off, judged by
 * the Sim's take-off window. Reaching a jump without taking off, or riding at it too askew, the horse refuses.
 * A jump out of turn can't be jumped: the horse stops in front of it, without a fault.
 */
import { DATA } from './data';

export type Dir = 'N' | 'E' | 'S' | 'W';
export type CourseJump = { x: number; y: number; dir: Dir; kind: 'cross' | 'upright' | 'oxer' };
/** Start and finish: a point and the way the horse rides through it. */
export type Course = { start: [x: number, y: number, dir: Dir]; finish: [x: number, y: number, dir: Dir]; jumps: CourseJump[] };

export type Round = {
  x: number; y: number; heading: number; // radians: 0 east, π/2 south (the screen's y points down)
  t: number; next: number; faults: number;
  down: number[]; // jumps with a knocked pole
  air: { jump: number; from: number; to: number; down: boolean } | null; // in the air over a jump, from/to in seconds
  stopped: number; // seconds left standing after a refusal
  refused: number | null; // the jump refused last
  done: boolean;
};

const R = DATA.jumping.ride, A = DATA.jumping.arena;
export const ANGLE: Record<Dir, number> = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Where a point lies from a jump (or the finish): `s` along the way it is ridden (negative before it), `lat` across. */
export function rel(x: number, y: number, [jx, jy]: [number, number], dir: Dir) {
  const a = ANGLE[dir], dx = x - jx, dy = y - jy;
  return { s: dx * Math.cos(a) + dy * Math.sin(a), lat: -dx * Math.sin(a) + dy * Math.cos(a) };
}

/** The seconds a child has: the straight way through the course, at a canter, times a generous factor. */
export function timeAllowed(c: Course) {
  const pts = [c.start, ...c.jumps.map((j) => [j.x, j.y]), c.finish];
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return Math.ceil((len / R.speed) * R.time);
}
const timeFaults = (t: number, allowed: number) => (t > allowed ? Math.ceil((t - allowed) / R.timeFault) : 0);

export function newRound(c: Course): Round {
  const [x, y, dir] = c.start;
  return { x, y, heading: ANGLE[dir], t: 0, next: 0, faults: 0, down: [], air: null, stopped: 0, refused: null, done: false };
}

/** The round `dt` seconds later, the finger at `target` (arena pixels) or lifted (null). */
export function step(r: Round, c: Course, dt: number, target: { x: number; y: number } | null): Round {
  if (r.done) return r;
  const t = r.t + dt, allowed = timeAllowed(c);
  if (t > allowed + R.giveUp) return { ...r, t, done: true, faults: r.faults + (c.jumps.length - r.next) + timeFaults(t, allowed) };
  if (r.stopped > 0) {
    const stopped = Math.max(0, r.stopped - dt);
    return { ...r, t, stopped, heading: stopped ? r.heading : wrap(r.heading + Math.PI) }; // then it turns round
  }
  let heading = r.heading;
  if (!r.air && target) {
    const want = Math.atan2(target.y - r.y, target.x - r.x), turn = R.turn * dt;
    if (Math.hypot(target.x - r.x, target.y - r.y) > 4) heading = wrap(heading + Math.max(-turn, Math.min(turn, wrap(want - heading))));
  }
  let x = r.x + Math.cos(heading) * R.speed * dt, y = r.y + Math.sin(heading) * R.speed * dt;
  // the fence: the horse slides along it
  const lo = A.fence + 6, hx = A.w - A.fence - 6, hy = A.h - A.fence - 6;
  if (x < lo || x > hx) { x = Math.max(lo, Math.min(hx, x)); heading = Math.sin(heading) >= 0 ? ANGLE.S : ANGLE.N; }
  if (y < lo || y > hy) { y = Math.max(lo, Math.min(hy, y)); heading = Math.cos(heading) >= 0 ? ANGLE.E : ANGLE.W; }
  let next: Round = { ...r, x, y, heading, t };
  if (r.air) {
    if (t < r.air.to) return next;
    // landed: the jump is done, a knocked pole is a fault
    const { jump, down } = r.air;
    return { ...next, air: null, next: r.next + 1, faults: r.faults + (down ? 1 : 0), down: down ? [...r.down, jump] : r.down };
  }
  // reaching a jump on the ground (from either side): the horse stops in front of it
  for (let i = 0; i < c.jumps.length; i++) {
    const j = c.jumps[i], before = rel(r.x, r.y, [j.x, j.y], j.dir), after = rel(x, y, [j.x, j.y], j.dir);
    if (Math.abs(after.lat) > R.half || Math.sign(before.s) === Math.sign(after.s)) continue;
    const counts = i === r.next && before.s < 0; // a refusal at the next jump, ridden the right way, is a fault
    return { ...r, t, heading, stopped: R.stop, refused: i, faults: r.faults + (counts ? 1 : 0) };
  }
  // through the finish after the last jump
  if (r.next === c.jumps.length) {
    const [fx, fy, fd] = c.finish, before = rel(r.x, r.y, [fx, fy], fd), after = rel(x, y, [fx, fy], fd);
    if (Math.abs(after.lat) <= R.half * 1.5 && Math.sign(before.s) !== Math.sign(after.s))
      next = { ...next, done: true, faults: next.faults + timeFaults(t, allowed) };
  }
  return next;
}

/** How far the next take-off is, in seconds (negative: still to come), or null if the horse isn't lined up for the next jump. */
export function takeOffOffset(r: Round, c: Course) {
  const j = c.jumps[r.next];
  if (!j || r.air || r.stopped || r.done) return null;
  const { s, lat } = rel(r.x, r.y, [j.x, j.y], j.dir);
  const askew = Math.abs(wrap(r.heading - ANGLE[j.dir])) * (180 / Math.PI);
  if (Math.abs(lat) > R.half || askew > R.refuse || s >= 0) return null;
  return (s + R.takeoff) / R.speed;
}

/** "Hopp!": takes off for the next jump if the horse is lined up and the judge (the Sim's take-off window) says so. */
export function hopp(r: Round, c: Course, judge: (offset: number) => 'early' | 'clear' | 'fault'): Round {
  const offset = takeOffOffset(r, c);
  if (offset === null) return r;
  const what = judge(offset);
  if (what === 'early') return r;
  const j = c.jumps[r.next], { s } = rel(r.x, r.y, [j.x, j.y], j.dir);
  // straight over the jump, landing as far behind the pole as the hooves left the ground before it
  return { ...r, heading: ANGLE[j.dir], air: { jump: r.next, from: r.t, to: r.t + (R.takeoff - s) / R.speed, down: what === 'fault' } };
}

/**
 * A rider who knows the way: where to point the finger, and whether this is the moment for "Hopp!". Rides each
 * jump from a point straight in front of it. For the tests and the Playwright round; the child steers themselves.
 */
export function autopilot(r: Round, c: Course, window = 0.03) {
  const j = c.jumps[r.next];
  if (!j) { const [fx, fy, fd] = c.finish; return { x: fx + Math.cos(ANGLE[fd]) * 30, y: fy + Math.sin(ANGLE[fd]) * 30, hopp: false }; }
  const a = ANGLE[j.dir], { s, lat } = rel(r.x, r.y, [j.x, j.y], j.dir), offset = takeOffOffset(r, c);
  const ux = Math.cos(a), uy = Math.sin(a), along = (d: number, side = 0) => ({ x: j.x + ux * d - uy * side, y: j.y + uy * d + ux * side });
  // first to a point well in front of the jump, then from near its line straight over it; too close or past it:
  // round in a wide loop
  const near = s < 0 && s > -95 && Math.abs(lat) < 25;
  const p = near ? along(40) : s < -30 ? along(-80) : along(-140, lat >= 0 ? 70 : -70);
  return { ...p, hopp: offset !== null && Math.abs(offset) <= window };
}
