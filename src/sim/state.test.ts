import { describe, expect, it } from 'vitest';
import { DATA } from './data';
import { apply, canBuild, isSick, NEEDS, newGame, roll, stalls } from './state';

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

  it('rolls the same numbers from the same seed', () => {
    const a = roll(42), b = roll(42);
    expect(a).toEqual(b);
    expect(a[0]).toBeGreaterThanOrEqual(0);
    expect(a[0]).toBeLessThan(1);
    expect(roll(a[1])[0]).not.toBe(a[0]);
  });
});
