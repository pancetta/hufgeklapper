/**
 * Draws the home-screen icon (our own pixel art): a horseshoe with nail holes on a meadow, on a 32×32 grid,
 * scaled up without smoothing. Run `npm run icon`; writes public/icons/.
 */
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const N = 32, cx = 15.5, cy = 15;
type RGB = [number, number, number];
const GRASS: RGB = [90, 154, 58], GRASS_DARK: RGB = [70, 128, 44], GRASS_LIGHT: RGB = [126, 186, 76];
// a golden lucky horseshoe
const IRON: RGB = [226, 172, 52], IRON_LIGHT: RGB = [255, 228, 124], IRON_DARK: RGB = [166, 112, 28], INK: RGB = [42, 26, 16];

/** Is (x, y) on the shoe? An arch on top, two straight branches below. */
function shoe(x: number, y: number) {
  const dx = (x + 0.5 - cx) / 10.5, dy = Math.min(0, y + 0.5 - cy) / 10, ix = (x + 0.5 - cx) / 5.5, iy = Math.min(0, y + 0.5 - cy) / 5;
  return dx * dx + dy * dy <= 1 && ix * ix + iy * iy > 1 && y < cy + 9;
}

function pixels(): RGB[][] {
  const grid: RGB[][] = [];
  for (let y = 0; y < N; y++) {
    grid.push([]);
    for (let x = 0; x < N; x++) {
      // the meadow: a few tufts in a fixed pattern, lighter at the top
      const tuft = (x * 7 + y * 13) % 11 === 0, dark = (x * 5 + y * 3) % 17 === 0;
      grid[y].push(tuft ? GRASS_LIGHT : dark || y > 27 ? GRASS_DARK : GRASS);
    }
  }
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && shoe(x, y);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (on(x, y)) {
      // light from the top left: bright upper edges, dark lower edges
      grid[y][x] = !on(x - 1, y - 1) ? IRON_LIGHT : !on(x + 1, y + 1) ? IRON_DARK : IRON;
    } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) grid[y][x] = INK;
    else if (on(x - 1, y - 1) && y > 3) grid[y][x] = GRASS_DARK; // the shoe's shadow
  }
  // nail holes: three each side, two in the arch and one in the branch
  for (const a of [35, 75]) for (const side of [-1, 1]) {
    const r = (a * Math.PI) / 180;
    grid[Math.round(cy - 0.5 - 7.5 * Math.sin(r))][Math.round(cx - 0.5 + side * 8 * Math.cos(r))] = INK;
  }
  for (const side of [-1, 1]) grid[cy + 4][Math.round(cx - 0.5 + side * 8)] = INK;
  return grid;
}

async function write(file: string, scale: number, pad: number) {
  const g = pixels(), size = N * scale + 2 * pad, buf = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = Math.min(N - 1, Math.max(0, Math.floor((x - pad) / scale))), gy = Math.min(N - 1, Math.max(0, Math.floor((y - pad) / scale)));
    const inside = x >= pad && y >= pad && x < size - pad && y < size - pad;
    buf.set(inside ? g[gy][gx] : GRASS_DARK, (y * size + x) * 3);
  }
  await sharp(buf, { raw: { width: size, height: size, channels: 3 } }).png().toFile(file);
}

mkdirSync('public/icons', { recursive: true });
await write('public/icons/icon-512.png', 16, 0);
await write('public/icons/icon-192.png', 6, 0);
await write('public/icons/apple-touch-icon.png', 5, 10); // 180 px: 32 × 5 plus a border
