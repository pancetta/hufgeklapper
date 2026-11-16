/** Image loading and the few pixel-art drawing helpers the scenes share. */
export type Rect = readonly [x: number, y: number, w: number, h: number];

const cache = new Map<string, Promise<HTMLImageElement>>();
/** Loads public/assets/<path> once. */
export function image(path: string) {
  let p = cache.get(path);
  if (!p) {
    p = new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => fail(new Error(`missing asset ${path}`));
      img.src = `${import.meta.env.BASE_URL}assets/${path}`;
    });
    cache.set(path, p);
  }
  return p;
}

/** Draws a source rectangle at whole pixels, optionally mirrored. */
export function blit(ctx: CanvasRenderingContext2D, img: CanvasImageSource, [sx, sy, w, h]: Rect, x: number, y: number, flip = false) {
  x = Math.round(x); y = Math.round(y);
  if (!flip) return ctx.drawImage(img, sx, sy, w, h, x, y, w, h);
  ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  ctx.restore();
}

/** A soft ground shadow as stacked pixel rows (crisp at any scale), centred at (cx, cy). */
export function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, alpha = 0.22) {
  ctx.fillStyle = `rgba(30, 40, 10, ${alpha})`;
  for (let dy = -ry; dy <= ry; dy++) {
    const w = Math.round(rx * Math.sqrt(1 - (dy / (ry + 0.5)) ** 2));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2, 1);
  }
}

/* the show jumps' parts, from above (our own drawing): on the jumping arena and the farm's arena */
/** A striped pole from (x0, y0) to (x1, y1), its shadow `drop` pixels lower on the sand. */
export function pole(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, colour: string, drop = 6) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (drop) { ctx.fillStyle = 'rgba(60, 40, 10, 0.25)'; ctx.fillRect(x + 1, y + drop, 2, 2); }
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 1, y - 1, 3, 3);
  }
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    ctx.fillStyle = Math.floor(i / 5) % 2 ? colour : '#ffffff'; ctx.fillRect(x, y, 1, 1);
  }
}

/** A white standard with coloured bands, standing on the sand at (x, y). */
export function standard(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string, tall = 11) {
  ctx.fillStyle = 'rgba(60, 40, 10, 0.25)'; ctx.fillRect(x - 1, y, 5, 2);
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 2, y - tall, 5, tall + 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - tall + 1, 3, tall - 1);
  ctx.fillStyle = colour;
  for (let b = 4; b < tall - 1; b += 4) ctx.fillRect(x - 1, y - b, 3, 2); // coloured bands all the way up
}
