import { describe, expect, it } from 'vitest';
import { DATA } from './data';
import { apply, canBuild, canWork, isSick, NEEDS, newGame, type State, stalls } from './state';

describe('Sim', () => {
  it('starts a game with two ponies of different breeds and coats and the starting money', () => {
    const s = newGame(1);
    expect(s.horses).toHaveLength(2);
    expect(s.horses.every((h) => h.look.build === 'pony')).toBe(true);
    expect(new Set(s.horses.map((h) => h.breed)).size).toBe(2);
    expect(new Set(s.horses.map((h) => h.look.coat)).size).toBe(2);
    expect(s.money).toBe(DATA.start.money);
    expect(s.day).toBe(1);
  });

  it('moves to the next day overnight: needs fall, energy comes back, within 0 to 100', () => {
    const s = newGame(1), next = apply(s, { type: 'sleep' });
    expect(next.day).toBe(2);
    const before = s.horses[0].needs, after = next.horses[0].needs;
    expect(after.fed).toBeLessThan(before.fed);
    expect(after.energy).toBe(100);
    let t = s;
    for (let i = 0; i < 10; i++) t = apply(t, { type: 'sleep' });
    for (const h of t.horses) for (const n of NEEDS) expect(h.needs[n]).toBeGreaterThanOrEqual(0);
  });

  it('never changes the state it was given', () => {
    const s = newGame(1), copy = structuredClone(s);
    apply(s, { type: 'sleep' });
    expect(s).toEqual(copy);
  });

  it('has room for the starting ponies, and no building yet on the small farm', () => {
    const s = newGame(1);
    expect(stalls(s)).toBeGreaterThanOrEqual(s.horses.length);
    expect(canBuild(s)).toBe(false);
    expect(canBuild({ ...s, stage: 'reitschule' })).toBe(true);
  });

  it('calls a horse sick when its health is low', () => {
    const h = newGame(1).horses[0];
    expect(isSick(h)).toBe(false);
    expect(isSick({ ...h, needs: { ...h.needs, health: DATA.needs.sickBelow - 1 } })).toBe(true);
  });

  const nights = (s: State, n: number) => { for (let i = 0; i < n; i++) s = apply(s, { type: 'sleep' }); return s; };

  it('feeds each horse one bale overnight; with no hay left they go hungrier and grumpier', () => {
    const fed = apply(newGame(1), { type: 'sleep' });
    expect(fed.feed).toBe(newGame(1).feed - 2);
    const empty = apply({ ...newGame(1), feed: 0 }, { type: 'sleep' });
    expect(empty.horses[0].needs.fed).toBeLessThan(fed.horses[0].needs.fed);
    expect(empty.horses[0].needs.happy).toBeLessThan(fed.horses[0].needs.happy);
    expect(empty.night).toContainEqual({ kind: 'noHay', horse: 'kiwi' });
  });

  it('makes a neglected horse sick within a few nights, and says so in the morning', () => {
    let s = nights(newGame(1), 1), sickOn = 0;
    for (let d = 2; d < 10 && !sickOn; d++) { s = apply(s, { type: 'sleep' }); if (isSick(s.horses[0])) sickOn = s.day; }
    expect(sickOn).toBeGreaterThan(2);
    expect(sickOn).toBeLessThan(10);
    expect(s.night).toContainEqual({ kind: 'sick', horse: 'kiwi' });
    expect(canWork(s.horses[0])).toBe(false);
  });

  it('heals a well kept horse a little every night', () => {
    const h = newGame(1).horses[0];
    const kept: State = { ...newGame(1), horses: [{ ...h, needs: { ...h.needs, fed: 100, clean: 100, health: 50 } }] };
    expect(apply(kept, { type: 'sleep' }).horses[0].needs.health).toBe(50 + DATA.needs.healthGain);
  });

  it('lets the vet make a sick horse well for money; it rests for some nights, then works again', () => {
    const h = newGame(1).horses[0];
    const sick: State = { ...newGame(1), horses: [{ ...h, needs: { ...h.needs, health: 10 } }] };
    const treated = apply(sick, { type: 'vet', horse: 'kiwi' });
    expect(treated.money).toBe(sick.money - DATA.vet.cost);
    expect(isSick(treated.horses[0])).toBe(false);
    expect(canWork(treated.horses[0])).toBe(false);
    const rested = nights({ ...treated, horses: [{ ...treated.horses[0], needs: { ...treated.horses[0].needs, fed: 100, clean: 100 } }] }, DATA.vet.restDays);
    expect(canWork(rested.horses[0])).toBe(true);
    expect(rested.night).toContainEqual({ kind: 'rested', horse: 'kiwi' });
  });

  it('does not call the vet for a healthy horse or without the money', () => {
    const s = newGame(1);
    expect(apply(s, { type: 'vet', horse: 'kiwi' })).toBe(s);
    const h = s.horses[0], poor: State = { ...s, money: DATA.vet.cost - 1, horses: [{ ...h, needs: { ...h.needs, health: 10 } }] };
    expect(apply(poor, { type: 'vet', horse: 'kiwi' })).toBe(poor);
  });
});
