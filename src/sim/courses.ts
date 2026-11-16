/**
 * Courses that change (#56): a course built from a seed, so practice, the badge and shows don't ride the same three
 * layouts. It starts at the fence; each jump follows the last straight on or after a quarter turn, with room for
 * the turn and a straight run-in; the finish comes after the last jump. Every course built is ridden first by the
 * round's autopilot: only one it rides clean and in good time, without running into a jump out of turn, is used.
 * After `tries` misses the class's fixed course is the fallback.
 */
import { DATA } from './data';
import { ANGLE, autopilot, type Course, type CourseJump, type Dir, hopp, newRound, step, timeAllowed } from './round';
import { roll } from './state';

type ShowClass = keyof typeof DATA.jumping.courses;
const A = DATA.jumping.arena, R = DATA.jumping.ride, G = DATA.jumping.build;
const TURN: Record<Dir, [left: Dir, right: Dir]> = { E: ['N', 'S'], S: ['E', 'W'], W: ['S', 'N'], N: ['W', 'E'] };
const across = (d: Dir) => d === 'E' || d === 'W';

/** Whether a jump at (x, y), ridden `dir`, keeps its poles and run-in clear of the fence. */
function fits(x: number, y: number, dir: Dir) {
  const m = A.fence + R.half + 8; // the poles' ends clear of the fence
  const [lx, ly] = across(dir) ? [G.runIn, m] : [m, G.runIn]; // and room to ride in and land
  return x >= lx && x <= A.w - lx && y >= ly && y <= A.h - ly;
}

/**
 * One try at a course for `cls` with the random numbers from `seed`; null if no layout fits the arena. Each jump is
 * placed after the last one; where none fits, the search goes back and moves the jump before (up to `budget` places).
 */
export function build(cls: ShowClass, seed: number): [Course | null, number] {
  let r: number;
  const rnd = () => { [r, seed] = roll(seed); return r; }, between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const n = DATA.jumping.courses[cls].jumps.length, oxers = G.oxers[cls];
  // the start: at the middle of one fence, riding into the arena
  const dir0 = (['E', 'W', 'S', 'N'] as const)[Math.floor(rnd() * 4)];
  const sx = Math.round(dir0 === 'E' ? 40 : dir0 === 'W' ? A.w - 40 : between(120, A.w - 120));
  const sy = Math.round(dir0 === 'S' ? 40 : dir0 === 'N' ? A.h - 40 : between(80, A.h - 80));
  const jumps: CourseJump[] = [], m = A.fence + R.half * 1.5 + 4;
  let budget = G.budget, finish: Course['finish'] | null = null;
  const clear = (x: number, y: number) => Math.hypot(sx - x, sy - y) >= G.apart && jumps.every((j) => Math.hypot(j.x - x, j.y - y) >= G.apart);
  function place(x: number, y: number, dir: Dir): boolean {
    if (jumps.length === n) {
      // the finish: straight on after the last jump, or after a quarter turn; inside the fence, clear of the jumps
      for (const d of [dir, ...TURN[dir]] as Dir[]) {
        const turned = d !== dir, f = turned ? 70 : 50, g = turned ? 50 : 0;
        const fx = Math.round(x + Math.cos(ANGLE[dir]) * g + Math.cos(ANGLE[d]) * f), fy = Math.round(y + Math.sin(ANGLE[dir]) * g + Math.sin(ANGLE[d]) * f);
        if (fx >= m && fx <= A.w - m && fy >= m && fy <= A.h - m && jumps.every((j) => Math.hypot(j.x - fx, j.y - fy) >= G.apart)) { finish = [fx, fy, d]; return true; }
      }
      return false;
    }
    // straight on, or a quarter turn with room for it; mostly towards the middle of the arena, where there is room
    const [left, right] = TURN[dir], toMiddle = (d: Dir) => Math.cos(ANGLE[d]) * (A.w / 2 - x) + Math.sin(ANGLE[d]) * (A.h / 2 - y);
    const [inward, outward] = toMiddle(left) >= toMiddle(right) ? [left, right] : [right, left];
    for (let k = 0; k < 6 && budget > 0; k++) {
      budget--;
      const turn = rnd(), next: Dir = turn < 0.3 ? dir : turn < 0.85 ? inward : outward;
      const [ux, uy] = [Math.cos(ANGLE[dir]), Math.sin(ANGLE[dir])], [vx, vy] = [Math.cos(ANGLE[next]), Math.sin(ANGLE[next])];
      const [ahead, along] = next === dir ? [0, between(G.straight[0], G.straight[1])] : [between(G.ahead[0], G.ahead[1]), between(G.turn[0], G.turn[1])];
      const jx = Math.round(x + ux * ahead + vx * along), jy = Math.round(y + uy * ahead + vy * along);
      if (!fits(jx, jy, next) || !clear(jx, jy)) continue;
      jumps.push({ x: jx, y: jy, dir: next, kind: 'upright' });
      if (place(jx + vx * R.takeoff, jy + vy * R.takeoff, next)) return true;
      jumps.pop(); // a dead end further on: try this jump somewhere else
    }
    return false;
  }
  if (!place(sx, sy, dir0) || !finish) return [null, seed];
  // the kinds: so many oxers, the rest crosses and uprights, spread over the course
  const kinds = jumps.map((_, i): CourseJump['kind'] => (i < oxers ? 'oxer' : rnd() < 0.5 ? 'cross' : 'upright')).sort(() => rnd() - 0.5);
  jumps.forEach((j, i) => { j.kind = kinds[i]; });
  return [{ start: [sx, sy, dir0], finish, jumps }, seed];
}

/** Whether the autopilot rides `c` clean, without a refusal (no jump in the way), in at most `share` of the time allowed. */
export function rideable(c: Course, share = G.share) {
  let r = newRound(c);
  const judge = (o: number) => (Math.abs(o) <= 0.06 ? 'clear' : o < -DATA.jumping.early ? 'early' : 'fault');
  while (!r.done && r.t < timeAllowed(c)) {
    const a = autopilot(r, c);
    if (a.hopp) r = hopp(r, c, judge);
    r = step(r, c, 1 / 60, a);
    if (r.refused !== null) return false;
  }
  return r.done && r.faults === 0 && r.t <= timeAllowed(c) * share;
}

/** A course for class `cls` from `seed`: built and ridden first; the fixed course if none passes. */
export function courseOf(cls: ShowClass, seed: number): Course {
  for (let i = 0; i < G.tries; i++) {
    const [c, next] = build(cls, seed);
    seed = next;
    if (c && rideable(c)) return { ...c, height: DATA.jumping.height[cls] };
  }
  return { ...DATA.jumping.courses[cls], height: DATA.jumping.height[cls] };
}

/** Practice and the riding badge ride an E course, a show its class's; `seed` makes each round's course its own. */
export const courseFor = (kind: 'train' | 'badge' | 'show', showClass: ShowClass, seed: number) => courseOf(kind === 'show' ? showClass : 'E', seed);
