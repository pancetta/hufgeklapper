/**
 * The feed store ("Futterlager", #51) from inside: plank walls, a beam, straw on the floor, and the hay in stock as
 * a stack of bales, one drawn bale for each bale in the store (our own pixel art). Bales just bought drop onto the
 * stack. Room on the right wall stays free for more feed later (sacks of concentrate on a shelf).
 */
import { fitPixels } from '../pixel';

export type StoreOptions = { bales: number };

const BALE = { w: 24, h: 14 };

/** One square bale seen from the side: golden straw, light top, dark underside, two strings round it. */
function paintBale() {
  const c = document.createElement('canvas');
  c.width = BALE.w; c.height = BALE.h;
  const g = c.getContext('2d')!, px = (color: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
  px('#6a4a1c', 0, 0, BALE.w, BALE.h);
  px('#e3b54a', 1, 1, BALE.w - 2, BALE.h - 2);
  px('#f4d77a', 1, 1, BALE.w - 2, 3); // the top catches the light
  px('#b98a2e', 1, BALE.h - 4, BALE.w - 2, 3);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) px(rnd() < 0.5 ? '#c99a38' : '#f7e08e', 1 + Math.floor(rnd() * (BALE.w - 3)), 2 + Math.floor(rnd() * (BALE.h - 4)), 2, 1);
  for (const x of [6, 17]) { px('#8a5a2a', x, 1, 1, BALE.h - 2); px('#a87240', x + 1, 1, 1, BALE.h - 2); } // the strings
  return c;
}

export async function startStore(canvas: HTMLCanvasElement, opts: StoreOptions) {
  const bale = paintBale(), ctx = canvas.getContext('2d')!;
  let W = 0, H = 0, S = 1, running = true, shown = opts.bales, perRow = 8, rows = 6;
  const drops = new Map<number, number>(); // bale index → when it started to drop (seconds)

  function fit() {
    S = Math.min(2, fitPixels(innerWidth, innerHeight).scale) * 2;
    W = Math.floor(innerWidth / S); H = Math.floor(innerHeight / S);
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * S}px`; canvas.style.height = `${H * S}px`;
    // the stack fills the left 60 %, the panel stands on the right; more bales than fit are told by the panel's number
    perRow = Math.max(3, Math.floor((W * 0.6 - 24) / BALE.w));
    rows = Math.max(2, Math.floor((H * 0.82 - 40) / (BALE.h - 1)));
  }

  /** Where bale `i` lies: rows from the floor up, each row shifted by half a bale like bricks, a little narrower. */
  function spot(i: number, floor: number) {
    const row = Math.floor(i / perRow), col = i % perRow, x0 = 16 + (row % 2) * (BALE.w / 2);
    return { x: x0 + col * BALE.w, y: floor - (row + 1) * (BALE.h - 1) };
  }

  function frame(now: number) {
    if (!running) return;
    const t = now / 1000, floor = Math.round(H * 0.82);
    ctx.imageSmoothingEnabled = false;
    // the wall: vertical planks with a beam, the straw floor
    for (let x = 0; x < W; x += 12) {
      ctx.fillStyle = (x / 12) % 2 ? '#8a5530' : '#7f4d2b'; ctx.fillRect(x, 0, 12, floor);
      ctx.fillStyle = '#5a3419'; ctx.fillRect(x, 0, 1, floor);
    }
    ctx.fillStyle = '#5a3419'; ctx.fillRect(0, 24, W, 6); ctx.fillStyle = '#a86b3c'; ctx.fillRect(0, 24, W, 1);
    ctx.fillStyle = '#d9b75a'; ctx.fillRect(0, floor, W, H - floor);
    ctx.fillStyle = '#c49f45';
    for (let i = 0; i < 120; i++) ctx.fillRect((i * 37) % W, floor + 2 + ((i * 53) % Math.max(1, H - floor - 2)), 3, 1);
    // the stack; new bales drop in from above, one after another
    const n = Math.min(shown, perRow * rows);
    ctx.fillStyle = 'rgba(40, 20, 5, 0.25)'; ctx.fillRect(12, floor, Math.min(n, perRow) * BALE.w + BALE.w / 2 + 8, 3);
    for (let i = 0; i < n; i++) {
      const p = spot(i, floor), start = drops.get(i), k = start === undefined ? 1 : Math.min(1, (t - start) / 0.35);
      if (k < 0) continue;
      ctx.drawImage(bale, p.x, Math.round(p.y - (1 - k * k) * 60));
      if (k === 1) drops.delete(i);
    }
    requestAnimationFrame(frame);
  }

  fit();
  addEventListener('resize', fit);
  requestAnimationFrame(frame);
  return {
    /** The store holds `bales` now: bales bought drop onto the stack, bales eaten are gone. */
    set(bales: number) {
      const t = performance.now() / 1000;
      for (let i = shown; i < bales; i++) drops.set(i, t + (i - shown) * 0.06);
      shown = bales;
    },
    stop() { running = false; removeEventListener('resize', fit); },
  };
}
