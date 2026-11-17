import { DATA } from './data';
import { describe, expect, it } from 'vitest';
import { parseSave, SAVE_VERSION, toSave } from './save';
import { apply, boardersFor, newGame, type State } from './state';

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

  it('reads back a Reitschule with its market, a bought horse and the buildings', () => {
    let s = { ...played(), goalsDone: ['groom', 'lessons', 'badge', 'savings', 'reputation'], money: 3000 } as ReturnType<typeof played>;
    s = apply(s, { type: 'inspection', answers: [0, 0, 0, 0, 0] });
    s = apply(apply(s, { type: 'build', what: 'stalls' }), { type: 'build', what: 'arena' });
    s = apply(apply(s, { type: 'buyHorse', offer: s.market[0].id }), { type: 'sleep' });
    expect(s.stage).toBe('reitschule');
    const save = toSave(s, 'Hof');
    expect(parseSave(text(save))).toEqual({ ok: true, save });
  });

  it('gives a save from version 17 no cross-country show ridden yet', () => {
    const now = toSave(played(), 'Hof');
    const { lastXcShowDay: _l, ...old } = now.state;
    const p = parseSave(text({ ...now, version: 17, state: { ...old, version: 17 } }));
    expect(p.ok && p.save.state.lastXcShowDay).toBe(0);
  });

  it('gives a save from version 16 no cross-country practice and no care course counted yet', () => {
    const now = toSave(played(), 'Hof');
    const { xcTrainings: _x, routines: _r, ...old } = now.state;
    const p = parseSave(text({ ...now, version: 16, state: { ...old, version: 16 } }));
    expect(p.ok && [p.save.state.xcTrainings, p.save.state.routines]).toEqual([0, 0]);
  });

  it('gives a save from version 15 the pasture its horses need (two ponies: none added; more horses: land up to the most)', () => {
    const now = toSave(played(), 'Hof');
    const { pasture: _p, ...built } = now.state.built;
    const old = (horses: typeof now.state.horses) => parseSave(text({ ...now, version: 15, state: { ...now.state, version: 15, built, horses } }));
    const p = old(now.state.horses);
    expect(p.ok && p.save.state.built.pasture).toBe(0);
    const big = { ...now.state.horses[0], look: { build: 'horse' as const, coat: 'brauner' as const } };
    const more = old([...now.state.horses, { ...big, id: 'b1' }, { ...big, id: 'b2' }]); // 2 + 4 = 6 places: one step
    expect(more.ok && more.save.state.built.pasture).toBe(1);
    const lots = old([...now.state.horses, ...[1, 2, 3, 4, 5, 6].map((i) => ({ ...big, id: `b${i}` }))]); // 14 places: the most there is
    expect(lots.ok && lots.save.state.built.pasture).toBe(DATA.build.pasture.max);
  });

  it('gives the horses of a save from version 14 a progress log that starts with their skills now', () => {
    const now = toSave(played(), 'Hof');
    const horses = now.state.horses.map(({ log: _l, ...h }) => h);
    const p = parseSave(text({ ...now, version: 14, state: { ...now.state, version: 14, horses } }));
    expect(p.ok && p.save.state.horses.map((h) => h.log)).toEqual(now.state.horses.map((h) => [[h.skills.jumping, h.skills.crossCountry]]));
  });

  it('gives the horses of a save from version 13 a cross-country skill, as new horses have', () => {
    const now = toSave(played(), 'Hof');
    const horses = now.state.horses.map(({ skills: { jumping }, log: _l, ...h }) => ({ ...h, skills: { jumping } }));
    const p = parseSave(text({ ...now, version: 13, state: { ...now.state, version: 13, horses } }));
    expect(p.ok && p.save.state.horses.map((h) => h.skills)).toEqual(now.state.horses.map((h) => ({ jumping: h.skills.jumping, crossCountry: 10 })));
  });

  it('gives a save from version 12 no dead end counted yet', () => {
    const now = toSave(played(), 'Hof');
    const { deadEnd: _a, ...old } = now.state;
    const p = parseSave(text({ ...now, version: 12, state: { ...old, version: 12 } }));
    expect(p.ok && p.save.state.deadEnd).toBe(0);
  });

  it('gives a save from version 11 (before Oma Hanne\'s help) no day of help yet', () => {
    const now = toSave(played(), 'Hof');
    const { rescueDay: _a, deadEnd: _b, ...old } = now.state;
    const p = parseSave(text({ ...now, version: 11, state: { ...old, version: 11 } }));
    expect(p.ok && p.save.state.rescueDay).toBe(0);
  });

  it('gives a save from version 10 (before the Pensionsstall) no grooms, boarders or riders', () => {
    const now = toSave(played(), 'Hof');
    const { staff: _a, boardOffers: _b, partOffer: _c, ...old } = now.state;
    const p = parseSave(text({ ...now, version: 10, state: { ...old, version: 10 } }));
    expect(p.ok && [p.save.state.staff, p.save.state.boardOffers, p.save.state.partOffer]).toEqual([0, [], null]);
  });

  it('keeps a Pensionsstall with a groom, a boarder\'s horse and a rider', () => {
    let s: State = { ...played(), stage: 'pensionsstall', money: 2000 };
    s = apply(s, { type: 'hire' });
    s = apply({ ...s, boardOffers: boardersFor(s.day, s.seed, [])[0] }, { type: 'board', offer: boardersFor(s.day, s.seed, [])[0][0].id });
    s = apply(s, { type: 'sleep' });
    const save = toSave(s, 'Hof');
    expect([s.staff, s.horses.some((h) => h.owner)]).toEqual([1, true]);
    expect(parseSave(text(save))).toEqual({ ok: true, save });
  });

  it('gives a save from version 9 (before the inspection) no market and nothing built', () => {
    const now = toSave(played(), 'Hof');
    const { inspectionFailedDay: _a, market: _b, built: _c, ...old } = now.state;
    const p = parseSave(text({ ...now, version: 9, state: { ...old, version: 9 } }));
    expect(p.ok && [p.save.state.inspectionFailedDay, p.save.state.market, p.save.state.built]).toEqual([0, [], { stalls: 0, arena: 0, pasture: 0 }]);
  });

  it('gives a save from version 8 (before goals) no goals and nothing explained', () => {
    const now = toSave(played(), 'Hof');
    const { goalsDone: _a, explained: _b, ...old } = now.state;
    const p = parseSave(text({ ...now, version: 8, state: { ...old, version: 8 } }));
    expect(p.ok && [p.save.state.goalsDone, p.save.state.explained]).toEqual([[], [...DATA.features]]);
    expect(parseSave(text({ ...now, state: { ...now.state, goalsDone: ['fliegen'] } }))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('gives a save from version 7 (before shows) no show ridden yet', () => {
    const now = toSave(played(), 'Hof');
    const { lastShowDay: _, ...old } = now.state;
    const p = parseSave(text({ ...now, version: 7, state: { ...old, version: 7 } }));
    expect(p.ok && p.save.state.lastShowDay).toBe(0);
  });

  it('gives a save from version 6 (before the riding badge) no practice and no badge', () => {
    const now = toSave(played(), 'Hof');
    const { trainings: _a, badges: _b, badgeFailedDay: _c, badgeQuizDay: _d, ...old } = now.state;
    const p = parseSave(text({ ...now, version: 6, state: { ...old, version: 6 } }));
    expect(p.ok && [p.save.state.trainings, p.save.state.badges, p.save.state.badgeFailedDay]).toEqual([0, 0, 0]);
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
