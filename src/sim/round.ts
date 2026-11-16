/**
 * A round on the show-jumping arena ("Springplatz", #43), seen from above: where the horse is, which jump is next,
 * the faults so far. Pure and step by step, so the scene only draws it and feeds in the drawn path and the taps.
 * The horse canters on its own along the path the child drew (#47). "Hopp!" in front of the next jump takes off, judged by
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

/** Practice and the riding badge ride the E course, a show its class's. */
export const courseFor = (kind: 'train' | 'badge' | 'show', showClass: keyof typeof DATA.jumping.courses = 'E') =>
  DATA.jumping.courses[kind === 'show' ? showClass : 'E'];

export function newRound(c: Course): Round {
  const [x, y, dir] = c.start;
  return { x, y, heading: ANGLE[dir], t: 0, next: 0, faults: 0, down: [], air: null, stopped: 0, refused: null, done: false };
}

/** The round `dt` seconds later, steering to `target` (the next point of the drawn path, arena pixels) or straight on (null). */
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
  if ((x === lo || x === hx) && (y === lo || y === hy)) heading = Math.atan2(A.h / 2 - y, A.w / 2 - x); // a corner: out towards the middle
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

/**
 * A finger touching down: on time or late, the horse takes off at once (clear, or a late one knocks the pole), so a
 * slow tap is never too late. Earlier, nothing yet: only a tap counts (`hopp` with its lag), not the start of a stroke.
 */
export function touchDown(r: Round, c: Course, judge: (offset: number) => 'early' | 'clear' | 'fault'): Round {
  const offset = takeOffOffset(r, c);
  return offset !== null && (offset >= 0 || judge(offset) === 'clear') ? hopp(r, c, judge) : r;
}

/**
 * "Hopp!": takes off for the next jump if the horse is lined up and the judge (the Sim's take-off window) says so.
 * `lag`: seconds since the finger touched down (a tap is known only once it lifts); the judge hears the touch.
 */
export function hopp(r: Round, c: Course, judge: (offset: number) => 'early' | 'clear' | 'fault', lag = 0): Round {
  const offset = takeOffOffset(r, c);
  if (offset === null) return r;
  const what = judge(offset - lag);
  if (what === 'early') return r;
  const j = c.jumps[r.next], { s } = rel(r.x, r.y, [j.x, j.y], j.dir);
  // straight over the jump, landing as far behind the pole as the hooves left the ground before it
  return { ...r, heading: ANGLE[j.dir], air: { jump: r.next, from: r.t, to: r.t + (R.takeoff - s) / R.speed, down: what === 'fault' } };
}

export type Point = { x: number; y: number };
/**
 * The path the child drew, as the horse rides it: the points it has reached or passed drop off (the nearest of the
 * next few and all before it, once reached, and any reached after it), and it steers to the next one; null when the
 * path is used up.
 */
export function follow(r: Round, path: Point[]): { target: Point | null; path: Point[] } {
  const d = (p: Point) => Math.hypot(p.x - r.x, p.y - r.y);
  // only the next few points: where a drawn loop crosses itself, the later pass must not cut the loop short
  let near = -1;
  for (let i = 0; i < Math.min(path.length, 6); i++) if (near < 0 || d(path[i]) < d(path[near])) near = i;
  // reached, or behind the horse inside its tightest turn (it could only circle round such a point)
  const done = (p: Point) => d(p) < R.reach || (d(p) < R.speed / R.turn && (p.x - r.x) * Math.cos(r.heading) + (p.y - r.y) * Math.sin(r.heading) < 0);
  let rest = near >= 0 && done(path[near]) ? path.slice(near + 1) : path;
  while (rest.length && done(rest[0])) rest = rest.slice(1);
  return { target: rest[0] ?? null, path: rest };
}

/**
 * A rider who knows the way: where to point the finger, and whether this is the moment for "Hopp!". Rides each
 * jump from a point straight in front of it. For the tests and the Playwright round; the child steers themselves.
 */
export function autopilot(r: Round, c: Course, window = 0.03) {
  const j = c.jumps[r.air ? r.air.jump + 1 : r.next]; // in the air: already on to the next one
  if (!j) { const [fx, fy, fd] = c.finish; return { x: fx + Math.cos(ANGLE[fd]) * 30, y: fy + Math.sin(ANGLE[fd]) * 30, hopp: false }; }
  const a = ANGLE[j.dir], { s, lat } = rel(r.x, r.y, [j.x, j.y], j.dir), offset = takeOffOffset(r, c);
  const ux = Math.cos(a), uy = Math.sin(a), along = (d: number, side = 0) => ({ x: j.x + ux * d - uy * side, y: j.y + uy * d + ux * side });
  // on the jump's line and pointing its way: along the line and over it; otherwise first to an entry point well in
  // front of it (from there along the line); too close or past it: round in a wide loop
  const entry = along(-90), atEntry = Math.hypot(entry.x - r.x, entry.y - r.y) < 25;
  const onLine = s < 0 && Math.abs(lat) < 20 && Math.cos(r.heading - a) > 0.5;
  const p = onLine || atEntry ? along(Math.min(s + 50, 40)) : s < -60 ? entry : along(-150, lat >= 0 ? 60 : -60);
  const lo = A.fence + 10; // loop points stay inside the fence
  p.x = Math.max(lo, Math.min(A.w - lo, p.x)); p.y = Math.max(lo, Math.min(A.h - lo, p.y));
  return { ...p, hopp: offset !== null && Math.abs(offset) <= window };
}
