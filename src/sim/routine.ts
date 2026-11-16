/**
 * The care course ("Pflegekurs", #72): getting a horse ready step by step, riding it, and putting everything away.
 * The child picks a thing (or the hand) and taps a place or a part of the horse; that is the next step if it is one
 * and may come now. A step that must wait doesn't happen: `why` names it, and Oma Hanne says what has to come first.
 * Steps with the same thing and place (the halter goes on, round the neck, off) come in the order listed.
 */
import { DATA } from './data';
import type { Course } from './round';

export type Thing = 'hand' | 'halter' | 'rope' | 'kit' | 'kardaetsche' | 'magic' | 'root' | 'hoofpick' | 'face' | 'saddle' | 'bridle' | 'helmet' | 'vest' | 'gloves' | 'whip';
export type Spot = 'box' | 'ring' | 'tack' | 'tap' | 'arena' | 'rider' | 'head' | 'neck' | 'body' | 'belly' | 'legs' | 'tail';
export const THINGS: Thing[] = ['hand', 'halter', 'rope', 'kit', 'kardaetsche', 'magic', 'root', 'hoofpick', 'face', 'saddle', 'bridle', 'helmet', 'vest', 'gloves', 'whip'];

const GROOM = ['kardaetsche', 'magic', 'root', 'hooves', 'face', 'tail'] as const;
const step = <I extends string>(id: I, thing: Thing | null, at: Spot, after: readonly string[] = []) => ({ id, thing, at, after });
/** The course in its usual order; `after`: the steps that must be done first. The ride has no thing: the scene rides it. */
export const STEPS = [
  step('open', 'hand', 'box'),
  step('halter', 'halter', 'head', ['open']),
  step('leadOut', 'rope', 'head', ['halter']),
  step('tie', 'rope', 'ring', ['leadOut']),
  step('kit', 'kit', 'tack', ['tie']),
  step('kardaetsche', 'kardaetsche', 'body', ['kit']),
  step('magic', 'magic', 'body', ['kit']),
  step('root', 'root', 'legs', ['kit']),
  step('hooves', 'hoofpick', 'legs', ['kit']),
  step('face', 'face', 'head', ['kit']),
  step('tail', 'hand', 'tail', ['kit']),
  step('saddleGet', 'saddle', 'tack', GROOM),
  step('bridleGet', 'bridle', 'tack', GROOM),
  step('saddleOn', 'saddle', 'body', ['saddleGet']),
  step('girth', 'hand', 'belly', ['saddleOn']),
  step('stirrups', 'hand', 'body', ['girth']),
  step('helmet', 'helmet', 'rider'),
  step('vest', 'vest', 'rider'),
  step('gloves', 'gloves', 'rider'),
  step('halterNeck', 'halter', 'neck', ['bridleGet', 'girth', 'stirrups']),
  step('reins', 'bridle', 'neck', ['halterNeck']),
  step('bridleOn', 'bridle', 'head', ['reins']),
  step('straps', 'hand', 'head', ['bridleOn']),
  step('tighten', 'hand', 'belly', ['straps']),
  step('untie', 'rope', 'ring', ['tighten']),
  step('halterOff', 'halter', 'neck', ['untie']),
  step('whip', 'whip', 'tack'),
  step('toArena', 'hand', 'arena', ['halterOff', 'whip', 'helmet', 'vest', 'gloves']),
  step('ride', null, 'arena', ['toArena']),
  step('back', 'hand', 'ring', ['ride']),
  step('halterNeck2', 'halter', 'neck', ['back']),
  step('tie2', 'rope', 'ring', ['halterNeck2']),
  step('bridleOff', 'hand', 'head', ['tie2']),
  step('wash', 'bridle', 'tap', ['bridleOff']),
  step('halterOn', 'halter', 'head', ['bridleOff']),
  step('hooves2', 'hoofpick', 'legs', ['tie2']),
  step('girthOff', 'hand', 'belly', ['tie2']),
  step('saddleOff', 'saddle', 'tack', ['girthOff']),
  step('bridleAway', 'bridle', 'tack', ['wash']),
  step('untie2', 'rope', 'ring', ['halterOn', 'saddleOff', 'bridleAway', 'hooves2']),
  step('toBox', 'hand', 'box', ['untie2']),
  step('halterOff2', 'halter', 'head', ['toBox']),
  step('close', 'hand', 'box', ['halterOff2']),
  step('kitAway', 'kit', 'tack', ['close']),
  step('whipAway', 'whip', 'tack', ['close']),
] as const;
export type StepId = (typeof STEPS)[number]['id'];
/** Steps the scene finishes with a gesture (brush strokes, each hoof, each buckle) before they count. */
export const GESTURE: Partial<Record<StepId, 'brush' | 'hooves' | 'buckles'>> = { kardaetsche: 'brush', magic: 'brush', root: 'brush', face: 'brush', hooves: 'hooves', hooves2: 'hooves', straps: 'buckles', bridleOff: 'buckles' };

/** Body brushes work on the whole body: the neck and belly are body too (the Magic Brush also does the legs). */
const ALIAS: Partial<Record<Thing, Spot[]>> = { kardaetsche: ['neck', 'belly'], magic: ['neck', 'belly', 'legs'] };

/**
 * What a thing on a spot does now: the step it is, or why not. A step that must wait is `why` with `first`, the step
 * to do before it (the earliest one that can be done now). `done` when its step is done (a second tap, too), `none`
 * when the thing does nothing here.
 */
export function tryStep(done: readonly StepId[], thing: Thing, at: Spot): { step: StepId } | { why: StepId; first: StepId } | { why: 'done' | 'none' } {
  if (ALIAS[thing]?.includes(at)) at = 'body';
  const same = STEPS.filter((s) => s.thing === thing && s.at === at);
  if (!same.length) return { why: 'none' };
  const next = same.find((s) => !done.includes(s.id));
  if (!next) return { why: 'done' };
  if (next.after.every((a) => done.includes(a as StepId))) return { step: next.id };
  // the same thing again on the same place, right after it was used there: already done, not the later step
  if (same.indexOf(next) > 0) return { why: 'done' };
  return { why: next.id, first: firstFor(done, next.id) };
}

/** The earliest step in the usual order that can be done now and is needed (directly or not) before `id`. */
function firstFor(done: readonly StepId[], id: StepId): StepId {
  const need = new Set<string>(), add = (x: string) => { for (const a of STEPS.find((s) => s.id === x)!.after) if (!done.includes(a as StepId) && !need.has(a)) { need.add(a); add(a); } };
  add(id);
  return STEPS.find((s) => need.has(s.id) && s.after.every((a) => done.includes(a as StepId)))!.id;
}

/** The step that comes after `done` in the usual order: Oma's tip when the child doesn't know on. */
export const nextStep = (done: readonly StepId[]) => STEPS.find((s) => !done.includes(s.id) && s.after.every((a) => done.includes(a as StepId)))?.id ?? null;
export const finished = (done: readonly StepId[]) => STEPS.every((s) => done.includes(s.id));

const A = DATA.jumping.arena;
/** Leading at a walk on the arena (the warm-up before the lesson): no jumps, from the lower left up over a line at the top. */
export const WALK: Course = { start: [A.fence + 40, A.h - A.fence - 50, 'E'], finish: [A.w / 2, A.fence + 50, 'N'], jumps: [], pace: DATA.routine.pace };
