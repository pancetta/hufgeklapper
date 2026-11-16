import { describe, expect, it } from 'vitest';
import { DATA } from './data';
import { autopilot, type Course, hopp, newRound, type Round, step, takeOffOffset, timeAllowed } from './round';

const R = DATA.jumping.ride, DT = 1 / 60, E = DATA.jumping.courses.E;
const judge = (o: number) => (Math.abs(o) <= 0.06 ? 'clear' : o < -DATA.jumping.early ? 'early' : 'fault');
/** Rides with the autopilot until done (or a time limit), pressing "Hopp!" when `press` says so. */
function ride(c: Course, r = newRound(c), press = (a: ReturnType<typeof autopilot>, _r: Round) => a.hopp, until = (_r: Round) => false) {
  while (!r.done && r.t < 300 && !until(r)) {
    const a = autopilot(r, c);
    if (press(a, r)) r = hopp(r, c, judge);
    r = step(r, c, DT, a);
  }
  return r;
}

describe('a round on the show-jumping arena', () => {
  it('can be ridden clean on every course, well within the time allowed', () => {
    for (const [name, c] of Object.entries(DATA.jumping.courses)) {
      const r = ride(c);
      expect([name, r.done, r.faults, r.next]).toEqual([name, true, 0, c.jumps.length]);
      expect(r.t, name).toBeLessThan(timeAllowed(c) * 0.75);
    }
  });

  it('a late "Hopp!" knocks the pole: a fault, the jump still counts', () => {
    let late = false;
    const r = ride(E, newRound(E), (_a, x) => { const o = takeOffOffset(x, E); if (x.next === 0 && o !== null && o > 0.15 && !late) return (late = true); return _a.hopp && x.next > 0; });
    expect([r.done, r.faults, r.down]).toEqual([true, 1, [0]]);
  });

  it('without "Hopp!" the horse refuses the next jump: a fault, it stands, then turns round', () => {
    const r = ride(E, newRound(E), () => false, (x) => x.refused !== null);
    expect([r.refused, r.faults, r.stopped, r.x]).toEqual([0, 1, R.stop, expect.any(Number)]);
    expect(r.x).toBeLessThan(E.jumps[0].x); // still in front of the pole
    let after = r;
    for (let i = 0; i < Math.ceil(R.stop / DT) + 1; i++) after = step(after, E, DT, null);
    expect(Math.cos(after.heading)).toBeLessThan(-0.99); // turned round: now heading west
  });

  it('ridden too askew, "Hopp!" does nothing and the horse refuses', () => {
    // just before the first jump, at 45° to it
    const r: Round = { ...newRound(E), x: E.jumps[0].x - 20, y: E.jumps[0].y + 5, heading: -Math.PI / 4 };
    expect(takeOffOffset(r, E)).toBeNull();
    expect(hopp(r, E, judge)).toBe(r);
  });

  it('a jump out of turn stops the horse without a fault', () => {
    // in front of jump 2 while jump 1 is next
    const j = E.jumps[1], r = ride(E, { ...newRound(E), x: j.x - 30, y: j.y }, () => false, (x) => x.refused !== null);
    expect([r.refused, r.faults]).toEqual([1, 0]);
  });

  it('time faults: one for each started few seconds over the time allowed', () => {
    const allowed = timeAllowed(E), r = ride(E, { ...newRound(E), t: allowed }); // the clock already at the limit
    expect(r.faults).toBe(Math.ceil((r.t - allowed) / R.timeFault));
    expect(r.faults).toBeGreaterThan(1);
  });

  it('ends a round nobody rides: each jump left is a fault, and the time', () => {
    let r = newRound(E);
    while (!r.done) r = step(r, E, 0.1, null);
    expect(r.faults).toBeGreaterThanOrEqual(E.jumps.length + Math.ceil(R.giveUp / R.timeFault));
    // the fence kept the horse in
    expect(r.x).toBeGreaterThanOrEqual(DATA.jumping.arena.fence);
    expect(r.x).toBeLessThanOrEqual(DATA.jumping.arena.w - DATA.jumping.arena.fence);
  });

  it('the finish only counts after the last jump', () => {
    const [fx, fy, fd] = E.finish, before = { ...newRound(E), x: fx, y: fy - 10, heading: fd === 'S' ? Math.PI / 2 : 0 };
    let r = before;
    for (let i = 0; i < 30; i++) r = step(r, E, DT, null);
    expect(r.done).toBe(false);
    r = before; r = { ...r, next: E.jumps.length };
    for (let i = 0; i < 30; i++) r = step(r, E, DT, null);
    expect(r.done).toBe(true);
  });
});
