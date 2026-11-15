/**
 * Riding pupils as pixel figures (our own drawing): riding helmet, jacket, light breeches, boots, and a
 * ponytail. Each pupil's look number picks skin, helmet, jacket and hair; small and big children differ in size.
 * Figures are drawn once per look and view into a little canvas, outlined like the LPC sprites, and cached.
 */
export type Kid = { size: 'small' | 'big'; look: number };
export type View = 'S' | 'N' | 'W' | 'E';

const SKIN = ['#f2d3b3', '#e8bf98', '#c99268', '#8d5a3b'];
const HELMET = ['#2b2b3a', '#2f4f9a', '#7a2b4f', '#2f6b3a'];
const JACKET = ['#d94f3d', '#3d6fd9', '#f2c14e', '#43a047', '#b05ec9', '#ff8fc7'];
const HAIR = ['#4a2f1a', '#e2c068', '#1e1a17', '#a0522d'];
const OUTLINE = '#2a1a10', PANTS = '#efe6d0', BOOTS = '#2a1d14';

const pick = <T>(list: T[], n: number) => list[n % list.length];
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16), c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

/**
 * Draws the figure (or only its upper body, for a rider) into a fresh canvas; the feet sit on its bottom row.
 * Chibi proportions like the LPC figures: a big head under the helmet, a short jacket, breeches and boots.
 */
function paint(kid: Kid, view: View, step: number, upper: boolean) {
  const big = kid.size === 'big', side = view === 'W' || view === 'E';
  const headW = 8, headH = 7, bodyW = big ? 10 : 8, bodyH = big ? 8 : 6, legH = big ? 8 : 6;
  const w = 14, h = 3 + headH + bodyH + legH; // 3 rows of helmet above the face
  const c = document.createElement('canvas');
  c.width = w + 2; c.height = h + 2;
  const g = c.getContext('2d')!;
  const n = kid.look, skin = pick(SKIN, n), helmet = pick(HELMET, n >> 2), jacket = pick(JACKET, n >> 4), hair = pick(HAIR, n >> 6);
  const px = (color: string, x: number, y: number, ww = 1, hh = 1) => { g.fillStyle = color; g.fillRect(x + 1, y + 1, ww, hh); };
  const mid = w / 2, hx = mid - headW / 2, faceTop = 3, bodyTop = faceTop + headH, legTop = bodyTop + bodyH, bx = mid - bodyW / 2;
  const dark = shade(jacket, 0.72), light = shade(jacket, 1.18);

  {
    // breeches and boots; a walking step moves one leg forward; a rider's legs hang down the horse's sides
    const legs = upper ? (side ? [mid - 1] : [bx - 2, bx + bodyW]) : side ? [mid - 2 + (step ? -1 : 1), mid] : [mid - 3, mid + 1];
    for (const [i, x] of legs.entries()) {
      const lift = step && !side && i === 1 ? 1 : 0;
      px(PANTS, x, legTop, 2, legH - 3 - lift);
      px(shade(PANTS, 0.85), x + 1, legTop, 1, legH - 3 - lift);
      px(BOOTS, x, h - 3 - lift, 2, 3);
      px('#5a4030', x, h - 3 - lift);
    }
  }
  // the jacket: a lighter front, a darker side, a white collar, arms at the sides with hands
  px(jacket, bx, bodyTop, bodyW, bodyH);
  px(light, bx + 1, bodyTop + 1, 2, bodyH - 2);
  px(dark, bx + bodyW - 2, bodyTop, 2, bodyH);
  if (view === 'S') { px('#ffffff', mid - 2, bodyTop, 4, 1); px(dark, mid - 1, bodyTop + 1, 1, bodyH - 1); }
  if (!side) {
    for (const x of [bx - 2, bx + bodyW]) { px(dark, x, bodyTop + 1, 2, bodyH - 2); px(skin, x, bodyTop + bodyH - 1, 2, 1); }
  } else px(skin, view === 'W' ? bx + 1 : bx + bodyW - 3, bodyTop + bodyH - 2, 2, 2);
  // the head: face, hair under the helmet, a ponytail at the back
  px(skin, hx, faceTop, headW, headH);
  px(shade(skin, 0.88), hx, faceTop + headH - 1, headW, 1); // chin shadow
  if (view === 'S') {
    px(hair, hx, faceTop, 1, 4); px(hair, hx + headW - 1, faceTop, 1, 4); // hair at the temples
    px(OUTLINE, hx + 2, faceTop + 3, 1, 2); px(OUTLINE, hx + headW - 3, faceTop + 3, 1, 2); // eyes
    px('#ffffff', hx + 2, faceTop + 3); px('#ffffff', hx + headW - 3, faceTop + 3); // glints
    px('#f29a9a', hx + 1, faceTop + 5); px('#f29a9a', hx + headW - 2, faceTop + 5); // cheeks
    px(shade(skin, 0.7), mid - 1, faceTop + 6, 2, 1); // mouth
  } else if (view === 'N') {
    px(hair, hx, faceTop, headW, headH - 1);
    px(shade(hair, 1.3), hx + 2, faceTop + 1, 2, 2);
    px(hair, mid - 1, faceTop + headH - 1, 2, 4); // ponytail down the back
  } else {
    const back = view === 'W' ? hx + headW - 3 : hx, front = view === 'W' ? hx + 1 : hx + headW - 2;
    px(hair, back, faceTop, 3, headH - 2);
    px(hair, view === 'W' ? hx + headW : hx - 2, faceTop + 2, 2, 4); // ponytail
    px(OUTLINE, front, faceTop + 3, 1, 2);
    px('#ffffff', front, faceTop + 3);
    px('#f29a9a', front + (view === 'W' ? 1 : -1), faceTop + 5);
  }
  // the riding helmet: a round shell with a shine, the peak over the eyes
  px(helmet, hx + 1, 0, headW - 2, 1);
  px(helmet, hx, 1, headW, 3);
  px(shade(helmet, 1.9), hx + 2, 1, 2, 1);
  px(shade(helmet, 1.4), hx + 1, 2, 1, 1);
  if (view === 'S') px(shade(helmet, 0.7), hx - 1, 3, headW + 2, 1);
  if (view === 'W') px(shade(helmet, 0.7), hx - 2, 3, 3, 1);
  if (view === 'E') px(shade(helmet, 0.7), hx + headW - 1, 3, 3, 1);
  // a dark outline around everything, like the LPC figures
  const d = g.getImageData(0, 0, c.width, c.height), a = (x: number, y: number) => d.data[(y * c.width + x) * 4 + 3];
  g.fillStyle = OUTLINE;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (!a(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < c.width && y + dy < c.height && a(x + dx, y + dy))) g.fillRect(x, y, 1, 1);
  return c;
}

const cache = new Map<string, HTMLCanvasElement>();
function figure(kid: Kid, view: View, step: number, upper = false) {
  const key = `${kid.size}:${kid.look}:${view}:${step % 2}:${upper}`;
  let c = cache.get(key);
  if (!c) cache.set(key, (c = paint(kid, view, step % 2, upper)));
  return c;
}

/** A standing or walking child, feet at (x, y). */
export function drawKid(ctx: CanvasRenderingContext2D, kid: Kid, x: number, y: number, view: View = 'S', step = 0) {
  const c = figure(kid, view, step);
  ctx.fillStyle = 'rgba(30, 40, 10, 0.22)';
  ctx.fillRect(Math.round(x - 5), Math.round(y - 1), 11, 2);
  ctx.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height + 1));
}

/** A child sitting on a horse, its seat at (x, y): the body above, the legs down the horse's sides. */
export function drawRider(ctx: CanvasRenderingContext2D, kid: Kid, x: number, y: number, view: View) {
  const c = figure(kid, view, 0, true), legs = kid.size === 'big' ? 8 : 6;
  ctx.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height + legs + 1));
}
