/** Runs the living farm on a canvas: behind the start screen, and as the farm map the player taps. */
import { fitPixels } from '../pixel';
import { blit, image } from './draw';
import { ground, plotDrawables } from './buildings';
import { FOCUS, MAP, PLOTS, PROPS, SPRITES, WORLD } from './farm';
import type { Look } from '../horses/look';
import { bounds } from './buildings';
import { createLife, type Drawable, lifeSheets, loadHorses, START_HERD } from './life';
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

export type FarmOptions = {
  herd?: Look[]; // the horses on the pasture (the start screen shows a sample herd)
  canter?: boolean; // a pony canters over the jumps
  onTap?: (target: string) => void; // a plot's id, or 'board' for the notice board
  onLayout?: () => void; // the view changed size: labels placed with toScreen need moving
};

/** Where things are on the map that the player can tap: plots, and the notice board (a prop). */
const BOARD = PROPS.find(([n]) => n === 'board')!;
function hit(x: number, y: number): string | undefined {
  if (Math.abs(x - BOARD[1]) < 18 && y > BOARD[2] - 32 && y < BOARD[2] + 4) return 'board';
  return PLOTS.find((p) => { const b = bounds(p); return x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1; })?.id;
}

export async function startFarm(canvas: HTMLCanvasElement, opts: FarmOptions = {}) {
  const herd = opts.herd ?? START_HERD, canter = opts.canter ?? true;
  const sheets = new Set(['nature/terrain.png', 'farm/barn.png', 'farm/fences.png', ...Object.values(SPRITES).map((s) => s.sheet), ...lifeSheets(herd)]);
  const img: Record<string, HTMLImageElement> = {};
  await Promise.all([...sheets].map(async (s) => { img[s] = await image(s); }));
  await loadHorses(img, herd, canter);

  const groundCanvas = document.createElement('canvas');
  groundCanvas.width = WORLD.width; groundCanvas.height = WORLD.height;
  // buildings bring their own ground (an arena its sand) on top of the landscape
  const map = MAP.map((row) => [...row]);
  for (const p of PLOTS) for (const { ch, c, r } of ground(p)) map[r][c] = ch;
  paintTerrain(groundCanvas.getContext('2d')!, img['nature/terrain.png'], map.map((row) => row.join('')));

  const scenery = staticDrawables(img);
  const life = createLife(7, PLOTS, herd, canter);
  const ctx = canvas.getContext('2d')!;
  let W = 0, H = 0, S = 1, ox = 0, oy = 0, last = performance.now(), vignette: CanvasGradient, running = true;

  function fit() {
    // at most 2× so a big iPad sees the whole farm, not a closer crop of it
    S = Math.min(2, fitPixels(innerWidth, innerHeight).scale);
    W = Math.floor(innerWidth / S); H = Math.floor(innerHeight / S);
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * S}px`; canvas.style.height = `${H * S}px`;
    ox = Math.round(Math.min(0, Math.max(W - WORLD.width, W / 2 - FOCUS.x)));
    oy = Math.round(Math.min(0, Math.max(H - WORLD.height, H / 2 - FOCUS.y)));
    // a soft warm vignette frames the scene
    vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    vignette.addColorStop(0, 'rgba(40,25,10,0)'); vignette.addColorStop(1, 'rgba(40,25,10,0.35)');
    opts.onLayout?.();
  }

  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000;
    last = now;
    life.update(dt);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, ox, oy);
    ctx.drawImage(groundCanvas, 0, 0);
    for (const d of [...scenery, ...life.drawables(t, img)].sort((a, b) => a.y - b.y)) d.draw(ctx, t);
    life.overlay(ctx, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    requestAnimationFrame(frame);
  }

  const tap = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect(), target = hit((e.clientX - r.left) / S - ox, (e.clientY - r.top) / S - oy);
    if (target) opts.onTap?.(target);
  };
  // 'click', not 'pointerup': WebKit sends the click after pointerup to whatever is under the finger, which would be
  // the next screen if the tap already swapped it
  if (opts.onTap) canvas.addEventListener('click', tap);
  fit();
  addEventListener('resize', fit);
  requestAnimationFrame(frame);
  return {
    /** CSS pixel position of a world point, for HTML labels over the map. */
    toScreen: (x: number, y: number) => ({ left: (x + ox) * S, top: (y + oy) * S }),
    stop() { running = false; removeEventListener('resize', fit); canvas.removeEventListener('click', tap); },
  };
}
