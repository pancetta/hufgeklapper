import { describe, expect, it } from 'vitest';
import { bounds } from './buildings';
import { FOCUS, PLOTS } from './farm';

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

  it('has plots that do not overlap', () => {
    for (const a of PLOTS)
      for (const b of PLOTS)
        if (a !== b) expect(a.c1 < b.c0 || b.c1 < a.c0 || a.r1 < b.r0 || b.r1 < a.r0, `${a.id} / ${b.id}`).toBe(true);
  });
});
