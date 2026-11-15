/**
 * Puts a glint into each horse eye, which makes the sprites look alive and cute.
 * An LPC horse eye is a tiny cluster of very dark pixels inside the coat of the head; the outline is just as dark
 * but always touches transparent pixels. So in each frame's head we look for dark pixels whose 8 neighbours are all
 * opaque and mostly brighter (below the ears), and light up the most contrasting one per eye. Frames seen from
 * behind (north) have no eyes.
 */
import { FRAME, type Dir, type Image, type Layout } from './pony.ts';

const GLINT = [255, 251, 232, 255];
const lum = (d: Uint8Array, i: number) => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;

/** Eye pixels in one frame: [x, y] in sheet coordinates, at most one per eye (two seen from the front). */
export function findEyes(img: Image, fx: number, fy: number, dir: Dir): [number, number][] {
  if (dir === 'N') return [];
  const { width: w, data } = img;
  const at = (x: number, y: number) => (y * w + x) * 4;
  let x0 = FRAME, x1 = -1, y0 = FRAME, y1 = -1;
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++)
      if (data[at(fx + x, fy + y) + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return [];
  const bw = x1 - x0, bh = y1 - y0;
  // the head: front third of the body seen from the side, upper middle seen from the front
  const [hx0, hx1] = dir === 'W' ? [x0, x0 + bw * 0.35] : dir === 'E' ? [x1 - bw * 0.35, x1] : [x0 + bw * 0.15, x1 - bw * 0.15];
  // skip the ears at the very top of the head
  const hy0 = y0 + Math.max(4, Math.round(bh * 0.14)), hy1 = y0 + bh * (dir === 'S' ? 0.22 : 0.3); // eyes sit high; nostrils and jaw are lower
  const found: { x: number; y: number; contrast: number }[] = [];
  for (let y = Math.ceil(hy0); y <= hy1; y++)
    for (let x = Math.ceil(hx0); x <= hx1; x++) {
      const sx = fx + x, sy = fy + y, i = at(sx, sy), l = lum(data, i);
      if (!data[i + 3] || l > 110) continue;
      let brighter = 0, open = false, around = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const j = at(sx + dx, sy + dy);
          if (!data[j + 3]) open = true;
          else { around += lum(data, j); if (lum(data, j) > l + 25) brighter++; }
        }
      // on a very dark coat the eye doesn't stand out, so leave it alone
      if (!open && brighter >= 5 && around / 8 > 70) found.push({ x: sx, y: sy, contrast: around / 8 - l });
    }
  // strongest first; one pixel per eye
  const eyes: [number, number][] = [];
  for (const e of found.sort((a, b) => b.contrast - a.contrast))
    if (!eyes.some(([ex, ey]) => Math.abs(ex - e.x) <= 3 && Math.abs(ey - e.y) <= 2)) eyes.push([e.x, e.y]);
  return eyes.slice(0, dir === 'S' ? 2 : 1);
}

/** A copy of the sheet with a glint in every eye found. */
export function shineEyes(img: Image, layout: Layout): Image {
  const out: Image = { ...img, data: new Uint8Array(img.data) };
  for (let fy = 0; fy < img.height; fy += FRAME)
    for (let fx = 0; fx < img.width; fx += FRAME)
      for (const [x, y] of findEyes(img, fx, fy, layout(fx / FRAME, fy / FRAME))) out.data.set(GLINT, (y * img.width + x) * 4);
  return out;
}
