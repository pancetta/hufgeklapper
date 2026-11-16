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

  it('a step that must wait does not happen: it says what to do first, the earliest step that can be done now', () => {
    const upTo = (id: StepId) => STEPS.slice(0, STEPS.findIndex((s) => s.id === id)).map((s) => s.id);
    // ready to bridle, but the halter is still on its head: round the neck first
    const ready = upTo('halterNeck');
    expect(tryStep(ready, 'bridle', 'head')).toEqual({ why: 'bridleOn', first: 'halterNeck' });
    expect(tryStep(ready, 'halter', 'neck')).toEqual({ step: 'halterNeck' });
    // the halter round the neck: now the reins come first
    expect(tryStep([...ready, 'halterNeck'], 'bridle', 'head')).toEqual({ why: 'bridleOn', first: 'reins' });
    // buckled and the girth tightened: now the rope comes off the ring; before that, tightening is next
    expect(tryStep(upTo('untie'), 'rope', 'ring')).toEqual({ step: 'untie' });
    expect(tryStep(upTo('tighten'), 'rope', 'ring')).toEqual({ why: 'done' }); // the rope was just used there: a second tap
    // no saddle before grooming: the first brush that is missing; the brushes in any order once the kit is there
    expect(tryStep(upTo('kardaetsche'), 'saddle', 'tack')).toEqual({ why: 'saddleGet', first: 'kardaetsche' });
    expect(tryStep(upTo('kardaetsche'), 'face', 'head')).toEqual({ step: 'face' });
    // out to the arena with only the whip missing: the whip
    expect(tryStep(upTo('toArena').filter((s) => s !== 'whip'), 'hand', 'arena')).toEqual({ why: 'toArena', first: 'whip' });
  });

  it('a second tap of the same thing on the same place is done, not the later step; a thing out of place does nothing', () => {
    expect(tryStep([], 'hand', 'box')).toEqual({ step: 'open' });
    expect(tryStep(['open'], 'hand', 'box')).toEqual({ why: 'done' }); // into the box only after riding, but that's not what a second tap means
    expect(tryStep(['open', 'halter'], 'halter', 'head')).toEqual({ why: 'done' });
    expect(tryStep(STEPS.map((s) => s.id), 'hand', 'box')).toEqual({ why: 'done' });
    expect(tryStep([], 'whip', 'tail')).toEqual({ why: 'none' });
  });

  it('body brushes work anywhere on the body: on the neck and belly (the Magic Brush also on the legs)', () => {
    const kit = STEPS.slice(0, STEPS.findIndex((s) => s.id === 'kardaetsche')).map((s) => s.id);
    expect(tryStep(kit, 'kardaetsche', 'neck')).toEqual({ step: 'kardaetsche' });
    expect(tryStep(kit, 'magic', 'legs')).toEqual({ step: 'magic' });
    expect(tryStep(kit, 'kardaetsche', 'legs')).toEqual({ why: 'none' });
  });
});
