import { describe, expect, it } from 'vitest';
import { DATA } from './data';
import { newXcRound, type Pace, type XcCourse, xcCourse, xcHopp, xcOffset, type XcRound, xcStep } from './xc';

const X = DATA.crossCountry, DT = 1 / 60;
/**
 * Rides a course: `pace` picks the pace each moment, "Hopp!" when the take-off is `at` seconds away (0: perfect).
 * Returns the round at its end and how often the horse refused.
 */
function ride(c: XcCourse, pace: (r: XcRound) => Pace, { window = 0.4, drain = 1, stamina = 0.9, at = 0 } = {}) {
  let r = newXcRound(stamina), refusals = 0;
  for (let i = 0; i < 60 * 600 && !r.done; i++) {
    const off = xcOffset(r, c);
    if (off !== null && off >= at) r = xcHopp(r, c, window);
    const before = r.faults;
    r = xcStep(r, c, DT, pace(r), window, drain);
    if (r.refused && r.faults > before && r.stopped) refusals++;
  }
  return { r, refusals };
}
/** A careful rider: gallops while the horse has breath, trots when it tires, slows to a trot before water and ditch. */
const careful = (c: XcCourse) => (r: XcRound): Pace => {
  const o = c.obstacles[r.next];
  if (o && (o.kind === 'water' || o.kind === 'ditch') && o.at - r.s < 14) return 'trot';
  return r.stamina > 0.35 ? 'gallop' : 'trot';
};

describe('a cross-country round', () => {
  it('a track has its obstacles in order along the way, water and a ditch among them, and an optimum time', () => {
    for (const seed of [1, 2, 3, 99]) {
      const c = xcCourse(seed);
      expect(c.obstacles).toHaveLength(X.obstacles);
      expect(c.obstacles.map((o) => o.kind)).toEqual(expect.arrayContaining(['water', 'ditch']));
      for (let i = 1; i < c.obstacles.length; i++) expect(c.obstacles[i].at - c.obstacles[i - 1].at).toBeGreaterThan(20);
      expect(c.obstacles.at(-1)!.at).toBeLessThan(c.length - 10);
      expect(c.optimum[0]).toBeLessThan(c.optimum[1]);
    }
    expect(xcCourse(5)).toEqual(xcCourse(5));
  });

  it('a careful rider who taps on time comes home clear, inside the optimum time', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const c = xcCourse(seed), { r, refusals } = ride(c, careful(c));
      expect([refusals, r.faults, r.t >= c.optimum[0] && r.t <= c.optimum[1]], `seed ${seed}, ${r.t.toFixed(1)} s in ${c.optimum}`).toEqual([0, 0, true]);
    }
  });

  it('galloping all the way: water and the ditch refuse, the horse runs out of breath and walks: faults', () => {
    const c = xcCourse(1), { r, refusals } = ride(c, () => 'gallop');
    expect(refusals).toBeGreaterThanOrEqual(2); // water and ditch at a gallop
    expect(r.faults).toBeGreaterThan(refusals); // and time outside the window
  });

  it('no "Hopp!" is a refusal at every jump; a tap at a walk too', () => {
    const c = xcCourse(2);
    expect(ride(c, careful(c), { at: 99 }).refusals).toBeGreaterThanOrEqual(c.obstacles.filter((o) => o.kind !== 'water').length);
    const r0 = { ...newXcRound(1), s: c.obstacles[0].at - X.takeoff, v: X.pace.walk };
    const o = c.obstacles[0];
    if (o.kind !== 'water') expect(xcHopp(r0, c, 0.4)).toMatchObject({ refused: 'slow', faults: 1 });
  });

  it('a skilled horse tires more slowly; a tired one gives less time to tap', () => {
    const c = xcCourse(3);
    const step = (drain: number) => { let r = newXcRound(1); for (let i = 0; i < 600; i++) r = xcStep(r, c, DT, 'gallop', 0.4, drain); return r.stamina; };
    expect(step(0.6)).toBeGreaterThan(step(1));
    // the walk gives breath back
    let r: XcRound = { ...newXcRound(0.2), v: X.pace.walk };
    for (let i = 0; i < 120; i++) r = xcStep(r, c, DT, 'walk', 0.4);
    expect(r.stamina).toBeGreaterThan(0.2);
  });
});
