/**
 * The cross-country ride (#73) from the side: the horse goes right through fields and woods, the land scrolls past
 * (far hills slowly, the near meadow fast). Logs, a hedge, a bank, a ditch and a pond are our own pixels; a green strip
 * on the ground shows where to tap "Hopp!". The round is the Sim's (xc.ts): the scene feeds in the pace and the taps.
 */
import { horseSheet } from '../horses/compose';
import type { Look } from '../horses/look';
import { fitPixels } from '../pixel';
import type { Kid } from '../riders/look';
import { DATA } from '../sim/data';
import { newXcRound, type Pace, type Refusal, type XcCourse, xcHopp, xcOffset, type XcRound, xcStep } from '../sim/xc';
import { shadow } from './draw';
import { drawRider } from './kids';
import { seat } from './life';

export type XcOptions = {
  look: Look; kid: Kid; course: XcCourse;
  window: number; // the horse's take-off window (seconds)
  drain: number; // how fast galloping tires this horse (1: normal)
  stamina: number; // 0–1, from its energy
  onChange?: (r: XcRound) => void; // counters: obstacle, faults, time, stamina
  onRefuse?: (why: Refusal) => void;
};

const X = DATA.crossCountry, STEP = 1 / 60;
const M = 24; // pixels a metre: a pony's body is about 2.3 m long

export async function startCrossCountry(canvas: HTMLCanvasElement, o: XcOptions) {
  const [gallop, walk, idle] = await Promise.all([horseSheet(o.look, 'gallop'), horseSheet(o.look, 'walk'), horseSheet(o.look, 'idle')]);
  const ctx = canvas.getContext('2d')!, c = o.course;
  let r = newXcRound(o.stamina), pace: Pace = 'trot', W = 0, H = 0, S = 1, acc = 0, last = performance.now(), running = false, stopped = false;
  let done = (_faults: number) => {};
  const result = new Promise<number>((ok) => { done = ok; });

  function fit() {
    S = fitPixels(innerWidth, innerHeight).scale;
    W = Math.floor(innerWidth / S); H = Math.floor(innerHeight / S);
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * S}px`; canvas.style.height = `${H * S}px`;
  }
  const ground = () => Math.round(H * 0.66), horseX = () => Math.round(W * 0.2); // room ahead to see what comes
  const rect = (color: string, x: number, y: number, w: number, h: number) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  /** Sky, clouds, two ridges of hills and a wood far off scroll slower than the meadow: a little depth. */
  function drawLand(cam: number) {
    const g = ground(), sky = ['#8fcbec', '#9fd3ef', '#b0dbf2', '#c2e3f5', '#d4ebf7', '#e3f2f9'];
    sky.forEach((col, i) => rect(col, 0, Math.round((g * i) / sky.length), W, Math.ceil(g / sky.length) + 1));
    // clouds drifting slowly
    for (let i = Math.floor((cam * 0.05) / 160) - 1; i < (cam * 0.05 + W) / 160 + 1; i++) {
      const x = i * 160 - cam * 0.05 + ((i * 53) % 70), y = 14 + ((i * 37) % Math.max(10, Math.round(g * 0.25)));
      for (const [dx, dy, w, h] of [[0, 6, 44, 8], [8, 2, 22, 6], [24, 0, 16, 8], [-6, 10, 56, 4]]) rect('#ffffff', x + dx, y + dy, w, h);
      rect('#e6f2f8', x - 6, y + 13, 56, 2);
    }
    // two ridges of hills, the far one paler
    for (const [k, col, base, amp] of [[0.1, '#a9cf95', 0.42, 0.16], [0.22, '#8fbf74', 0.6, 0.1]] as const) {
      ctx.fillStyle = col;
      for (let x = 0; x < W + 4; x += 2) { const wx = x + cam * k; ctx.fillRect(x, Math.round(g * base - g * amp * (0.6 + 0.4 * Math.sin(wx / 90) * Math.sin(wx / 37 + 1))), 2, g); }
    }
    // a wood along the far side of the fields
    for (let i = Math.floor((cam * 0.45) / 22) - 1; i < (cam * 0.45 + W) / 22 + 2; i++) {
      const x = i * 22 - cam * 0.45 + ((i * 17) % 9), h = 26 + ((i * 7) % 14), y = g - 10;
      rect('#5a3e26', x + 9, y - 12, 4, 12);
      ctx.fillStyle = (i % 3) === 0 ? '#3f7a32' : (i % 3) === 1 ? '#4f8a3a' : '#5d9a45';
      ctx.beginPath(); ctx.arc(x + 11, y - 10 - h / 2, h / 2, 0, 7); ctx.fill();
      rect('rgba(255, 255, 255, 0.12)', x + 5, y - 10 - h * 0.8, 5, 4);
    }
    // the meadow, a rail fence behind the track (it shows the speed), the track, flowers in front
    rect('#7fb34a', 0, g - 10, W, H); rect('#8bbf55', 0, g - 10, W, 2);
    for (let i = Math.floor(cam / (3 * M)); i < (cam + W) / (3 * M) + 1; i++) { const x = i * 3 * M - cam; rect('#8a5a34', x, g - 22, 3, 18); }
    rect('#a0703f', 0, g - 20, W, 2); rect('#a0703f', 0, g - 12, W, 2);
    rect('#c9a76a', 0, g, W, 8); rect('#b8955a', 0, g + 8, W, 2);
    for (let i = Math.floor(cam / 9); i < (cam + W) / 9; i++) { const x = i * 9 - cam; rect((i % 2) ? '#6a9d3c' : '#94c75f', x, g + 14 + ((i * 5) % 30), 2, 2); }
    for (let i = Math.floor(cam / 23); i < (cam + W) / 23; i++) { const x = i * 23 - cam + ((i * 7) % 11); if (i % 3 === 0) { rect(['#f2c14e', '#ffffff', '#d94f7a'][i % 3 === 0 ? (i / 3) % 3 : 0], x, g + 26 + ((i * 13) % 26), 3, 3); } }
    // a post every 50 m: how far along
    for (let m = 50; m < c.length; m += 50) { const x = m * M - cam + horseX(); if (x > -10 && x < W + 10) { rect('#efe6d0', x, g - 14, 2, 14); rect('#d94f3d', x - 2, g - 16, 6, 3); } }
    // the finish: two flags
    const fx = c.length * M - cam + horseX();
    if (fx > -20 && fx < W + 20) { rect('#2b2b3a', fx, g - 40, 2, 40); rect('#d94f3d', fx + 2, g - 40, 12, 8); rect('#2b2b3a', fx, g + 2, 2, 10); rect('#d94f3d', fx + 2, g + 2, 12, 6); }
  }

  /** One obstacle where it stands; water is a pond the track runs through. */
  function drawObstacle(kind: string, x: number) {
    const g = ground();
    if (kind === 'log') {
      rect('#6b4226', x - M * 0.6, g - 14, M * 1.2, 14); rect('#8a5530', x - M * 0.6, g - 14, M * 1.2, 4);
      ctx.fillStyle = '#c49a6c'; ctx.beginPath(); ctx.arc(x - M * 0.6, g - 7, 7, 0, 7); ctx.fill(); rect('#8a5530', x - M * 0.6 - 2, g - 8, 4, 2);
    } else if (kind === 'hedge') {
      rect('#2f6b3a', x - M * 0.7, g - 22, M * 1.4, 22);
      for (let k = 0; k < 9; k++) rect(k % 2 ? '#43a047' : '#3c8a3f', x - M * 0.7 + (k * 37) % Math.round(M * 1.4 - 4), g - 22 + (k * 11) % 18, 4, 3);
    } else if (kind === 'bank') {
      ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.moveTo(x - M * 1.3, g); ctx.lineTo(x - M * 0.8, g - 16); ctx.lineTo(x + M * 1.3, g - 16); ctx.lineTo(x + M * 1.6, g); ctx.fill();
      rect('#7fb34a', x - M * 0.8, g - 18, M * 2.1, 3);
    } else if (kind === 'ditch') {
      rect('#3b2a1c', x - M * 0.6, g, M * 1.2, 14); rect('#5a8fb8', x - M * 0.6 + 2, g + 9, M * 1.2 - 4, 5);
      rect('#efe6d0', x - M * 0.8, g - 10, 2, 10); rect('#efe6d0', x + M * 0.6, g - 10, 2, 10); // the white posts
    } else {
      rect('#4f8fc8', x, g - 2, X.waterLength * M, 12); rect('#7fb6e0', x + 4, g - 2, X.waterLength * M - 8, 2);
      for (let k = 0; k < 4; k++) rect('#bfe3f5', x + 10 + k * 40, g + 3 + (k % 2) * 3, 8, 1);
      for (const ex of [x - 4, x + X.waterLength * M - 2]) for (let k = 0; k < 4; k++) rect(k % 2 ? '#5d8a3a' : '#4f7a32', ex + k * 2, g - 8 - (k % 3) * 3, 1, 10 + (k % 3) * 3); // reeds
    }
  }

  function drawHorse(t: number) {
    const g = ground(), x = horseX();
    const phase = r.air ? (r.t - r.air.from) / (r.air.to - r.air.from) : -1, lift = phase < 0 ? 0 : Math.sin(Math.max(0, Math.min(1, phase)) * Math.PI) * 18;
    const ob = c.obstacles[r.next], wet = ob?.kind === 'water' && r.s >= ob.at && r.s < ob.at + X.waterLength;
    shadow(ctx, x, g + 2, 22 - lift / 3, 3, 0.26);
    const standing = !r.v || r.stopped, fast = r.pace === 'gallop' && r.v > X.pace.trot;
    const fps = fast ? 11 : r.pace === 'trot' ? 9 : 6, f = phase >= 0 ? (phase < 0.25 ? 3 : phase < 0.75 ? 0 : 4) : Math.floor(t * fps) % 6;
    const [sheet, sx, sy] = standing ? [idle, 3 * 128, 0] : [fast || r.air ? gallop : walk, f * 128, 3 * 128];
    ctx.drawImage(sheet, sx, sy, 128, 128, x - 64, Math.round(g - 93 - lift), 128, 128);
    const s = seat(o.look.build, 'E');
    drawRider(ctx, o.kid, x + s.dx, Math.round(g + s.dy - lift), 'E');
    if (wet && r.v) for (let k = 0; k < 3; k++) rect('#d8eef8', x - 14 + ((t * 60 + k * 11) % 30), g - 4 - ((t * 40 + k * 7) % 8), 2, 2); // splashes
  }

  function draw(t: number) {
    ctx.imageSmoothingEnabled = false;
    const cam = r.s * M, g = ground();
    drawLand(cam);
    c.obstacles.forEach((ob, i) => {
      const x = ob.at * M - cam + horseX();
      if (x < -X.waterLength * M - 40 || x > W + 60) return;
      // the green take-off strip in front of the next jump: as wide as the window at this speed
      if (i === r.next && ob.kind !== 'water') {
        const v = Math.max(r.v, X.pace.trot), half = (o.window / 2) * v * M, tx = (ob.at - X.takeoff) * M - cam + horseX();
        rect('rgba(90, 200, 90, 0.55)', tx - half, g, half * 2, 8);
      }
      drawObstacle(ob.kind, x);
    });
    drawHorse(t);
    // for Playwright: when a careful rider taps, and which pace it would ride now
    const off = xcOffset(r, c);
    canvas.dataset.hopp = off !== null && Math.abs(off) < o.window * 0.3 ? '1' : '';
    const ob = c.obstacles[r.next], careful = ob && (ob.kind === 'water' || ob.kind === 'ditch') && ob.at - r.s < 14;
    canvas.dataset.advice = careful ? 'trot' : r.stamina > 0.35 ? 'gallop' : 'trot';
  }

  function frame(now: number) {
    if (stopped) return;
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    while (running && acc >= STEP) {
      acc -= STEP;
      const before = r;
      r = xcStep(r, c, STEP, pace, o.window, o.drain);
      if (r.refused && r.faults > before.faults && r.stopped) o.onRefuse?.(r.refused);
      if (Math.floor(r.t * 4) !== Math.floor(before.t * 4) || r.next !== before.next || r.faults !== before.faults) o.onChange?.(r);
      if (r.done) { running = false; done(r.faults); }
    }
    draw(now / 1000);
    requestAnimationFrame(frame);
  }

  const hopp = () => {
    if (!running) return;
    const before = r;
    r = xcHopp(r, c, o.window);
    if (r.refused && r.faults > before.faults) { o.onRefuse?.(r.refused); o.onChange?.(r); }
  };
  // a tap anywhere on the land is "Hopp!"
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); hopp(); });
  const onResize = () => { fit(); draw(performance.now() / 1000); };
  fit();
  addEventListener('resize', onResize);
  requestAnimationFrame(frame);
  return {
    /** Off it goes; resolves with the faults once the horse is through the finish. */
    run() { running = true; last = performance.now(); acc = 0; return result; },
    setPace(p: Pace) { pace = p; },
    hopp,
    stop() { stopped = true; running = false; removeEventListener('resize', onResize); },
  };
}
