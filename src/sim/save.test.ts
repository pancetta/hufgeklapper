import { DATA } from './data';
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
      { ...save, state: { ...save.state, avatar: { ...save.state.avatar, jacket: 99 } } },
      { ...save, state: { ...save.state, avatar: { ...save.state.avatar, hair: 'glatze' } } },
      { ...save, state: { ...save.state, avatar: { ...save.state.avatar, name: '' } } },
    ];
    for (const b of broken) expect(parseSave(text(b))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('gives a save from version 5 (before the avatar editor) the default figure', () => {
    const now = toSave(played(), 'Hof');
    const { avatar: _, ...old } = now.state;
    const p = parseSave(text({ ...now, version: 5, state: { ...old, version: 5 } }));
    expect(p.ok && p.save.state.avatar).toEqual(DATA.avatar);
  });

  it('reads a save from version 1 (before the day cycle) and brings it up to date', () => {
    const now = toSave(played(), 'Hof');
    const v1 = { ...now, version: 1, state: { ...now.state, version: 1, night: undefined, careDone: undefined, debt: undefined, today: undefined, bill: undefined, pupils: undefined, reputation: undefined, lessonsGiven: undefined, horses: now.state.horses.map(({ rest: _, ...h }) => h) } };
    const p = parseSave(text(v1));
    expect(p.ok && p.save.state.horses.every((h) => h.rest === 0) && p.save.state.night).toEqual([]);
    expect(p.ok && p.save.state.careDone).toEqual({ groom: 0, hooves: 0, feed: 0, muck: 0 });
    expect(p.ok && [p.save.state.debt, p.save.state.today, p.save.state.bill]).toEqual([0, [], []]);
    // pupils wait at once, for that day
    expect(p.ok && p.save.state.pupils.length).toBeGreaterThan(0);
    expect(p.ok && p.save.state.pupils.every((x) => x.id.startsWith(`d${now.state.day}-`))).toBe(true);
    expect(p.ok && p.save.state.lessonsGiven).toBe(0);
    expect(p.ok && p.save.version).toBe(SAVE_VERSION);
  });
});
