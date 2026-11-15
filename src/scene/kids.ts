/**
 * Riders as pixel figures (our own drawing): riding helmet, jacket, light breeches, boots and hair in one of four
 * styles. Pupils and the player's avatar are both drawn this way; small and big children differ in size.
 * Figures are drawn once per look and view into a little canvas, outlined like the LPC sprites, and cached.
 */
import { HAIR, HELMET, JACKET, type Kid, SKIN } from '../riders/look';

const OUTLINE = '#2a1a10', PANTS = '#efe6d0', BOOTS = '#2a1d14';

export type View = 'S' | 'N' | 'W' | 'E';

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
  const skin = SKIN[kid.skin], helmet = HELMET[kid.helmet], jacket = JACKET[kid.jacket], hair = HAIR[kid.hairColor], style = kid.hair;
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
  // the head: face, hair under the helmet in its style (ponytail, short, two pigtails, long)
  px(skin, hx, faceTop, headW, headH);
  px(shade(skin, 0.88), hx, faceTop + headH - 1, headW, 1); // chin shadow
  const temples = style === 'kurz' ? 2 : 4;
  if (view === 'S') {
    px(hair, hx, faceTop, 1, temples); px(hair, hx + headW - 1, faceTop, 1, temples); // hair at the temples
    if (style === 'lang') { px(hair, hx - 1, faceTop, 1, headH + 3); px(hair, hx + headW, faceTop, 1, headH + 3); }
    if (style === 'zoepfe') { px(hair, hx - 2, faceTop + 2, 2, 2); px(hair, hx + headW, faceTop + 2, 2, 2); px(hair, hx - 2, faceTop + 4, 1, 3); px(hair, hx + headW + 1, faceTop + 4, 1, 3); }
    px(OUTLINE, hx + 2, faceTop + 3, 1, 2); px(OUTLINE, hx + headW - 3, faceTop + 3, 1, 2); // eyes
    px('#ffffff', hx + 2, faceTop + 3); px('#ffffff', hx + headW - 3, faceTop + 3); // glints
    px('#f29a9a', hx + 1, faceTop + 5); px('#f29a9a', hx + headW - 2, faceTop + 5); // cheeks
    px(shade(skin, 0.7), mid - 1, faceTop + 6, 2, 1); // mouth
  } else if (view === 'N') {
    px(hair, hx, faceTop, headW, headH - 1);
    px(shade(hair, 1.3), hx + 2, faceTop + 1, 2, 2);
    if (style === 'zopf') px(hair, mid - 1, faceTop + headH - 1, 2, 4); // ponytail down the back
    if (style === 'lang') px(hair, hx, faceTop + headH - 1, headW, 4);
    if (style === 'zoepfe') { px(hair, hx - 1, faceTop + 3, 2, 5); px(hair, hx + headW - 1, faceTop + 3, 2, 5); }
  } else {
    const back = view === 'W' ? hx + headW - 3 : hx, front = view === 'W' ? hx + 1 : hx + headW - 2;
    px(hair, back, faceTop, 3, style === 'kurz' ? headH - 4 : headH - 2);
    const tail = view === 'W' ? hx + headW : hx - 2;
    if (style === 'zopf') px(hair, tail, faceTop + 2, 2, 4); // ponytail
    if (style === 'zoepfe') px(hair, tail, faceTop + 3, 2, 3);
    if (style === 'lang') px(hair, view === 'W' ? hx + headW - 3 : hx, faceTop + headH - 2, 3, 5);
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
  const key = `${JSON.stringify(kid)}:${view}:${step % 2}:${upper}`;
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
