import { describe, expect, it } from 'vitest';
import { applyPlans, byRow, FRAME, type Image, planSheet } from './pony';

/** A one-frame sheet with a simple side-view "horse": a 60×20 body on four 40px legs, hooves at the frame bottom. */
function horse(): Image {
  const img: Image = { width: FRAME, height: FRAME, data: new Uint8Array(FRAME * FRAME * 4) };
  const fill = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) img.data.set([120, 70, 30, 255], (y * FRAME + x) * 4);
  };
  fill(34, 60, 60, 20); // body
  for (const x of [36, 44, 80, 88]) fill(x, 80, 4, 40); // legs, hooves at y = 119
  return img;
}

const opaque = (img: Image) => {
  const ys: number[] = [], xs: number[] = [];
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) { ys.push(Math.floor(i / 4 / img.width)); xs.push((i >> 2) % img.width); }
  return { top: Math.min(...ys), bottom: Math.max(...ys), left: Math.min(...xs), right: Math.max(...xs) };
};

describe('pony derivation', () => {
  // byRow puts row 0 facing north; use a layout that says "side" for this single frame.
  const side = () => 'W' as const;

  it('shortens the legs and the body but keeps the hooves on the ground', () => {
    const base = horse(), pony = applyPlans(base, planSheet(base, side));
    const b = opaque(base), p = opaque(pony);
    expect(p.bottom).toBe(b.bottom);
    expect(b.bottom - b.top - (p.bottom - p.top)).toBeGreaterThan(15); // legs about half as long
    expect(p.right - p.left).toBeLessThan(b.right - b.left); // shorter body
  });

  it('gives the same pixels for the same input', () => {
    const base = horse();
    expect(applyPlans(base, planSheet(base, side)).data).toEqual(applyPlans(base, planSheet(base, side)).data);
  });

  it('leaves front views as wide as before', () => {
    const base = horse(), p = opaque(applyPlans(base, planSheet(base, byRow))), b = opaque(base);
    expect(p.right - p.left).toBe(b.right - b.left);
  });

  it('grows a mane layer by a pixel', () => {
    const base = horse(), plans = planSheet(base, side);
    const count = (img: Image) => img.data.filter((v, i) => i % 4 === 3 && v).length;
    expect(count(applyPlans(base, plans, true))).toBeGreaterThan(count(applyPlans(base, plans)));
  });
});
