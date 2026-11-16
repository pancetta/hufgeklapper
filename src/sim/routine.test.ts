import { describe, expect, it } from 'vitest';
import { finished, nextStep, STEPS, type StepId, THINGS, tryStep } from './routine';

describe('the care course', () => {
  it('can be done in its usual order, each step by its thing and place, and is then finished', () => {
    const done: StepId[] = [];
    for (const s of STEPS) {
      expect(nextStep(done)).not.toBeNull();
      if (s.thing) expect(tryStep(done, s.thing, s.at)).toEqual({ step: s.id });
      done.push(s.id);
    }
    expect([finished(done), nextStep(done)]).toEqual([true, null]);
  });

  it('only lists things there are, and every step after steps that come before it', () => {
    const seen = new Set<string>();
    for (const s of STEPS) {
      if (s.thing) expect(THINGS).toContain(s.thing);
      for (const a of s.after) expect(seen, `${s.id} after ${a}`).toContain(a);
      seen.add(s.id);
    }
  });

  it('a step that must wait does not happen: the bridle not while the halter is on, the horse not loose before it is bridled', () => {
    const upTo = (id: StepId) => STEPS.slice(0, STEPS.findIndex((s) => s.id === id)).map((s) => s.id);
    // ready to bridle, but the halter is still on its head
    const ready = upTo('halterNeck');
    expect(tryStep(ready, 'bridle', 'head')).toEqual({ why: 'bridleOn' });
    expect(tryStep(ready, 'halter', 'neck')).toEqual({ step: 'halterNeck' });
    // bridled, buckled: now the rope comes off the ring
    expect(tryStep(upTo('untie'), 'rope', 'ring')).toEqual({ step: 'untie' });
    expect(tryStep(upTo('straps'), 'rope', 'ring')).toEqual({ why: 'untie' });
    // no saddle before grooming; the brushes in any order once the kit is there
    expect(tryStep(upTo('kardaetsche'), 'saddle', 'tack')).toEqual({ why: 'saddleGet' });
    expect(tryStep(upTo('kardaetsche'), 'face', 'head')).toEqual({ step: 'face' });
  });

  it('the same thing on the same place: the next of its steps, then done; a thing out of place does nothing', () => {
    expect(tryStep([], 'hand', 'box')).toEqual({ step: 'open' });
    expect(tryStep(['open'], 'hand', 'box')).toEqual({ why: 'toBox' }); // into the box only after riding
    expect(tryStep(STEPS.map((s) => s.id), 'hand', 'box')).toEqual({ why: 'done' });
    expect(tryStep([], 'whip', 'tail')).toEqual({ why: 'none' });
  });
});
