import { describe, expect, it } from 'vitest';
import { random, type Walker, walker, wander } from './life';

describe('the herd on the pasture', () => {
  const area = [100, 100, 260, 200] as const;
  /** Three horses wandering for ten minutes of game time, in steps of 1/20 s. */
  function run(seed: number) {
    const rnd = random(seed), herd = [0, 1, 2].map(() => walker(area, rnd)), seen = new Set<string>();
    let outside = 0;
    for (let i = 0; i < 12000; i++)
      for (const w of herd) {
        wander(w, area, 16, 0.05, rnd, true, herd);
        if (w.x < area[0] || w.x > area[2] || w.y < area[1] || w.y > area[3]) outside++;
        seen.add(w.dir).add(w.mode);
      }
    return { herd: herd.map((w: Walker) => [Math.round(w.x), Math.round(w.y)]), outside, seen };
  }

  it('walks the same way from the same seed', () => {
    expect(run(7).herd).toEqual(run(7).herd);
    expect(run(7).herd).not.toEqual(run(8).herd);
  });

  it('stays inside the fence, walks in all four directions, stands and grazes', () => {
    const { outside, seen } = run(3);
    expect(outside).toBe(0);
    expect([...seen].sort()).toEqual(['E', 'N', 'S', 'W', 'eat', 'stand', 'walk']);
  });
});
