/**
 * The farm grows on plots ("Bauplätze"): each plot is a rectangle of cells holding one building, or nothing yet.
 * A building places itself from its plot: the ground it needs, its fence, its parts and fittings. So adding or
 * upgrading a building later means changing a plot's entry, never redrawing the map.
 */
import { blit, shadow } from './draw';
import { SPRITES } from './farm';
import type { Drawable } from './life';
import { TILE } from './terrain';

export type Building = 'stall' | 'feedStore' | 'pasture' | 'arena' | 'shelter';
/** `level` 1: the building is upgraded; `flags`: the farm is a Reitschule and dresses up with pennants. */
export type Plot = { id: string; c0: number; r0: number; c1: number; r1: number; building: Building | null; level?: number; flags?: boolean };
type Images = Record<string, CanvasImageSource>;

/** Plot rectangle in world pixels. */
export const bounds = (p: Plot) => ({ x0: p.c0 * TILE, y0: p.r0 * TILE, x1: (p.c1 + 1) * TILE, y1: (p.r1 + 1) * TILE });

/** Where animals may roam inside a fenced plot (clear of the rails). */
export function inside(p: Plot): [number, number, number, number] {
  const b = bounds(p);
  return [b.x0 + 40, b.y0 + 50, b.x1 - 40, b.y1 - 26];
}

/** The canter loop of an arena: two lanes (top, bottom) joined at the ends. */
export function canterLoop(p: Plot): [number, number][] {
  const b = bounds(p);
  return [[b.x0 + 50, b.y0 + 44], [b.x1 - 54, b.y0 + 44], [b.x1 - 54, b.y1 - 24], [b.x0 + 50, b.y1 - 24]];
}

/** Where pupils wait for their lesson: side by side along the arena's top fence, at its right end. */
export function waitingSpots(p: Plot): [number, number][] {
  const b = bounds(p);
  return [0, 1, 2].map((i) => [b.x1 - 76 + i * 22, b.y0 - 4]);
}

/** A lesson walks a quiet round between the jumps, never through one (see `jumps`). */
export function track(p: Plot): [number, number][] {
  const b = bounds(p);
  return [[b.x0 + 40, b.y0 + 70], [b.x1 - 40, b.y0 + 70], [b.x1 - 40, b.y1 - 12], [b.x0 + 40, b.y1 - 12]];
}

/** Show jumps sit on the canter lanes, a third and two thirds along the arena. */
export function jumps(p: Plot): { x: number; y: number; colour: string }[] {
  const [a, b, c] = canterLoop(p), w = b[0] - a[0];
  return [{ x: a[0] + w / 3, y: a[1] - 1, colour: '#d94f3d' }, { x: a[0] + (2 * w) / 3, y: c[1] - 1, colour: '#3d6fd9' }];
}

/** Ground a building needs on its plot, as map characters to paint over the landscape. */
export function ground(p: Plot): { ch: string; c: number; r: number }[] {
  if (p.building !== 'arena') return [];
  const cells = [];
  for (let r = p.r0; r <= p.r1; r++) for (let c = p.c0; c <= p.c1; c++) cells.push({ ch: 's', c, r });
  return cells;
}

/** The red barn (the stable), built from [LPC] Farm parts: [sx, sy, w, h, dx, dy] relative to its top-left. */
const BARN_PARTS = [
  [0, 512, 190, 164, 0, 0], // slate roof
  [32, 96, 126, 96, 32, 140], // planks behind the loft
  [32, 352, 126, 32, 32, 90], // gable peak
  [0, 384, 190, 128, 0, 122], // gambrel front
  [104, 100, 62, 44, 64, 150], // patch over a post stub
  [386, 112, 61, 64, 64, 172], // loft door
  [416, 360, 31, 31, 23, 190], [416, 360, 31, 31, 137, 190], // windows
  [0, 0, 190, 96, 0, 244], // ground-floor wall
  [386, 0, 124, 95, 33, 244], // barn doors
] as const;

function barn(img: Images) {
  const c = document.createElement('canvas');
  c.width = 190; c.height = 340;
  const g = c.getContext('2d')!;
  for (const [sx, sy, w, h, dx, dy] of BARN_PARTS) g.drawImage(img['farm/barn.png'], sx, sy, w, h, dx, dy, w, h);
  return c;
}

/** A fence around the plot in one style of farm/fences.png; each cell is its own drawable for correct depth. */
function fence(p: Plot, [fx, fy]: [number, number], img: Images, gate = -1): Drawable[] {
  const out: Drawable[] = [];
  for (let r = p.r0; r <= p.r1; r++)
    for (let c = p.c0; c <= p.c1; c++) {
      const ec = c === p.c0 ? 0 : c === p.c1 ? 2 : 1, er = r === p.r0 ? 0 : r === p.r1 ? 2 : 1;
      if (ec === 1 && er === 1) continue;
      const src = r === p.r1 && c === gate ? [64, 160] : [fx + ec * TILE, fy + (2 + er) * TILE];
      out.push({ y: r * TILE + (er === 1 ? TILE : 26), draw: (ctx) => blit(ctx, img['farm/fences.png'], [src[0], src[1], TILE, TILE], c * TILE, r * TILE) });
    }
  return out;
}

const sprite = (name: keyof typeof SPRITES, x: number, y: number, img: Images): Drawable => {
  const s = SPRITES[name];
  return { y, draw: (ctx) => blit(ctx, img[s.sheet], s.rect, x - s.ax, y - s.ay) };
};

/** A show jump (our own drawing): two white standards with striped poles. */
function jump(x: number, y: number, colour: string): Drawable {
  return { y, draw: (ctx) => {
    shadow(ctx, x, y + 1, 26, 3, 0.2);
    for (const sx of [x - 26, x + 22]) {
      ctx.fillStyle = '#6b5a4a'; ctx.fillRect(sx, y - 20, 5, 21);
      ctx.fillStyle = '#f7f3ea'; ctx.fillRect(sx + 1, y - 20, 3, 20);
      ctx.fillStyle = colour; ctx.fillRect(sx + 1, y - 22, 3, 3);
    }
    for (const py of [y - 15, y - 8]) for (let i = 0; i < 44; i++) { ctx.fillStyle = Math.floor(i / 6) % 2 ? '#f4efe2' : colour; ctx.fillRect(x - 21 + i, py, 1, 3); }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 21, y - 12, 44, 1); ctx.fillRect(x - 21, y - 5, 44, 1);
  } };
}

/** An open shelter with two more stall places (our own drawing, in the barn's colours): red planks, a grey roof, straw. */
function shelter(p: Plot): Drawable {
  const b = bounds(p), x0 = b.x0 + 10, x1 = b.x1 - 10, foot = b.y1 - 6, w = x1 - x0;
  return { y: foot, draw: (ctx) => {
    shadow(ctx, (x0 + x1) >> 1, foot - 1, w / 2 + 4, 5, 0.28);
    const px = (c: string, x: number, y: number, ww: number, hh: number) => { ctx.fillStyle = c; ctx.fillRect(x, y, ww, hh); };
    px('#2a1a10', x0 - 1, foot - 38, w + 2, 39); // outline
    px('#b8433a', x0, foot - 37, w, 37); // back wall of red planks
    for (let x = x0 + 5; x < x1; x += 6) px('#8e2f28', x, foot - 37, 1, 37);
    px('#3a2414', x0 + 6, foot - 30, w - 12, 30); // the open front: dark inside
    px('#e2c068', x0 + 6, foot - 7, w - 12, 7); px('#c9a548', x0 + 8, foot - 5, w - 16, 2); // straw on the floor
    for (const x of [x0 + 3, x1 - 6]) { px('#f4efe2', x, foot - 34, 3, 34); px('#c9c2b0', x + 2, foot - 34, 1, 34); } // white posts
    // the roof: grey shingles, a little overhang, a lighter ridge
    for (let r = 0; r < 14; r++) px(r % 3 === 2 ? '#4a4a5c' : '#5d5d72', x0 - 5 + Math.floor(r / 3), foot - 52 + r, w + 10 - 2 * Math.floor(r / 3), 1);
    px('#2a1a10', x0 - 6, foot - 53, w + 12, 1); px('#8a8aa0', x0 - 4, foot - 52, w + 8, 1);
  } };
}

/** The Reitschule's pennants: a string of little flags along the arena's top fence, clear of the waiting pupils. */
function pennants(p: Plot): Drawable {
  const b = bounds(p), x0 = b.x0 + 12, x1 = b.x1 - 92, y = b.y0 + 1, colours = ['#d94f3d', '#f2c14e', '#3d6fd9', '#43a047'];
  return { y, draw: (ctx) => {
    for (let x = x0; x < x1; x++) { ctx.fillStyle = '#efe6d0'; ctx.fillRect(x, y - 7 + Math.round(Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 3), 1, 1); }
    for (let x = x0 + 4, i = 0; x < x1 - 4; x += 9, i++) {
      const top = y - 6 + Math.round(Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 3);
      ctx.fillStyle = colours[i % colours.length];
      for (let r = 0; r < 5; r++) ctx.fillRect(x - 2 + Math.ceil(r / 2), top + r, 5 - 2 * Math.ceil(r / 2), 1);
    }
  } };
}

/** The upgraded arena: flower boxes along the bottom fence. */
function flowerBoxes(p: Plot): Drawable[] {
  const b = bounds(p), y = b.y1 - 3;
  return [b.x0 + 40, b.x0 + 90, b.x1 - 90, b.x1 - 40].map((x, i) => ({ y, draw: (ctx: CanvasRenderingContext2D) => {
    shadow(ctx, x, y, 9, 2, 0.25);
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 9, y - 6, 18, 7);
    ctx.fillStyle = '#a0623a'; ctx.fillRect(x - 8, y - 5, 16, 5);
    ctx.fillStyle = '#4c9a2a'; ctx.fillRect(x - 8, y - 9, 16, 4);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = (k + i) % 2 ? '#ffe066' : '#e94f3f'; ctx.fillRect(x - 7 + k * 4, y - 10 - (k % 2), 2, 2); }
  } }));
}

/** A free plot: four stakes with a string between them and a little sign. */
function freePlot(p: Plot): Drawable[] {
  const b = bounds(p), x0 = b.x0 + 8, y0 = b.y0 + 12, x1 = b.x1 - 8, y1 = b.y1 - 8;
  const stake = (x: number, y: number): Drawable => ({ y, draw: (ctx) => {
    shadow(ctx, x + 1, y, 3, 1, 0.25);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x - 1, y - 9, 3, 10);
    ctx.fillStyle = '#c98a4b'; ctx.fillRect(x, y - 9, 1, 9);
    ctx.fillStyle = '#e94f3f'; ctx.fillRect(x - 1, y - 10, 3, 2);
  } });
  const string: Drawable = { y: y0 - 1, draw: (ctx) => {
    ctx.fillStyle = 'rgba(250, 240, 210, 0.9)';
    ctx.fillRect(x0, y0 - 7, x1 - x0, 1); ctx.fillRect(x0, y1 - 7, x1 - x0, 1);
    ctx.fillRect(x0, y0 - 7, 1, y1 - y0); ctx.fillRect(x1, y0 - 7, 1, y1 - y0);
  } };
  const sx = (x0 + x1) >> 1, sy = y1 - 2;
  const sign: Drawable = { y: sy, draw: (ctx) => {
    shadow(ctx, sx, sy, 6, 2, 0.25);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(sx - 1, sy - 12, 3, 12); ctx.fillRect(sx - 9, sy - 21, 19, 11);
    ctx.fillStyle = '#d9a566'; ctx.fillRect(sx - 8, sy - 20, 17, 9);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(sx - 1, sy - 18, 3, 5); ctx.fillRect(sx - 3, sy - 16, 7, 1); // a "+"
  } };
  return [string, stake(x0, y0), stake(x1, y0), stake(x0, y1), stake(x1, y1), sign];
}

/** Everything a plot draws. */
export function plotDrawables(p: Plot, img: Images): Drawable[] {
  const b = bounds(p), cx = (b.x0 + b.x1) >> 1;
  switch (p.building) {
    case 'stall': {
      const c = barn(img), foot = b.y1 - 6;
      return [{ y: foot, draw: (ctx) => { shadow(ctx, cx, foot - 2, 104, 7, 0.28); ctx.drawImage(c, cx - 95, foot - 340); } }];
    }
    case 'feedStore': return [sprite('hayShed', cx, b.y1 - 6, img)];
    case 'pasture': return [...fence(p, [0, 0], img, p.c0 + 1), sprite('troughWater', b.x0 + 88, b.y0 + 86, img), sprite('hayRoll', b.x1 - 50, b.y0 + 166, img)];
    case 'arena': return [...fence(p, [384, 0], img), ...jumps(p).map((j) => jump(j.x, j.y, j.colour)),
      ...(p.flags ? [pennants(p)] : []), ...(p.level ? flowerBoxes(p) : [])];
    case 'shelter': return [shelter(p)];
    default: return freePlot(p);
  }
}
