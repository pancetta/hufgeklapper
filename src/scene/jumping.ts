/**
 * The jumping minigame on the show-jumping arena ("Springplatz"), seen from above (#43): sand, a white fence, the
 * numbered jumps, start and finish flags; the next jump has a yellow number, an arrow and a green take-off patch as
 * wide as the Sim's take-off window. One finger does it all (#47): drawing paints the way the horse rides, from the
 * horse onwards and mid-ride too; a short tap anywhere is "Hopp!". Drawing and input only: how the horse
 * moves, refuses and lands, and what counts as a fault, is the Sim's round (src/sim/round.ts).
 */
import { horseSheet } from '../horses/compose';
import type { Look } from '../horses/look';
import type { Kid } from '../riders/look';
import { DATA } from '../sim/data';
import { ANGLE, autopilot, type Course, type CourseJump, type Dir, follow, hopp, newRound, type Point, type Round, step, touchDown } from '../sim/round';
import { blit, shadow } from './draw';
import { drawRider } from './kids';
import { seat } from './life';

export type JumpingOptions = {
  look: Look;
  kid: Kid;
  course: Course;
  window: number; // seconds; drawn as the green take-off patch
  judge: (offset: number) => 'early' | 'clear' | 'fault'; // the Sim's `takeOff` for this horse
  onChange?: (r: Round) => void; // for the round's counters (jump, faults, time)
};

const A = DATA.jumping.arena, R = DATA.jumping.ride, STEP = 1 / 60, LIFT = 6; // poles rest this high above the sand
const ROW: Record<Dir, number> = { N: 0, W: 1, S: 2, E: 3 };
const COLOURS = ['#d94f3d', '#3d6fd9', '#f2c14e', '#3da35a'];
const across = (d: Dir) => d === 'E' || d === 'W'; // a jump ridden east or west has its poles running down the screen
const dirOf = (heading: number): Dir => {
  const c = Math.cos(heading), s = Math.sin(heading);
  return Math.abs(c) >= Math.abs(s) ? (c > 0 ? 'E' : 'W') : s > 0 ? 'S' : 'N';
};

/** The arena drawn once: grass around, sand with a raked look, a white fence with posts, flowers along it. */
function paintArena() {
  const c = document.createElement('canvas');
  c.width = A.w; c.height = A.h;
  const g = c.getContext('2d')!, px = (color: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  px('#5a9a3a', 0, 0, A.w, A.h);
  const f = A.fence;
  px('#d8b57e', f, f, A.w - 2 * f, A.h - 2 * f);
  for (let i = 0; i < 2200; i++) px(rnd() < 0.5 ? '#c9a26a' : '#e4c592', f + Math.floor(rnd() * (A.w - 2 * f)), f + Math.floor(rnd() * (A.h - 2 * f)), 2, 1);
  for (let y = f + 6; y < A.h - f; y += 12) px('rgba(150, 110, 60, 0.18)', f, y, A.w - 2 * f, 1); // raked lines
  // the fence: two white rails with dark edges, posts every 24 px
  const rail = (x: number, y: number, w: number, h: number) => { px('#2a1a10', x - 1, y - 1, w + 2, h + 2); px('#f4f1e8', x, y, w, h); };
  for (const y of [f - 6, A.h - f + 1]) { rail(4, y, A.w - 8, 2); rail(4, y + 3, A.w - 8, 1); }
  for (const x of [f - 6, A.w - f + 1]) { rail(x, 4, 2, A.h - 8); rail(x + 3, 4, 1, A.h - 8); }
  for (let x = 4; x < A.w; x += 24) for (const y of [f - 9, A.h - f - 2]) { px('#2a1a10', x - 1, y, 5, 9); px('#ffffff', x, y + 1, 3, 7); }
  for (let y = 4; y < A.h; y += 24) for (const x of [f - 7, A.w - f]) { px('#2a1a10', x, y - 1, 5, 6); px('#ffffff', x + 1, y, 3, 4); }
  // flowers on the grass outside
  for (let i = 0; i < 70; i++) {
    const edge = i % 4, t = rnd();
    const x = edge < 2 ? 4 + t * (A.w - 8) : edge === 2 ? 2 + rnd() * 3 : A.w - 5 + rnd() * 3;
    const y = edge === 0 ? 1 + rnd() * 3 : edge === 1 ? A.h - 4 + rnd() * 3 : 4 + t * (A.h - 8);
    px(['#ffe066', '#ffffff', '#ff8fc7', '#7ec8ff'][i % 4], Math.floor(x), Math.floor(y), 2, 2);
  }
  return c;
}

/** A striped pole from (x0, y0) to (x1, y1), its shadow `drop` pixels lower on the sand. */
function pole(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, colour: string, drop = LIFT) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (drop) { ctx.fillStyle = 'rgba(60, 40, 10, 0.25)'; ctx.fillRect(x + 1, y + drop, 2, 2); }
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 1, y - 1, 3, 3);
  }
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    ctx.fillStyle = Math.floor(i / 5) % 2 ? colour : '#ffffff'; ctx.fillRect(x, y, 1, 1);
  }
}

/** A white standard with coloured bands, standing on the sand at (x, y). */
function standard(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string) {
  ctx.fillStyle = 'rgba(60, 40, 10, 0.25)'; ctx.fillRect(x - 1, y, 5, 2);
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 2, y - 11, 5, 12);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 10, 3, 10);
  ctx.fillStyle = colour; ctx.fillRect(x - 1, y - 8, 3, 2); ctx.fillRect(x - 1, y - 4, 3, 2);
}

/** One jump from above: standards at both ends, poles across between them; a knocked pole lies on the sand. */
function drawJump(ctx: CanvasRenderingContext2D, j: CourseJump, colour: string, fallen: boolean) {
  const h = R.half, a = ANGLE[j.dir], ux = Math.round(Math.cos(a)), uy = Math.round(Math.sin(a));
  // the parts of the jump, nearest to the horse first: an oxer has a second, higher part 7 px behind
  const parts = j.kind === 'oxer' ? [0, 7] : [0];
  for (const d of parts) {
    const x = j.x + ux * d, y = j.y + uy * d, last = fallen && d === parts[parts.length - 1];
    const [ax, ay, bx, by] = across(j.dir) ? [x, y - h, x, y + h] : [x - h, y, x + h, y];
    standard(ctx, ax, ay, colour); standard(ctx, bx, by, colour);
    if (last) { pole(ctx, ax + 3, ay + 4, bx - 3 + (across(j.dir) ? 6 : 0), by + (across(j.dir) ? -2 : 5), colour, 0); continue; } // on the sand, slanted
    if (j.kind === 'cross') { pole(ctx, ax, ay - 9, bx, by - 2, colour); pole(ctx, ax, ay - 2, bx, by - 9, colour); }
    else pole(ctx, ax, ay - LIFT - (d ? 2 : 0), bx, by - LIFT - (d ? 2 : 0), colour);
  }
}

/** The jump's number on a small plate by its first standard; the next jump's plate is yellow and bounces. */
function plate(ctx: CanvasRenderingContext2D, j: CourseJump, n: number, next: boolean, t: number) {
  const x = across(j.dir) ? j.x - 12 : j.x - R.half - 12, y = (across(j.dir) ? j.y - R.half : j.y) - 18 - (next ? Math.round(Math.abs(Math.sin(t * 4)) * 2) : 0);
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 1, y - 1, 11, 11);
  ctx.fillStyle = next ? '#ffd23f' : '#ffffff'; ctx.fillRect(x, y, 9, 9);
  ctx.fillStyle = '#2a1a10'; ctx.font = '12px VT323, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(n), x + 5, y + 5);
}

/** For the next jump: the green take-off patch, as wide as the window, and two arrows showing the way to jump it. */
function guide(ctx: CanvasRenderingContext2D, j: CourseJump, window: number, t: number) {
  const a = ANGLE[j.dir], ux = Math.cos(a), uy = Math.sin(a), w = window * R.speed;
  // jumps face N, E, S or W, so the patch is a plain rectangle
  const [s0, s1, l] = [-R.takeoff - w / 2, -R.takeoff + w / 2, R.half - 3], xs = [j.x + ux * s0 - uy * l, j.x + ux * s1 + uy * l], ys = [j.y + uy * s0 + ux * l, j.y + uy * s1 - ux * l];
  ctx.fillStyle = 'rgba(120, 220, 90, 0.5)';
  ctx.fillRect(Math.round(Math.min(...xs)), Math.round(Math.min(...ys)), Math.round(Math.abs(xs[1] - xs[0])), Math.round(Math.abs(ys[1] - ys[0])));
  ctx.fillStyle = `rgba(255, 255, 255, ${0.55 + 0.35 * Math.sin(t * 5)})`;
  for (const s of [-R.takeoff - 30, -R.takeoff - 42]) for (let k = 0; k < 5; k++) for (const side of [-1, 1]) {
    // a chevron pointing the way to ride: its tip at the centre line
    const d = s + k - 4, l = side * (4 - k) * 1.5;
    ctx.fillRect(Math.round(j.x + ux * d - uy * l), Math.round(j.y + uy * d + ux * l), 2, 2);
  }
}

/** Start and finish: a flag on each side (red right, white left, as in a real show) and the line between them. */
function gate(ctx: CanvasRenderingContext2D, [x, y, dir]: Course['start'], finish: boolean) {
  const a = ANGLE[dir], ux = Math.cos(a), uy = Math.sin(a), h = R.half * (finish ? 1.5 : 1);
  if (finish) for (let l = -h; l <= h; l += 2) { ctx.fillStyle = Math.round(l / 2) % 2 ? '#2a1a10' : '#ffffff'; ctx.fillRect(Math.round(x - uy * l), Math.round(y + ux * l), 2, 2); }
  for (const side of [-1, 1]) {
    const fx = Math.round(x - uy * h * side), fy = Math.round(y + ux * h * side);
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(fx, fy - 14, 1, 15);
    ctx.fillStyle = side > 0 ? '#d94f3d' : '#ffffff'; ctx.fillRect(fx + 1, fy - 14, 5, 4);
  }
}

/** Runs one round on `canvas`; resolves with its faults once the horse is through the finish. */
export async function startJumping(canvas: HTMLCanvasElement, o: JumpingOptions) {
  const [gallop, idle] = await Promise.all([horseSheet(o.look, 'gallop'), horseSheet(o.look, 'idle')]);
  const arena = paintArena(), ctx = canvas.getContext('2d')!, c = o.course;
  let r = newRound(c), S = 1, W = 0, H = 0, ox = 0, oy = 0, acc = 0, last = performance.now(), running = false, stopped = false;
  let path: Point[] = [], box = canvas.getBoundingClientRect();
  let touch: { id: number; x: number; y: number; at: number; t: number; drawing: boolean } | null = null; // the finger down now
  let done = (_faults: number) => {};
  const result = new Promise<number>((ok) => { done = ok; });

  function fit() {
    S = Math.max(1, Math.floor(Math.min(innerWidth / (A.w + 8), innerHeight / (A.h + 8))));
    W = Math.floor(innerWidth / S); H = Math.floor(innerHeight / S);
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * S}px`; canvas.style.height = `${H * S}px`;
    ox = Math.max(0, Math.floor((W - A.w) / 2)); oy = Math.max(0, Math.floor((H - A.h) / 2));
    box = canvas.getBoundingClientRect();
  }
  const toArena = (e: PointerEvent) => { const b = canvas.getBoundingClientRect(); return { x: (e.clientX - b.left) / S - ox, y: (e.clientY - b.top) / S - oy }; };

  function drawHorse(t: number) {
    const dir = dirOf(r.heading), s = seat(o.look.build, dir), side = dir === 'W' || dir === 'E';
    const phase = r.air ? (r.t - r.air.from) / (r.air.to - r.air.from) : -1, lift = phase < 0 ? 0 : Math.sin(phase * Math.PI);
    shadow(ctx, r.x, r.y - 1, (side ? 22 : 11) - lift * 4, 4, 0.26 - lift * 0.1);
    ctx.save();
    // in the air the horse grows, as if closer to us, and rises above its shadow
    const grow = 1 + lift * 0.25;
    ctx.translate(r.x, r.y - lift * 14); ctx.scale(grow, grow); ctx.translate(-r.x, -r.y);
    // the jump pose from the side: legs stretched at take-off, tucked over the pole, reaching out to land
    const f = phase < 0 ? Math.floor(t * 11) % 6 : !side ? Math.floor(t * 11) % 6 : phase < 0.25 ? 3 : phase < 0.75 ? 0 : 4;
    const [sheet, frame] = r.stopped || !running ? [idle, [ROW[dir] * 128, 0, 128, 128] as const] : [gallop, [f * 128, ROW[dir] * 128, 128, 128] as const];
    blit(ctx, sheet, frame, r.x - 64, r.y - 93);
    drawRider(ctx, o.kid, r.x + s.dx, r.y + s.dy, dir);
    if (dir === 'S') { // coming towards us, the head and neck are in front of the child
      ctx.beginPath(); ctx.rect(r.x - 64, r.y - 93, 128, 93 + s.dy - 2); ctx.clip();
      blit(ctx, sheet, frame, r.x - 64, r.y - 93);
    }
    ctx.restore();
  }

  function draw() {
    const t = performance.now() / 1000;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#5a9a3a'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(1, 0, 0, 1, ox, oy);
    ctx.drawImage(arena, 0, 0);
    gate(ctx, c.start, false); gate(ctx, c.finish, true);
    const next = c.jumps[r.next];
    if (next && !r.air) guide(ctx, next, o.window, t);
    // the way still to ride: white dots on the sand
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (const p of path) ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
    // jumps and horse by where they stand; in the air the horse is above every pole
    // (poles running down the screen: the part below the hooves again, after the horse)
    const jump = (j: CourseJump, i: number) => drawJump(ctx, j, COLOURS[i % COLOURS.length], r.down.includes(i));
    const items = c.jumps.map((j, i) => ({ y: j.y - (across(j.dir) ? R.half : 0), draw: () => jump(j, i) }));
    items.push({ y: r.air ? Infinity : r.y, draw: () => {
      drawHorse(t);
      c.jumps.forEach((j, i) => {
        if (r.air || !across(j.dir) || r.y < j.y - R.half || r.y > j.y + R.half) return;
        ctx.save(); ctx.beginPath(); ctx.rect(0, r.y, A.w, A.h); ctx.clip(); jump(j, i); ctx.restore();
      });
    } });
    c.jumps.forEach((j, i) => plate(ctx, j, i + 1, i === r.next, t)); // signs on the sand, under a jumping horse
    for (const it of items.sort((a, b) => a.y - b.y)) it.draw();
    // for the Playwright round: where a rider who knows the way would point, and whether to press "Hopp!" now
    if (!running) return;
    const a = autopilot(r, c, o.window * 0.4);
    canvas.dataset.aim = `${Math.round(box.left + (ox + a.x) * S)},${Math.round(box.top + (oy + a.y) * S)}`;
    canvas.dataset.hopp = a.hopp ? '1' : '';
  }

  function frame(now: number) {
    if (stopped) return;
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    while (running && acc >= STEP) {
      acc -= STEP;
      const before = r;
      const f = follow(r, path);
      path = f.path;
      r = step(r, c, STEP, f.target);
      if (r.stopped && !before.stopped) path = []; // a refusal: the horse turns round, the child draws a new way
      if (r.next !== before.next || r.faults !== before.faults || Math.floor(r.t) !== Math.floor(before.t)) o.onChange?.(r);
      if (r.done) { running = false; done(r.faults); }
    }
    draw();
    requestAnimationFrame(frame);
  }

  // one finger: moving it draws a new way from the horse on; a touch on time or late takes off at once; an earlier
  // short tap without moving is "Hopp!" too, judged from the touch
  const TAP = { ms: 350, px: 10 };
  const judged = (next: Round) => { if (next !== r) { r = next; o.onChange?.(r); } };
  canvas.addEventListener('pointerdown', (e) => {
    if (touch) return; // a second finger or a palm doesn't take over
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now(), t: r.t, drawing: false };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer knows: drawing still works on the canvas */ }
    if (running) judged(touchDown(r, c, o.judge));
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== touch?.id) return;
    if (!touch.drawing && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) < TAP.px) return;
    const p = toArena(e);
    if (!touch.drawing || !path.length) { touch.drawing = true; path = [{ x: r.x, y: r.y }]; } // a new stroke, or after a refusal
    const last = path[path.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) >= 4) path.push(p);
  });
  const lift = (e: PointerEvent) => {
    if (e.pointerId !== touch?.id) return;
    const tap = !touch.drawing && performance.now() - touch.at < TAP.ms && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) < TAP.px;
    const lag = r.t - touch.t;
    touch = null;
    if (tap && running) judged(hopp(r, c, o.judge, lag)); // nothing if the touch already took off
  };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', (e) => { if (e.pointerId === touch?.id) touch = null; });
  const onResize = () => { fit(); draw(); };
  fit();
  addEventListener('resize', onResize);
  draw();
  requestAnimationFrame(frame); // the arena lives before "Los!" too
  return {
    /** Starts the canter; resolves with the faults once the horse is through the finish. */
    run() { running = true; last = performance.now(); acc = 0; return result; },
    /** "Hopp!": take off, if the horse is lined up for the next jump. */
    hopp() { if (running) judged(hopp(r, c, o.judge)); },
    stop() { stopped = true; running = false; removeEventListener('resize', onResize); },
  };
}
