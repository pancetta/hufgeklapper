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
  step('stirrups', 'hand', 'body', ['saddleOn']),
  step('helmet', 'helmet', 'rider'),
  step('vest', 'vest', 'rider'),
  step('gloves', 'gloves', 'rider'),
  step('halterNeck', 'halter', 'neck', ['bridleGet', 'girth', 'stirrups']),
  step('reins', 'bridle', 'neck', ['halterNeck']),
  step('bridleOn', 'bridle', 'head', ['reins']),
  step('straps', 'hand', 'head', ['bridleOn']),
  step('untie', 'rope', 'ring', ['straps']),
  step('halterOff', 'halter', 'neck', ['untie']),
  step('whip', 'whip', 'tack', ['tie']),
  step('toArena', 'hand', 'arena', ['halterOff', 'whip', 'helmet', 'vest', 'gloves']),
  step('ride', null, 'arena', ['toArena']),
  step('back', 'hand', 'ring', ['ride']),
  step('halterNeck2', 'halter', 'neck', ['back']),
  step('tie2', 'rope', 'ring', ['halterNeck2']),
  step('bridleOff', 'hand', 'head', ['tie2']),
  step('wash', 'bridle', 'tap', ['bridleOff']),
  step('halterOn', 'halter', 'head', ['bridleOff']),
  step('girthOff', 'hand', 'belly', ['tie2']),
  step('saddleOff', 'saddle', 'tack', ['girthOff']),
  step('bridleAway', 'bridle', 'tack', ['wash']),
  step('untie2', 'rope', 'ring', ['halterOn', 'saddleOff', 'bridleAway']),
  step('toBox', 'hand', 'box', ['untie2']),
  step('halterOff2', 'halter', 'head', ['toBox']),
  step('close', 'hand', 'box', ['halterOff2']),
  step('kitAway', 'kit', 'tack', ['close']),
  step('whipAway', 'whip', 'tack', ['close']),
] as const;
export type StepId = (typeof STEPS)[number]['id'];
/** Steps the scene finishes with a gesture (brush strokes, each hoof, each buckle) before they count. */
export const GESTURE: Partial<Record<StepId, 'brush' | 'hooves' | 'buckles'>> = { kardaetsche: 'brush', magic: 'brush', root: 'brush', face: 'brush', hooves: 'hooves', straps: 'buckles', bridleOff: 'buckles' };

/**
 * What a thing on a spot does now: the step it is, or why not — the step that has to wait (its `why`), `done` when
 * every step with it is done, or `none` when it does nothing here.
 */
export function tryStep(done: readonly StepId[], thing: Thing, at: Spot): { step: StepId } | { why: StepId | 'done' | 'none' } {
  const same = STEPS.filter((s) => s.thing === thing && s.at === at);
  if (!same.length) return { why: 'none' };
  const next = same.find((s) => !done.includes(s.id));
  if (!next) return { why: 'done' };
  return next.after.every((a) => done.includes(a as StepId)) ? { step: next.id } : { why: next.id };
}

/** The step that comes after `done` in the usual order: Oma's tip when the child doesn't know on. */
export const nextStep = (done: readonly StepId[]) => STEPS.find((s) => !done.includes(s.id) && s.after.every((a) => done.includes(a as StepId)))?.id ?? null;
export const finished = (done: readonly StepId[]) => STEPS.every((s) => done.includes(s.id));

const A = DATA.jumping.arena;
/** The walk ride on the arena: no jumps, from the lower left round to a finish line at the top, at a walk. */
export const WALK: Course = { start: [A.fence + 40, A.h - A.fence - 50, 'E'], finish: [A.fence + 110, A.fence + 50, 'W'], jumps: [], pace: DATA.routine.pace };
