/**
 * The stable aisle from the side, as a close-up (twice the farm's pixel size): a plank wall with a window over each
 * stall and light falling in, straw on the floor, and the horses looking out over their half doors.
 * The screen puts names and needs (HTML) on top.
 */
import { horseSheet } from '../horses/compose';
import type { Look } from '../horses/look';
import { fitPixels } from '../pixel';
import { blit, image, shadow } from './draw';

export type StableOptions = { horses: Look[]; stalls: number; onLayout?: () => void };

const WINDOW = [416, 360, 31, 31] as const;
const HAY = [96, 704, 32, 32] as const; // a little heap of hay, decorations.png

function strawTile() {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d9b75a'; g.fillRect(0, 0, 48, 48);
  let s = 11;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 260; i++) {
    g.fillStyle = ['#c49f45', '#e8cc75', '#b58f3a', '#f0d98a'][i % 4];
    const x = Math.floor(rnd() * 48), y = Math.floor(rnd() * 48), long = rnd() < 0.5;
    g.fillRect(x, y, long ? 3 : 1, long ? 1 : 2);
  }
  return c;
}

export async function startStable(canvas: HTMLCanvasElement, opts: StableOptions) {
  const [barn, deco, ...sheets] = await Promise.all([
    image('farm/barn.png'), image('farm/decorations.png'), ...opts.horses.map((l) => horseSheet(l, 'idle')),
  ]);
  const straw = strawTile(), ctx = canvas.getContext('2d')!;
  let W = 0, H = 0, S = 1, running = true;
  const layout = { boxW: 120, x0: 0, floor: 0 };

  function fit() {
    S = Math.min(2, fitPixels(innerWidth, innerHeight).scale) * 2;
    W = Math.floor(innerWidth / S); H = Math.floor(innerHeight / S);
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * S}px`; canvas.style.height = `${H * S}px`;
    layout.boxW = Math.min(120, Math.floor((W - 24) / opts.stalls));
    layout.x0 = Math.round((W - layout.boxW * opts.stalls) / 2);
    layout.floor = Math.round(H * 0.6);
    opts.onLayout?.();
  }

  function frame(now: number) {
    if (!running) return;
    const t = now / 1000, { boxW, x0, floor } = layout;
    ctx.imageSmoothingEnabled = false;
    // the wall: vertical planks, darker towards the roof, with a beam along it
    for (let x = 0; x < W; x += 12) {
      ctx.fillStyle = (x / 12) % 2 ? '#8a5530' : '#7f4d2b'; ctx.fillRect(x, 0, 12, floor);
      ctx.fillStyle = '#5a3419'; ctx.fillRect(x, 0, 1, floor);
      ctx.fillStyle = 'rgba(255, 220, 160, 0.08)'; ctx.fillRect(x + 1, 0, 1, floor);
    }
    for (let y = 0; y < 40; y += 2) { ctx.fillStyle = `rgba(30, 15, 5, ${0.4 - y / 100})`; ctx.fillRect(0, y, W, 2); }
    ctx.fillStyle = '#4e2d15'; ctx.fillRect(0, floor - 76, W, 5);
    ctx.fillStyle = '#7a4a26'; ctx.fillRect(0, floor - 76, W, 1);
    // the floor: straw, with a shadow along the wall
    for (let y = floor; y < H; y += 48) for (let x = 0; x < W; x += 48) ctx.drawImage(straw, x, y);
    ctx.fillStyle = 'rgba(40, 20, 5, 0.3)'; ctx.fillRect(0, floor, W, 3);
    for (let i = 0; i < opts.stalls; i++) {
      const bx = x0 + i * boxW, cx = bx + boxW / 2;
      // a window over the stall: light falls in, dust dances in it
      const wx = Math.round(cx - 16), wy = floor - 112;
      blit(ctx, barn, WINDOW, wx, wy);
      ctx.fillStyle = 'rgba(255, 236, 170, 0.09)';
      for (let k = 0; k < 100; k += 2) ctx.fillRect(wx + 3 + k * 0.45, wy + 31 + k, 26, 2);
      ctx.fillStyle = 'rgba(255, 245, 210, 0.75)';
      for (let d = 0; d < 4; d++) {
        const p = (t * 0.06 + d * 0.27 + i * 0.13) % 1;
        ctx.fillRect(Math.round(wx + 8 + p * 40 + Math.sin(t + d) * 3), Math.round(wy + 36 + p * 70), 1, 1);
      }
      // wide stalls show the horse from the side next to a hay rack; narrow ones (a bigger stable) from the front,
      // looking out over the door, so no horse reaches into the next stall
      const narrow = boxW < 100;
      if (!narrow) blit(ctx, deco, HAY, bx + boxW - 38, floor - 60); // hay rack on the back wall
      const sheet = sheets[i];
      if (sheet) {
        // the horse stands a little back in its stall
        const foot = floor - 6, breathe = Math.sin(t * 1.8 + i) > 0.85 ? 1 : 0;
        shadow(ctx, cx, foot - 1, narrow ? 12 : 26, 3, 0.25);
        ctx.drawImage(sheet, narrow ? 256 : 128, 0, 128, 128, Math.round(cx - 64), foot - 93 - breathe, 128, 128); // front (south) or side (west)
      }
      // the half door: planks, a top rail, an X brace
      const dx = bx + 6, dw = boxW - 12, dy = floor - 20, dh = 24;
      ctx.fillStyle = '#7a4a26'; ctx.fillRect(dx, dy, dw, dh);
      ctx.fillStyle = '#8a5530';
      for (let px = dx + 2; px < dx + dw - 2; px += 8) ctx.fillRect(px, dy + 3, 6, dh - 5);
      ctx.fillStyle = '#5a3419'; ctx.fillRect(dx, dy, dw, 3); ctx.fillRect(dx, dy + dh - 2, dw, 2);
      ctx.fillStyle = '#a86b3c'; ctx.fillRect(dx, dy, dw, 1);
      ctx.fillStyle = '#5a3419';
      for (let k = 0; k < dh - 5; k++) {
        const f = k / (dh - 5);
        ctx.fillRect(Math.round(dx + 3 + f * (dw - 9)), dy + 3 + k, 3, 1);
        ctx.fillRect(Math.round(dx + dw - 6 - f * (dw - 9)), dy + 3 + k, 3, 1);
      }
      // posts between the stalls
      for (const px of [bx, bx + boxW - 4]) {
        ctx.fillStyle = '#4e2d15'; ctx.fillRect(px, floor - 76, 4, 80);
        ctx.fillStyle = '#7a4a26'; ctx.fillRect(px + 1, floor - 76, 1, 80);
      }
    }
    requestAnimationFrame(frame);
  }

  fit();
  addEventListener('resize', fit);
  requestAnimationFrame(frame);
  return {
    /** A stall's door and the space under it, in CSS pixels, for the name plate and the needs. */
    box(i: number) {
      const { boxW, x0, floor } = layout;
      return { left: (x0 + i * boxW + 6) * S, width: (boxW - 12) * S, doorTop: (floor - 20) * S, below: (floor + 8) * S, horseTop: (floor - 70) * S };
    },
    stop() { running = false; removeEventListener('resize', fit); },
  };
}
