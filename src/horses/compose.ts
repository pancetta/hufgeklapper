/**
 * Composes a horse's layers into one sheet per look and animation (ADR-0002). The pixel work is a pure
 * function on RGBA arrays, so tests run it on the real sheets; the browser wraps it with canvas and a cache.
 */
import { type Anim, layers, type Look } from './look';

export type Pixels = { width: number; height: number; data: Uint8ClampedArray | Uint8Array };

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

/** Paints `layer` over `base` (source-over). With a tint, the layer's light and shade keep, its colour becomes the tint. */
export function paintOver(base: Pixels, layer: Pixels, tint?: string) {
  const [tr, tg, tb] = tint ? hex(tint) : [0, 0, 0];
  const b = base.data, l = layer.data;
  for (let i = 0; i < l.length; i += 4) {
    const a = l[i + 3] / 255;
    if (!a) continue;
    let r = l[i], g = l[i + 1], bl = l[i + 2];
    if (tint) {
      const light = (r * 0.3 + g * 0.59 + bl * 0.11) / 160; // the pad's mid tone maps to the tint itself
      r = Math.min(255, tr * light); g = Math.min(255, tg * light); bl = Math.min(255, tb * light);
    }
    const ba = b[i + 3] / 255, out = a + ba * (1 - a);
    b[i] = (r * a + b[i] * ba * (1 - a)) / out;
    b[i + 1] = (g * a + b[i + 1] * ba * (1 - a)) / out;
    b[i + 2] = (bl * a + b[i + 2] * ba * (1 - a)) / out;
    b[i + 3] = out * 255;
  }
}

/** All layers of a look painted into one new sheet; `load` gives a layer sheet's pixels. */
export async function composeSheet(look: Look, anim: Anim, load: (path: string) => Promise<Pixels>): Promise<Pixels> {
  const [first, ...rest] = layers(look, anim);
  const base = await load(first.path);
  const out: Pixels = { width: base.width, height: base.height, data: new Uint8ClampedArray(base.data) };
  for (const l of rest) paintOver(out, await load(l.path), l.tint);
  return out;
}

const pixels = new Map<string, Promise<Pixels>>();
/** Browser loader: decodes a sheet under public/assets/ once. */
function loadPixels(path: string) {
  let p = pixels.get(path);
  if (!p) {
    p = new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0);
        ok(g.getImageData(0, 0, c.width, c.height));
      };
      img.onerror = () => fail(new Error(`missing asset ${path}`));
      img.src = `${import.meta.env.BASE_URL}assets/${path}`;
    });
    pixels.set(path, p);
  }
  return p;
}

const sheets = new Map<string, Promise<HTMLCanvasElement>>();
/** A look's sheet for one animation as a canvas, composed once and cached. */
export function horseSheet(look: Look, anim: Anim) {
  const key = `${anim}:${JSON.stringify(look)}`;
  let s = sheets.get(key);
  if (!s) {
    s = composeSheet(look, anim, loadPixels).then((px) => {
      const c = document.createElement('canvas');
      c.width = px.width; c.height = px.height;
      c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
      return c;
    });
    sheets.set(key, s);
  }
  return s;
}
