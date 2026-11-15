import { describe, expect, it } from 'vitest';
import { DATA } from './data';
import { apply, canBuild, canLoan, canQuickCare, cantTeach, canWork, earn, fit, isSick, lessonOutcome, NEEDS, newGame, type Pupil, roll, type State, stalls } from './state';

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
    // the news comes once, not every morning while it stays sick
    expect(apply(s, { type: 'sleep' }).night).not.toContainEqual({ kind: 'sick', horse: 'kiwi' });
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

  it('does not call a horse fit again while it is still sick', () => {
    const h = newGame(1).horses[0];
    const sick: State = { ...newGame(1), feed: 0, horses: [{ ...h, needs: { ...h.needs, fed: 0, clean: 0, health: 10 } }] };
    const after = nights(apply(sick, { type: 'vet', horse: 'kiwi' }), DATA.vet.restDays);
    expect(isSick(after.horses[0])).toBe(true);
    expect(after.night).not.toContainEqual({ kind: 'rested', horse: 'kiwi' });
  });

  it('does not call the vet for a healthy horse or without the money', () => {
    const s = newGame(1);
    expect(apply(s, { type: 'vet', horse: 'kiwi' })).toBe(s);
    const h = s.horses[0], poor: State = { ...s, money: DATA.vet.cost - 1, horses: [{ ...h, needs: { ...h.needs, health: 10 } }] };
    expect(apply(poor, { type: 'vet', horse: 'kiwi' })).toBe(poor);
  });

  it('fills the needs each care action is for, up to 100', () => {
    const s = nights(newGame(1), 2), h = s.horses[0];
    const groomed = apply(s, { type: 'care', horse: 'kiwi', what: 'groom' }).horses[0];
    expect(groomed.needs.clean).toBe(Math.min(100, h.needs.clean + DATA.care.groom.clean));
    const full = { ...s, horses: [{ ...h, needs: { ...h.needs, clean: 99 } }] };
    expect(apply(full, { type: 'care', horse: 'kiwi', what: 'groom' }).horses[0].needs.clean).toBe(100);
  });

  it('takes a hay bale for feeding, and feeds nothing from an empty store', () => {
    const s = newGame(1), fed = apply(s, { type: 'care', horse: 'luna', what: 'feed' });
    expect(fed.feed).toBe(s.feed - 1);
    expect(fed.horses[1].needs.fed).toBeGreaterThan(s.horses[1].needs.fed);
    const empty = { ...s, feed: 0 };
    expect(apply(empty, { type: 'care', horse: 'luna', what: 'feed' })).toBe(empty);
  });

  it('allows each care action once per horse and day', () => {
    const s = newGame(1), once = apply(s, { type: 'care', horse: 'kiwi', what: 'hooves' });
    expect(apply(once, { type: 'care', horse: 'kiwi', what: 'hooves' })).toBe(once);
    expect(apply(once, { type: 'care', horse: 'luna', what: 'hooves' })).not.toBe(once);
    expect(apply(apply(once, { type: 'sleep' }), { type: 'care', horse: 'kiwi', what: 'hooves' }).careDone.hooves).toBe(2);
  });

  it('unlocks quick care after five times by hand, and quick care does not count', () => {
    let s = newGame(1);
    expect(apply(s, { type: 'care', horse: 'kiwi', what: 'muck', quick: true })).toBe(s);
    for (let i = 0; i < DATA.quickCareAfter; i++) s = apply(apply(s, { type: 'care', horse: 'kiwi', what: 'muck' }), { type: 'sleep' });
    expect(canQuickCare(s, 'muck')).toBe(true);
    expect(canQuickCare(s, 'groom')).toBe(false);
    const quick = apply(s, { type: 'care', horse: 'kiwi', what: 'muck', quick: true });
    expect(quick.horses[0].cared).toContain('muck');
    expect(quick.careDone.muck).toBe(DATA.quickCareAfter);
  });

  it('sells hay for money, and on credit when the money is short', () => {
    const s = newGame(1), bought = apply(s, { type: 'buyHay', pack: 1 });
    expect([bought.feed, bought.money, bought.debt]).toEqual([s.feed + 10, s.money - 45, 0]);
    const broke = { ...s, money: 10 }, credit = apply(broke, { type: 'buyHay', pack: 0 });
    expect([credit.feed, credit.money, credit.debt]).toEqual([s.feed + 5, 10, 25]);
  });

  it('never leaves the horses without a way to be fed, however long the money is gone', () => {
    let s: State = { ...newGame(1), money: 0, feed: 0 };
    for (let day = 0; day < 60; day++) {
      if (s.feed < s.horses.length) s = apply(s, { type: 'buyHay', pack: 0 });
      s = apply(s, { type: 'sleep' });
      expect(s.night).not.toContainEqual(expect.objectContaining({ kind: 'noHay' }));
    }
  });

  it('lends money while the debt stays below the limit', () => {
    let s = { ...newGame(1), money: 0 };
    while (canLoan(s)) s = apply(s, { type: 'loan' });
    expect(s.debt).toBe(DATA.loan.debtLimit);
    expect(apply(s, { type: 'loan' })).toBe(s);
  });

  it('pays debt back from income first, and never more than is owed', () => {
    const s = { ...newGame(1), money: 0, debt: 30 };
    const once = earn(s, 40);
    expect([once.money, once.debt]).toEqual([20, 10]);
    const twice = earn(once, 40);
    expect([twice.money, twice.debt]).toEqual([50, 0]);
  });

  it('writes yesterday\'s money into the morning bill', () => {
    const s = apply(apply(newGame(1), { type: 'buyHay', pack: 0 }), { type: 'sleep' });
    expect(s.bill).toEqual([{ what: 'hay', amount: -25 }]);
    expect(s.night).toContainEqual({ kind: 'bill' });
    expect(apply(s, { type: 'sleep' }).bill).toEqual([]);
  });

  const small: Pupil = { id: 'p1', name: 'Lea', size: 'small', level: 'beginner', look: 1 };
  const big: Pupil = { id: 'p2', name: 'Ben', size: 'big', level: 'advanced', look: 2 };
  const withPupils = (...pupils: Pupil[]): State => ({ ...newGame(1), pupils });

  it('has a pupil waiting on the first morning, and more the better the reputation', () => {
    expect(newGame(1).pupils.length).toBeGreaterThanOrEqual(1);
    const famous = apply({ ...newGame(1), reputation: 90 }, { type: 'sleep' });
    expect(famous.pupils).toHaveLength(3);
    const unknown = apply({ ...newGame(1), reputation: 0 }, { type: 'sleep' });
    expect(unknown.pupils).toHaveLength(1);
  });

  it('puts small children on ponies and big ones on horses', () => {
    const pony = newGame(1).horses[0], horse = { ...pony, look: { ...pony.look, build: 'horse' as const } };
    expect([fit(small, pony), fit(small, horse), fit(big, pony), fit(big, horse)]).toEqual(['right', 'smallOnHorse', 'bigOnPony', 'right']);
    expect(lessonOutcome(small, pony).happy).toBeGreaterThan(lessonOutcome(small, horse).happy);
  });

  it('pays more for a well kept horse, and more for advanced riders', () => {
    const h = newGame(1).horses[0];
    const kept = { ...h, needs: { ...h.needs, fed: 100, clean: 100, happy: 100 } }, neglected = { ...h, needs: { ...h.needs, fed: 10, clean: 10, happy: 10 } };
    expect(lessonOutcome(small, kept).pay).toBeGreaterThan(lessonOutcome(small, neglected).pay);
    expect(lessonOutcome(small, kept).pay).toBe(DATA.lessons.pay.beginner);
    expect(lessonOutcome({ ...small, level: 'advanced' }, kept).pay).toBe(DATA.lessons.pay.advanced);
  });

  it('gives a lesson: pay (debt first), the pupil leaves, the horse gets tired, reputation follows happiness', () => {
    const s = withPupils(small, big), h = s.horses[0], out = lessonOutcome(small, h);
    const after = apply(s, { type: 'lesson', pupil: 'p1', horse: h.id });
    expect(after.money).toBe(s.money + out.pay);
    expect(after.pupils).toEqual([big]);
    expect(after.horses[0].needs.energy).toBe(h.needs.energy - DATA.lessons.energy);
    expect(after.lessonsGiven).toBe(1);
    expect(after.today).toContainEqual({ what: 'lesson', amount: out.pay });
    expect(after.reputation).toBe(Math.max(0, Math.min(100, Math.round(s.reputation + (out.happy - DATA.lessons.happyAt) / 5))));
    const owing = apply({ ...s, debt: 100 }, { type: 'lesson', pupil: 'p1', horse: h.id });
    expect(owing.debt).toBe(100 - Math.round(out.pay * DATA.repayShare));
  });

  it('refuses a sick, resting or tired horse, with the reason', () => {
    const s = withPupils(small), h = s.horses[0];
    for (const [bad, why] of [[{ ...h, needs: { ...h.needs, health: 5 } }, 'sick'], [{ ...h, rest: 1 }, 'resting'], [{ ...h, needs: { ...h.needs, energy: 10 } }, 'tired']] as const) {
      expect(cantTeach(bad)).toBe(why);
      const st = { ...s, horses: [bad, ...s.horses.slice(1)] };
      expect(apply(st, { type: 'lesson', pupil: 'p1', horse: h.id })).toBe(st);
    }
  });

  it('brings more pupils after happy lessons: a well kept pony earns a better reputation', () => {
    let s = newGame(3);
    for (let day = 0; day < 6; day++) {
      const pony = s.horses[0];
      s = { ...s, horses: [{ ...pony, needs: { ...pony.needs, fed: 100, clean: 100, happy: 100, energy: 100 } }, ...s.horses.slice(1)] };
      for (const p of s.pupils) s = apply({ ...s, horses: [{ ...s.horses[0], needs: { ...s.horses[0].needs, energy: 100 } }, ...s.horses.slice(1)] }, { type: 'lesson', pupil: p.id, horse: pony.id });
      s = apply(s, { type: 'sleep' });
    }
    expect(s.reputation).toBeGreaterThan(DATA.lessons.startReputation);
  });

  it('rolls the same numbers from the same seed', () => {
    const a = roll(42);
    expect(roll(42)).toEqual(a);
    expect(a[0]).toBeGreaterThanOrEqual(0);
    expect(a[0]).toBeLessThan(1);
  });
});
