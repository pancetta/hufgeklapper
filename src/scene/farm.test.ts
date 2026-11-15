import { describe, expect, it } from 'vitest';
import { bounds, waitingSpots } from './buildings';
import { FOCUS, PLOTS, WINDMILL } from './farm';

describe('farm layout', () => {
  // the smallest view: an 11" iPad in landscape at 2× (1180×820 CSS px)
  const view = { x0: FOCUS.x - 295, y0: FOCUS.y - 205, x1: FOCUS.x + 295, y1: FOCUS.y + 205 };

  it('shows every plot, free ones included, on the smallest iPad view', () => {
    const outside = PLOTS.filter((p) => {
      const b = bounds(p);
      return b.x0 < view.x0 || b.y0 < view.y0 || b.x1 > view.x1 || b.y1 > view.y1;
    });
    expect(outside.map((p) => p.id)).toEqual([]);
  });

  it('shows the windmill with its blades, and the waiting pupils, on the smallest view, clear of the plots', () => {
    const arena = PLOTS.find((p) => p.building === 'arena')!;
    // the windmill reaches 72 px up (blades 64 wide); a pupil with its name label about 40 px
    const things = [[WINDMILL.x - 32, WINDMILL.y - 72, WINDMILL.x + 32, WINDMILL.y], ...waitingSpots(arena).map(([x, y]) => [x - 8, y - 40, x + 8, y])];
    for (const [x0, y0, x1, y1] of things) expect(x0 >= view.x0 && y0 >= view.y0 && x1 <= view.x1 && y1 <= view.y1, `${x0},${y0}`).toBe(true);
    const foot = PLOTS.find((p) => { const b = bounds(p); return WINDMILL.x >= b.x0 && WINDMILL.x < b.x1 && WINDMILL.y >= b.y0 && WINDMILL.y < b.y1; });
    expect(foot).toBeUndefined();
  });

  it('has plots that do not overlap', () => {
    for (const a of PLOTS)
      for (const b of PLOTS)
        if (a !== b) expect(a.c1 < b.c0 || b.c1 < a.c0 || a.r1 < b.r0 || b.r1 < a.r0, `${a.id} / ${b.id}`).toBe(true);
  });
});
