import { describe, expect, it } from 'vitest';
import { stack } from './store';

// logical store sizes as the scene computes them on the smallest and the largest iPad (4 CSS px per pixel)
const SIZES = [{ W: 256, H: 192, panel: (360 + 32) / 4 }, { W: 341, H: 256, panel: (360 + 32) / 4 }];

describe('the bale stack in the feed store', () => {
  it('has a spot for every bale in the store, left of the panel, between the beam and the floor', () => {
    for (const { W, H, panel } of SIZES)
      for (const n of [0, 1, 10, 45, 120, 300]) {
        const floor = Math.round(H * 0.82), spots = stack(n, W, floor, panel);
        expect(spots, `${n} bales at ${W}`).toHaveLength(n);
        for (const p of spots) {
          expect(p.x + 24, `${n} bales at ${W}`).toBeLessThanOrEqual(W - panel);
          expect(p.y).toBeGreaterThanOrEqual(30);
          expect(p.y + 14).toBeLessThanOrEqual(floor);
        }
      }
  });

  it('stacks bales like bricks from the floor up', () => {
    const spots = stack(20, 256, 157, 98), second = spots.find((p) => p.y < spots[0].y)!;
    expect(second.y).toBe(spots[0].y - 13); // the second row lies on the first
    expect(second.x - spots[0].x).toBe(12); // half a bale further in
  });
});
