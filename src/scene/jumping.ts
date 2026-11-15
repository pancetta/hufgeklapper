/**
 * The jumping minigame, seen from above: the horse gallops to the right along a sand lane, the course scrolls,
 * and the player taps at take-off. In the air the horse grows while its shadow stays on the ground. A green
 * patch before each jump shows where to tap; how wide it is comes from the Sim's take-off window.
 * Animation and input only: whether a tap clears a jump is the Sim's `clears`, passed in as `judge`.
 */
import { horseSheet } from '../horses/compose';
import type { Look } from '../horses/look';
import type { Kid } from '../riders/look';
import { fitPixels } from '../pixel';
import { blit, shadow } from './draw';
import { drawRider } from './kids';
import { seat } from './life';

const SPEED = 120; // px per second
const TAKEOFF = 40; // the hooves leave the ground this far before the pole and land as far behind it
const FIRST = 260, SPACING = 220, RUN_OUT = 170, LANE = { y0: 70, y1: 150 }, HOOVES = 124, H = 220;
const STEP = 1 / 60, BEFORE = 400; // the course starts this far before the horse

export type JumpingOptions = {
  look: Look;
  kid: Kid;
  jumps: number;
  window: number; // seconds; drawn as the green take-off patch
  judge: (offset: number) => boolean; // seconds from the perfect take-off (− early, + late) → cleared?
};

type Jump = { x: number; colour: string; done: boolean; down: boolean };

/** The course drawn once: grass, a sand lane with fences on both sides, flowers. */
function paintCourse(width: number) {
  const c = document.createElement('canvas');
  c.width = width; c.height = H;
  const g = c.getContext('2d')!;
  const px = (color: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  px('#5a9a3a', 0, 0, width, H);
  for (let i = 0; i < width / 6; i++) px(rnd() < 0.5 ? '#6fb04a' : '#4a8a30', Math.floor(rnd() * width), Math.floor(rnd() * H), 2, 1);
  for (let i = 0; i < width / 40; i++) {
    const y = rnd() < 0.5 ? 10 + rnd() * 40 : LANE.y1 + 20 + rnd() * 40;
    px(['#ffe066', '#ffffff', '#ff8fc7', '#7ec8ff'][i % 4], Math.floor(rnd() * width), Math.floor(y), 2, 2);
  }
  px('#c9a26a', 0, LANE.y0, width, LANE.y1 - LANE.y0);
  for (let i = 0; i < width / 3; i++) px(rnd() < 0.5 ? '#b58d58' : '#d8b57e', Math.floor(rnd() * width), LANE.y0 + Math.floor(rnd() * (LANE.y1 - LANE.y0)), 2, 1);
  px('#a88250', 0, LANE.y0, width, 2);
  // fences: rails along both edges of the lane, posts every 32 px
  for (const y of [LANE.y0 - 4, LANE.y1 + 2]) {
    px('#2a1a10', 0, y - 1, width, 4); px('#8a5a3a', 0, y, width, 2);
    for (let x = 4; x < width; x += 32) { px('#2a1a10', x - 1, y - 9, 6, 13); px('#a87250', x, y - 8, 4, 11); px('#c89060', x, y - 8, 1, 11); }
  }
  return c;
}

/** One jump: two standards at the lane's edges and a striped pole across; a knocked pole lies on the sand. */
function drawJump(ctx: CanvasRenderingContext2D, j: Jump, x: number) {
  const top = LANE.y0 + 4, bottom = LANE.y1 - 4;
  if (j.down) {
    // the knocked pole lies slanted in the sand, one end still near its standard
    for (let i = 0, n = bottom - top - 6; i < n; i += 2) {
      const px = Math.round(x + 2 + (i / n) * 22), py = top + 4 + i;
      ctx.fillStyle = 'rgba(30, 40, 10, 0.25)'; ctx.fillRect(px + 1, py + 2, 3, 2);
      ctx.fillStyle = Math.floor(i / 6) % 2 ? j.colour : '#ffffff'; ctx.fillRect(px, py, 3, 2);
    }
  } else {
    ctx.fillStyle = 'rgba(30, 40, 10, 0.25)'; ctx.fillRect(x + 4, top + 6, 3, bottom - top);
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 1, top - 9, 4, bottom - top + 2);
    for (let y = top - 8; y < bottom - 8; y += 6) { ctx.fillStyle = (y / 6) % 2 < 1 ? '#ffffff' : j.colour; ctx.fillRect(x, y, 2, 6); }
  }
  for (const y of [top, bottom]) {
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 3, y - 16, 8, 18);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 15, 6, 16);
    ctx.fillStyle = j.colour; ctx.fillRect(x - 2, y - 15, 6, 3); ctx.fillRect(x - 2, y - 8, 6, 3);
  }
}

/** Runs one round on `canvas`; resolves with the number of knocked poles once the horse is past the finish. */
export async function startJumping(canvas: HTMLCanvasElement, o: JumpingOptions) {
  const sheet = await horseSheet(o.look, 'gallop');
  const jumps: Jump[] = Array.from({ length: o.jumps }, (_, i) => ({ x: FIRST + i * SPACING, colour: ['#d94f3d', '#3d6fd9', '#f2c14e'][i % 3], done: false, down: false }));
  const finish = FIRST + (o.jumps - 1) * SPACING + RUN_OUT, course = paintCourse(BEFORE + finish + 400);
  const ctx = canvas.getContext('2d')!, s = seat(o.look.build, 'E');
  let S = 1, W = 0, x = 0, t = 0, acc = 0, last = performance.now(), running = true;
  let air: { from: number; to: number } | null = null;
  let done = (_faults: number) => {};
  const result = new Promise<number>((r) => { done = r; });

  function fit() {
    S = fitPixels(innerWidth, innerHeight).scale + 1;
    W = Math.floor(innerWidth / S);
    canvas.width = W; canvas.height = Math.floor(innerHeight / S);
    canvas.style.width = `${W * S}px`; canvas.style.height = `${canvas.height * S}px`;
  }

  const ideal = (j: Jump) => j.x - TAKEOFF; // where the hooves should leave the ground
  /** The next jump still to come, if the horse is close enough to take off for it. */
  const upcoming = () => jumps.find((j) => !j.done && x > ideal(j) - SPEED * 0.6);

  function step() {
    t += STEP; x += SPEED * STEP;
    if (air && x >= air.to) air = null;
    // a jump nobody tapped for: the horse runs into the pole
    for (const j of jumps) if (!j.done && x > ideal(j) + SPEED * (o.window / 2 + 0.15)) { j.done = true; j.down = true; }
    if (x >= finish && running) { running = false; done(jumps.filter((j) => j.down).length); }
  }

  function draw() {
    const cam = Math.round(x - W * 0.3), oy = Math.round((canvas.height - H) / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, -cam, oy);
    ctx.fillStyle = '#5a9a3a'; ctx.fillRect(cam, -oy, W, canvas.height);
    ctx.drawImage(course, cam + BEFORE, 0, W, H, cam, 0, W, H);
    // the green take-off patches, as wide as the window
    for (const j of jumps) if (!j.done) {
      const half = (o.window / 2) * SPEED;
      ctx.fillStyle = 'rgba(120, 220, 90, 0.55)'; ctx.fillRect(Math.round(ideal(j) - half), LANE.y0 + 2, Math.round(half * 2), LANE.y1 - LANE.y0 - 4);
    }
    // the finish: a chequered line
    for (let y = LANE.y0; y < LANE.y1; y += 4) { ctx.fillStyle = (y / 4) % 2 ? '#ffffff' : '#2a1a10'; ctx.fillRect(finish, y, 4, 4); ctx.fillStyle = (y / 4) % 2 ? '#2a1a10' : '#ffffff'; ctx.fillRect(finish + 4, y, 4, 4); }
    // jumps behind the horse's hooves first, the horse, then the rest: poles across the lane overlap correctly
    const lift = air ? Math.sin(((x - air.from) / (air.to - air.from)) * Math.PI) : 0;
    for (const j of jumps) if (j.x < x - 8) drawJump(ctx, j, j.x);
    shadow(ctx, x, HOOVES - 1, 24 - lift * 6, 4, 0.28 - lift * 0.1);
    ctx.save();
    // in the air the horse grows, as if closer to us, and rises above its shadow
    const grow = 1 + lift * 0.3;
    ctx.translate(x, HOOVES - lift * 16); ctx.scale(grow, grow); ctx.translate(-x, -HOOVES);
    blit(ctx, sheet, [(Math.floor(t * 11) % 6) * 128, 3 * 128, 128, 128], x - 64, HOOVES - 93);
    drawRider(ctx, o.kid, x + s.dx, HOOVES + s.dy, 'E');
    ctx.restore();
    for (const j of jumps) if (j.x >= x - 8) drawJump(ctx, j, j.x);
  }

  function frame(now: number) {
    if (!running && x >= finish + 60) return;
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    while (acc >= STEP) { acc -= STEP; step(); }
    draw();
    requestAnimationFrame(frame);
  }

  fit();
  addEventListener('resize', fit);
  draw();
  return {
    /** Starts the gallop; resolves with the faults when the horse is past the finish. */
    run() { last = performance.now(); requestAnimationFrame(frame); return result; },
    /** The player tapped: take off for the next jump, cleared or not as the judge says. */
    tap() {
      const j = upcoming();
      if (!j || air) return;
      j.done = true;
      j.down = !o.judge((x - ideal(j)) / SPEED);
      air = { from: x, to: Math.max(x + 2 * TAKEOFF, j.x + TAKEOFF) };
    },
    stop() { running = false; x = Infinity; removeEventListener('resize', fit); },
  };
}
