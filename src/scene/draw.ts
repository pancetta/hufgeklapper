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
