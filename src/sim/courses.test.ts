import { describe, expect, it } from 'vitest';
import { courseFor, courseOf, rideable } from './courses';
import { DATA } from './data';

const A = DATA.jumping.arena, R = DATA.jumping.ride, CLASSES = ['E', 'A', 'L'] as const;

describe('courses that change', () => {
  it('builds a course per seed for every class: its jumps inside the fence, rideable clean in good time', () => {
    for (const cls of CLASSES)
      for (let seed = 1; seed <= 40; seed++) {
        const c = courseOf(cls, seed), name = `${cls} ${seed}`;
        expect(c.jumps, name).toHaveLength(DATA.jumping.courses[cls].jumps.length);
        expect(c.jumps.filter((j) => j.kind === 'oxer').length, name).toBeGreaterThanOrEqual(DATA.jumping.build.oxers[cls]);
        for (const j of c.jumps) {
          expect(j.x - R.half > A.fence && j.x + R.half < A.w - A.fence && j.y - R.half > A.fence && j.y + R.half < A.h - A.fence, name).toBe(true);
        }
        // start and finish clear of every jump
        for (const [x, y] of [c.start, c.finish]) expect(c.jumps.every((j) => Math.hypot(j.x - x, j.y - y) >= DATA.jumping.build.apart), name).toBe(true);
        expect(rideable(c), name).toBe(true);
        expect(c.height).toBe(DATA.jumping.height[cls]);
      }
  });

  it('gives the same course for the same seed, and other courses for other seeds', () => {
    expect(courseOf('A', 5)).toEqual(courseOf('A', 5));
    const layouts = new Set([...Array(20)].map((_, i) => JSON.stringify(courseOf('E', i + 1).jumps)));
    expect(layouts.size).toBeGreaterThan(15);
  });

  it('practice and the badge ride an E course, a show its class: higher classes, higher poles', () => {
    expect(courseFor('train', 'L', 3).jumps).toHaveLength(DATA.jumping.courses.E.jumps.length);
    expect(courseFor('show', 'L', 3).jumps).toHaveLength(DATA.jumping.courses.L.jumps.length);
    expect(DATA.jumping.height.E < DATA.jumping.height.A && DATA.jumping.height.A < DATA.jumping.height.L).toBe(true);
  });

  it('the fixed courses, the fallback, are rideable too, with start and finish clear of the jumps', () => {
    for (const cls of CLASSES) {
      const c = DATA.jumping.courses[cls];
      expect(rideable(c), cls).toBe(true);
      for (const [x, y] of [c.start, c.finish]) expect(c.jumps.every((j) => Math.hypot(j.x - x, j.y - y) >= DATA.jumping.build.apart), cls).toBe(true);
    }
  });
});
