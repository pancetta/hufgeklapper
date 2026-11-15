/**
 * The windmill by the pond: a slim tower (our own drawing, in the colours of the LPC barn) with the LPC farm's
 * small blades turning on its front. Drawn at its foot (x, y).
 */
import { blit, shadow } from './draw';

const H = 62, TOP = 14, BASE = 24, OUTLINE = '#2a1a10';
const SHINGLE = '#8a5a3a', SHINGLE_DARK = '#6e452b', SHINGLE_LIGHT = '#a87250';
const STONE = '#9a958c', STONE_DARK = '#76716a', CAP = '#4f4f62', CAP_LIGHT = '#6f6f86';

let tower: HTMLCanvasElement | undefined;

/** The tower once, into a canvas: the foot is its bottom row, centred. */
function paintTower() {
  const w = BASE + 4, c = document.createElement('canvas');
  c.width = w; c.height = H + 10;
  const g = c.getContext('2d')!, mid = w / 2, top = 9;
  const px = (color: string, x: number, y: number, ww = 1, hh = 1) => { g.fillStyle = color; g.fillRect(x, y, ww, hh); };
  for (let r = 0; r < H; r++) {
    // a tapering body of wooden shingles, light from the left, rows of shingle edges
    const half = Math.round((TOP + ((BASE - TOP) * r) / H) / 2), x0 = mid - half, y = top + r;
    const stone = r >= H - 6;
    px(stone ? STONE : (r % 4 === 3 ? SHINGLE_DARK : SHINGLE), x0, y, half * 2);
    px(stone ? '#b4afa6' : SHINGLE_LIGHT, x0 + 1, y, 2);
    px(stone ? STONE_DARK : SHINGLE_DARK, x0 + half * 2 - 3, y, 3);
    if (stone && (r + (r % 2 ? 0 : 3)) % 3 === 0) for (let x = x0 + 2; x < x0 + half * 2 - 2; x += 5) px(STONE_DARK, x + (r % 2) * 2, y);
    px(OUTLINE, x0 - 1, y); px(OUTLINE, x0 + half * 2, y);
  }
  px(OUTLINE, mid - BASE / 2 - 1, top + H, BASE + 2);
  // the door with a white frame, a small window above
  px('#e8dcc0', mid - 4, top + H - 11, 8, 11); px('#3a2414', mid - 3, top + H - 10, 6, 10); px('#5a3a22', mid - 3, top + H - 10, 2, 10);
  px('#e8dcc0', mid - 2, top + 22, 4, 6); px('#22262e', mid - 1, top + 23, 2, 4);
  // the cap: a little dome with a shine
  for (let r = 0; r < 9; r++) {
    const half = Math.round(Math.sqrt(1 - ((8 - r) / 9) ** 2) * 10), y = r + 1;
    px(OUTLINE, mid - half - 1, y, half * 2 + 2);
    px(CAP, mid - half, y, half * 2);
    if (r > 1 && r < 6) px(CAP_LIGHT, mid - half + 2, y, 3);
  }
  px(OUTLINE, mid - 1, 0, 2, 1);
  px(OUTLINE, mid - 11, top, 22, 1);
  return c;
}

/** The windmill at its foot (x, y); the blades turn slowly with time `t` (seconds). */
export function drawWindmill(ctx: CanvasRenderingContext2D, blades: CanvasImageSource, x: number, y: number, t: number) {
  tower ??= paintTower();
  shadow(ctx, x + 2, y - 1, 15, 4, 0.28);
  ctx.drawImage(tower, Math.round(x - tower.width / 2), y - tower.height + 1);
  // the hub sits on the cap's front; the sheet has 4 frames of 64×64 stacked
  blit(ctx, blades, [0, (Math.floor(t * 5) % 4) * 64, 64, 64], Math.round(x - 32), y - tower.height + 12 - 32);
}
