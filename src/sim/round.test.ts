import { describe, expect, it } from 'vitest';
import { DATA } from './data';
import { autopilot, type Course, follow, hopp, touchDown, newRound, type Round, step, takeOffOffset, timeAllowed } from './round';

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

  it('a rider who misses "Hopp!" once, at any jump, still gets round long before the round is given up', () => {
    for (const [name, c] of Object.entries(DATA.jumping.courses))
      for (let miss = 0; miss < c.jumps.length; miss++) {
        let missed = false;
        const r = ride(c, newRound(c), (a, x) => { if (a.hopp && x.next === miss && !missed) { missed = takeOffOffset(x, c)! > 0; return false; } return a.hopp; });
        expect([name, miss, r.done, r.next]).toEqual([name, miss, true, c.jumps.length]);
        expect(r.t, `${name} jump ${miss + 1}`).toBeLessThan(timeAllowed(c) + 15);
      }
  });

  it('rides the drawn path: reached points drop off, passed ones too, then it steers to the next', () => {
    const r: Round = { ...newRound(E), x: 100, y: 100 };
    const path = [{ x: 60, y: 100 }, { x: 95, y: 100 }, { x: 105, y: 100 }, { x: 140, y: 100 }, { x: 140, y: 140 }];
    expect(follow(r, path)).toEqual({ target: { x: 140, y: 100 }, path: path.slice(3) }); // 60 lies behind, 95 and 105 are reached
    expect(follow(r, [{ x: 200, y: 100 }])).toEqual({ target: { x: 200, y: 100 }, path: [{ x: 200, y: 100 }] });
    expect(follow(r, [{ x: 104, y: 100 }]).target).toBeNull(); // used up: straight on
    // a drawn curve is ridden closely: an L-shaped path, the horse ends near its corner's leg
    let h: Round = { ...newRound(E), x: 100, y: 200, heading: 0 }, p = [...Array(40)].map((_, i) => (i < 20 ? { x: 100 + i * 4, y: 200 } : { x: 180, y: 200 - (i - 19) * 4 }));
    let far = 0;
    while (p.length && h.t < 3) { const f = follow(h, p); p = f.path; h = step(h, E, DT, f.target); far = Math.max(far, Math.min(...[...Array(40)].map((_, i) => (i < 20 ? Math.hypot(h.x - 100 - i * 4, h.y - 200) : Math.hypot(h.x - 180, h.y - 200 + (i - 19) * 4))))); }
    expect(far).toBeLessThan(25); // never more than a pony's width off the line
  });

  it('a tap counts from when the finger touched down', () => {
    // lined up for jump 1, the tap's touch exactly at the perfect take-off, lifted 0.1 s later
    const j = E.jumps[0], at: Round = { ...newRound(E), x: j.x - R.takeoff + 0.1 * R.speed, y: j.y, heading: 0 };
    expect(hopp(at, E, judge, 0.1).air?.down).toBe(false);
    expect(hopp(at, E, judge).air?.down).toBe(true); // judged at the lift it would be late
  });

  it('a touch on time or late takes off at once; an earlier one waits to see if it is a tap', () => {
    const j = E.jumps[0], at = (offset: number): Round => ({ ...newRound(E), x: j.x - R.takeoff + offset * R.speed, y: j.y, heading: 0 });
    expect(touchDown(at(0), E, judge).air?.down).toBe(false); // on time: clear
    expect(touchDown(at(0.15), E, judge).air?.down).toBe(true); // late: a knocked pole, not a refusal
    expect(touchDown(at(-0.3), E, judge)).toEqual(at(-0.3)); // early: maybe the start of a stroke
    expect(touchDown(at(-1), E, judge)).toEqual(at(-1));
  });

  /** Rides `path` from `r` for `secs`; returns the horse's positions. */
  const along = (r: Round, path: { x: number; y: number }[], secs: number) => {
    const seen: Round[] = [];
    for (let i = 0; i < secs / DT; i++) { const f = follow(r, path); path = f.path; r = step(r, E, DT, f.target); seen.push(r); }
    return seen;
  };

  it('rides a drawn loop instead of cutting it where it crosses itself', () => {
    const lasso = [...[...Array(20)].map((_, i) => ({ x: 100 + i * 4, y: 150 })),
      ...[...Array(40)].map((_, i) => ({ x: 180 + 30 * Math.sin((i / 40) * 2 * Math.PI), y: 120 + 30 * Math.cos((i / 40) * 2 * Math.PI) })),
      ...[...Array(20)].map((_, i) => ({ x: 184 + i * 4, y: 150 }))];
    const seen = along({ ...newRound(E), x: 100, y: 150, heading: 0 }, lasso, 4);
    expect(Math.min(...seen.map((h) => h.y))).toBeLessThan(100); // up round the loop (its top at y 90)
  });

  it('gives up a point it could only circle: inside its tightest turn, or beyond the fence', () => {
    const hook = along({ ...newRound(E), x: 200, y: 150, heading: 0 }, [{ x: 200, y: 163 }], 3);
    expect(hook[hook.length - 1].x).toBeGreaterThan(300); // rode on
    const fence = along({ ...newRound(E), x: 440, y: 150, heading: 0 }, [{ x: 472, y: 150 }, { x: 476, y: 150 }], 4);
    expect(Math.min(...fence.slice(-30).map((h) => Math.abs(h.y - 150)))).toBeGreaterThan(20); // not sliding along the fence forever
  });

  it('with no finger down, the horse does not stay in a corner', () => {
    let r: Round = { ...newRound(E), x: 455, y: 279, heading: 0 };
    for (let i = 0; i < 120; i++) r = step(r, E, DT, null);
    expect(Math.hypot(r.x - 460, r.y - 280)).toBeGreaterThan(40);
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
    const j = E.jumps[1];
    let r: Round = { ...newRound(E), x: j.x - 30, y: j.y };
    while (r.refused === null && r.t < 2) r = step(r, E, DT, null); // straight on, no finger
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
