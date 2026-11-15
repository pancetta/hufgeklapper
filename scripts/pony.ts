/**
 * Derives a pony from an LPC horse sheet by moving pixels, never resampling, so the pixel art stays crisp.
 * Each 128px frame is measured on the base horse (the coat sheet), and the same edit is applied to every
 * layer of that frame (mane, socks), so layers stay aligned:
 * - legs: every 2nd pixel row between belly and hooves is removed (legs about half as long),
 * - body (side views only): every 2nd column in the middle third of the body is removed (shorter, stockier),
 * - mane layers grow by one pixel, and one more upwards (thicker, crested pony mane).
 * Shortening the neck as well was tried and dropped: the head then juts forward (see ADR-0003).
 */
export const FRAME = 128;
export type Dir = 'N' | 'W' | 'S' | 'E';
export type Image = { width: number; height: number; data: Uint8Array }; // RGBA

/** Direction of the frame at grid cell (col, row), per sheet layout. */
export type Layout = (col: number, row: number) => Dir;
const DIRS: Dir[] = ['N', 'W', 'S', 'E'];
export const byColumn: Layout = (col) => DIRS[col % 4]; // idle sheets: one frame per direction in a row
export const byRow: Layout = (_col, row) => DIRS[row % 4]; // walk/gallop/eat sheets: one direction per row

type Plan = { rows: number[]; cols: number[] };

function alpha(img: Image, x: number, y: number) {
  return img.data[(y * img.width + x) * 4 + 3];
}

export function planFrame(base: Image, fx: number, fy: number, dir: Dir): Plan {
  const all = Array.from({ length: FRAME }, (_, i) => i);
  const widths = all.map((y) => all.filter((x) => alpha(base, fx + x, fy + y)).length);
  const filled = all.filter((y) => widths[y]);
  if (!filled.length) return { rows: all, cols: all };
  const top = filled[0], bottom = filled[filled.length - 1];
  const side = dir === 'W' || dir === 'E';
  const widest = Math.max(...widths);
  const body = all.filter((y) => y >= top && y <= bottom && widths[y] >= (side ? 0.45 : 0.8) * widest);
  const belly = body.length ? body[body.length - 1] : (top + bottom) >> 1;
  const rows = all.filter((y) => !(y >= belly + 2 && y <= bottom - 3 && (y - belly) % 2 === 0));
  let cols = all;
  if (side) {
    const used = all.filter((x) => all.some((y) => y >= top && y <= belly && alpha(base, fx + x, fy + y)));
    const x0 = used[0], x1 = used[used.length - 1];
    const m0 = x0 + Math.floor(0.35 * (x1 - x0)), m1 = x0 + Math.floor(0.65 * (x1 - x0));
    cols = all.filter((x) => !(x >= m0 && x <= m1 && (x - m0) % 2 === 1));
  }
  return { rows, cols };
}

/** Plans for every frame of a sheet, measured on its base horse. */
export function planSheet(base: Image, layout: Layout) {
  const plans: { fx: number; fy: number; plan: Plan }[] = [];
  for (let fy = 0; fy < base.height; fy += FRAME)
    for (let fx = 0; fx < base.width; fx += FRAME)
      plans.push({ fx, fy, plan: planFrame(base, fx, fy, layout(fx / FRAME, fy / FRAME)) });
  return plans;
}

/** Applies the plans to one layer: kept rows/cols are packed bottom- and centre-aligned, so hooves stay put. */
export function applyPlans(src: Image, plans: ReturnType<typeof planSheet>, thickMane = false): Image {
  const out: Image = { width: src.width, height: src.height, data: new Uint8Array(src.data.length) };
  for (const { fx, fy, plan } of plans) {
    const dy = FRAME - plan.rows.length, dx = (FRAME - plan.cols.length) >> 1;
    plan.rows.forEach((y, j) => plan.cols.forEach((x, i) => {
      const s = ((fy + y) * src.width + fx + x) * 4, t = ((fy + dy + j) * src.width + fx + dx + i) * 4;
      out.data.set(src.data.subarray(s, s + 4), t);
    }));
  }
  return thickMane ? growUp(grow(out)) : out;
}

/** One-pixel dilation: each empty pixel takes the colour of its first filled neighbour (below, right, left, above). */
function grow(img: Image): Image {
  const { width: w, height: h, data } = img, out = new Uint8Array(data);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const t = (y * w + x) * 4;
      if (data[t + 3]) continue;
      for (const [nx, ny] of [[x, y + 1], [x + 1, y], [x - 1, y], [x, y - 1]]) {
        const s = (ny * w + nx) * 4;
        if (data[s + 3]) { out.set(data.subarray(s, s + 4), t); break; }
      }
    }
  return { width: w, height: h, data: out };
}

/** Grows filled pixels one row upwards (a crested mane). */
function growUp(img: Image): Image {
  const { width: w, height: h, data } = img, out = new Uint8Array(data);
  for (let y = 0; y < h - 1; y++)
    for (let x = 0; x < w; x++) {
      const t = (y * w + x) * 4, s = t + w * 4;
      if (!data[t + 3] && data[s + 3]) out.set(data.subarray(s, s + 4), t);
    }
  return { width: w, height: h, data: out };
}
