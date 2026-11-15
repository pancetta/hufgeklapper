import { describe, expect, it } from 'vitest';
import { parseSave, SAVE_VERSION, toSave } from './save';
import { apply, newGame } from './state';

const played = () => apply(newGame(7), { type: 'sleep' });
const text = (x: unknown) => JSON.stringify(x);

describe('save files', () => {
  it('reads back exactly what was saved', () => {
    const save = toSave(played(), 'Sonnenhof', new Date('2026-11-15T10:00:00Z'));
    expect(parseSave(text(save))).toEqual({ ok: true, save });
  });

  it('says "invalid" for anything that is not a Hufgeklapper save', () => {
    for (const bad of ['', 'not json', text(null), text([]), text({ app: 'other', version: 1 }), text({ app: 'hufgeklapper' })])
      expect(parseSave(bad)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('says "newer" for a save from a later version, so it is not used or wiped', () => {
    expect(parseSave(text({ ...toSave(played(), 'Hof'), version: SAVE_VERSION + 1 }))).toEqual({ ok: false, reason: 'newer' });
  });

  it('refuses a save with a broken horse or farm', () => {
    const save = toSave(played(), 'Hof');
    const broken = [
      { ...save, state: { ...save.state, money: 1.5 } },
      { ...save, state: { ...save.state, stage: 'schloss' } },
      { ...save, state: { ...save.state, horses: [{ ...save.state.horses[0], needs: { ...save.state.horses[0].needs, fed: 120 } }] } },
      { ...save, state: { ...save.state, horses: [{ ...save.state.horses[0], look: { build: 'pony', coat: 'lila' } }] } },
      { ...save, state: { ...save.state, horses: [{ ...save.state.horses[0], look: { build: 'pony', coat: 'rappe', blanket: 'red' } }] } },
      { ...save, name: '' },
      { ...save, state: { ...save.state, horses: [{ ...save.state.horses[0], id: '"><img src=x onerror=alert(1)>' }] } },
    ];
    for (const b of broken) expect(parseSave(text(b))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('reads a save from version 1 (before the day cycle) and brings it up to date', () => {
    const now = toSave(played(), 'Hof');
    const v1 = { ...now, version: 1, state: { ...now.state, version: 1, night: undefined, horses: now.state.horses.map(({ rest: _, ...h }) => h) } };
    const p = parseSave(text(v1));
    expect(p.ok && p.save.state.horses.every((h) => h.rest === 0) && p.save.state.night).toEqual([]);
    expect(p.ok && p.save.version).toBe(SAVE_VERSION);
  });
});
