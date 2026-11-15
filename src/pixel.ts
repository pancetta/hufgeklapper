/** Logical screen size every scene is laid out for; the screen gets the largest whole-number scale of it. */
export const BASE = { width: 400, height: 300 };

/**
 * Whole-number pixel scale for a viewport, so pixel art stays crisp, and the logical size that fills
 * the viewport at that scale (scenes lay out against `width`/`height`, never against CSS pixels).
 */
export function fitPixels(viewWidth: number, viewHeight: number) {
  const scale = Math.max(1, Math.floor(Math.min(viewWidth / BASE.width, viewHeight / BASE.height)));
  return { scale, width: Math.floor(viewWidth / scale), height: Math.floor(viewHeight / scale) };
}
