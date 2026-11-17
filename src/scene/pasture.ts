/**
 * The pasture (#79), seen from above like the farm map and drawn with the same tiles, fences and horses: one fenced
 * field that grows by a paddock with each enlargement, the land still to buy staked out next to it. Every horse of
 * the farm grazes there. Pure picture; the Sim decides the places.
 */
import type { Look } from '../horses/look';
import { fitPixels } from '../pixel';
import { inside, type Plot, plotDrawables } from './buildings';
import { image } from './draw';
import { SPRITES } from './farm';
import { type Drawable, drawHorse, grazes, lifeSheets, loadHorses, random, walker, wander } from './life';
import { paintTerrain, TILE } from './terrain';

export type PastureOptions = { herd: Look[]; built: number; max: number };

const COLS = 13, ROWS = 8, BASE = 5, STEP = 2; // the first field 5 cells wide, each paddock adds 2: 13 cells fit a small iPad

export async function startPasture(canvas: HTMLCanvasElement, o: PastureOptions) {
  // the fenced field, and the land that can still be added, staked out like a free plot
  const field: Plot = { id: 'pasture', c0: 1, r0: 1, c1: BASE + STEP * o.built, r1: 6, building: 'pasture' };
  const more: Plot[] = Array.from({ length: o.max - o.built }, (_, k) => {
    const c0 = BASE + 1 + STEP * (o.built + k);
    return { id: `more${k}`, c0, r0: 2, c1: c0 + STEP - 1, r1: 5, building: null };
  });
  const sheets = new Set(['nature/terrain.png', 'farm/fences.png', ...Object.values(SPRITES).map((s) => s.sheet), ...lifeSheets(o.herd)]);
  const img: Record<string, CanvasImageSource> = {};
  await Promise.all([...sheets].map(async (s) => { img[s] = await image(s); }));
  await loadHorses(img, o.herd, false);

  // grass everywhere, flowers on the land not fenced in yet
  const map = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => (more.some((p) => c >= p.c0 && c <= p.c1 && r >= p.r0 && r <= p.r1) && (c + r) % 3 === 0 ? 'm' : '.')).join(''));
  const ground = document.createElement('canvas');
  ground.width = COLS * TILE; ground.height = ROWS * TILE;
  paintTerrain(ground.getContext('2d')!, img['nature/terrain.png'], map);
  // the farm's hay roll (its last drawable) is too big for this field: fence and trough only
  const scenery: Drawable[] = [...plotDrawables(field, img).slice(0, -1), ...more.flatMap((p) => plotDrawables(p, img))];

  const rnd = random(11), area = inside(field);
  // spread over the field at first, so every horse can be counted
  const horses = o.herd.map((look, i) => {
    const w = walker(area, rnd);
    w.x = w.tx = area[0] + ((i + 0.5) / o.herd.length) * (area[2] - area[0]);
    return { look, w };
  });
  const ctx = canvas.getContext('2d')!;
  let W = 0, H = 0, S = 1, ox = 0, oy = 0, last = performance.now(), running = true;

  function fit() {
    S = Math.min(2, fitPixels(innerWidth, innerHeight).scale);
    W = Math.floor(innerWidth / S); H = Math.floor(innerHeight / S);
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * S}px`; canvas.style.height = `${H * S}px`;
    ox = Math.round((W - COLS * TILE) / 2); oy = Math.round(Math.max(TILE / 2, Math.min(TILE * 2, (H - 110 - ROWS * TILE) / 2 + TILE))); // between the top bar and the bar at the bottom
  }

  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000;
    last = now;
    const crowd = horses.map((h) => h.w);
    for (const h of horses) wander(h.w, area, h.look.build === 'pony' ? 13 : 16, dt, rnd, grazes(h.look), crowd);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#2f8a3a'; ctx.fillRect(0, 0, W, H); // the grass's own green beside the field
    ctx.save(); ctx.translate(ox, oy);
    ctx.drawImage(ground, 0, 0);
    const items: Drawable[] = [...scenery, ...horses.map(({ look, w }): Drawable => {
      const anim = w.mode === 'walk' ? 'walk' : w.mode === 'eat' ? 'eat' : 'idle', f = Math.floor((t + w.phase) * (anim === 'eat' ? 3 : 7));
      return { y: w.y, draw: (c) => drawHorse(c, img, look, anim, w.dir, f, w.x, w.y) };
    })];
    for (const d of items.sort((a, b) => a.y - b.y)) d.draw(ctx, t);
    ctx.restore();
    requestAnimationFrame(frame);
  }

  fit();
  addEventListener('resize', fit);
  requestAnimationFrame(frame);
  return { stop() { running = false; removeEventListener('resize', fit); } };
}
