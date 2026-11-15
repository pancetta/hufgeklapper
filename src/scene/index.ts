/** Runs the living farm on a canvas: the start screen's background. */
import { fitPixels } from '../pixel';
import { blit, image } from './draw';
import { ground, plotDrawables } from './buildings';
import { FOCUS, MAP, PLOTS, PROPS, SPRITES, WORLD } from './farm';
import { createLife, type Drawable, lifeSheets } from './life';
import { paintTerrain } from './terrain';

const SWAYS = /^(lavender|cream|blue|red|roses|spike|cluster|meadow|tulips|grass|cattail|reeds|sunflowers)/;

function staticDrawables(img: Record<string, HTMLImageElement>): Drawable[] {
  const out: Drawable[] = [];
  for (const [name, x, y] of PROPS) {
    const s = SPRITES[name], sways = SWAYS.test(name), phase = x * 0.13 + y * 0.07;
    out.push({ y, draw: (ctx, t) => {
      blit(ctx, img[s.sheet], s.rect, x - s.ax + (sways && Math.sin(t * 1.6 + phase) > 0.7 ? 1 : 0), y - s.ay);
    } });
  }
  for (const p of PLOTS) out.push(...plotDrawables(p, img));
  return out;
}

export async function startFarm(canvas: HTMLCanvasElement) {
  const sheets = new Set(['nature/terrain.png', 'farm/barn.png', 'farm/fences.png', ...Object.values(SPRITES).map((s) => s.sheet), ...lifeSheets()]);
  const img: Record<string, HTMLImageElement> = {};
  await Promise.all([...sheets].map(async (s) => { img[s] = await image(s); }));

  const groundCanvas = document.createElement('canvas');
  groundCanvas.width = WORLD.width; groundCanvas.height = WORLD.height;
  // buildings bring their own ground (an arena its sand) on top of the landscape
  const map = MAP.map((row) => [...row]);
  for (const p of PLOTS) for (const { ch, c, r } of ground(p)) map[r][c] = ch;
  paintTerrain(groundCanvas.getContext('2d')!, img['nature/terrain.png'], map.map((row) => row.join('')));

  const scenery = staticDrawables(img);
  const life = createLife(7, PLOTS);
  const ctx = canvas.getContext('2d')!;
  let W = 0, H = 0, last = performance.now(), vignette: CanvasGradient;

  function fit() {
    // at most 2× so a big iPad sees the whole farm, not a closer crop of it
    const scale = Math.min(2, fitPixels(innerWidth, innerHeight).scale);
    W = Math.floor(innerWidth / scale); H = Math.floor(innerHeight / scale);
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * scale}px`; canvas.style.height = `${H * scale}px`;
    // a soft warm vignette frames the scene
    vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    vignette.addColorStop(0, 'rgba(40,25,10,0)'); vignette.addColorStop(1, 'rgba(40,25,10,0.35)');
  }

  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000;
    last = now;
    life.update(dt);
    const ox = Math.round(Math.min(0, Math.max(W - WORLD.width, W / 2 - FOCUS.x)));
    const oy = Math.round(Math.min(0, Math.max(H - WORLD.height, H / 2 - FOCUS.y)));
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, ox, oy);
    ctx.drawImage(groundCanvas, 0, 0);
    for (const d of [...scenery, ...life.drawables(t, img)].sort((a, b) => a.y - b.y)) d.draw(ctx, t);
    life.overlay(ctx, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    requestAnimationFrame(frame);
  }

  fit();
  addEventListener('resize', fit);
  requestAnimationFrame(frame);
}
