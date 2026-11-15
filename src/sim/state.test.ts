import { describe, expect, it } from 'vitest';
import { t } from '../strings';
import { DATA } from './data';
import { allGoalsDone, apply, badgeWaits, goals, hint, canBuild, canLoan, canQuickCare, cantWork, clears, earn, fit, isSick, jumpWindow, lessonOutcome, missed, mood, NEEDS, newGame, nextShowDay, type Pupil, quizScore, roll, showResult, showWaits, type State, stalls, takeOff } from './state';

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
    expect(cantWork(s.horses[0], DATA.lessons.energy)).toBe('sick');
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
    expect(cantWork(treated.horses[0], DATA.lessons.energy)).toBe('resting');
    const rested = nights({ ...treated, horses: [{ ...treated.horses[0], needs: { ...treated.horses[0].needs, fed: 100, clean: 100 } }] }, DATA.vet.restDays);
    expect(['sick', 'resting']).not.toContain(cantWork(rested.horses[0], DATA.lessons.energy));
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

  it('keeps the reputation within 0–100, ignores unknown pupils, and brings new pupils each morning', () => {
    const s = withPupils(small), h = s.horses[0];
    const kept = { ...h, needs: { ...h.needs, fed: 100, clean: 100, happy: 100 } };
    expect(apply({ ...s, reputation: 99, horses: [kept] }, { type: 'lesson', pupil: 'p1', horse: h.id }).reputation).toBe(100);
    expect(apply({ ...withPupils(big), reputation: 1, horses: [{ ...h, needs: { ...h.needs, fed: 0, clean: 0, happy: 0 } }] }, { type: 'lesson', pupil: 'p2', horse: h.id }).reputation).toBe(0);
    expect(apply(s, { type: 'lesson', pupil: 'nobody', horse: h.id })).toBe(s);
    const morning = apply(s, { type: 'sleep' });
    expect(morning.pupils.length).toBeGreaterThan(0);
    expect(morning.pupils.map((p) => p.id)).not.toContain('p1');
  });

  it('says how a pupil felt, in line with the reputation rule', () => {
    expect(mood(DATA.lessons.delightedAt)).toBe('delighted');
    expect(mood(DATA.lessons.happyAt)).toBe('happy');
    expect(mood(DATA.lessons.happyAt - 1)).toBe('unhappy');
  });

  it('refuses a sick, resting or tired horse, with the reason', () => {
    const s = withPupils(small), h = s.horses[0];
    for (const [bad, why] of [[{ ...h, needs: { ...h.needs, health: 5 } }, 'sick'], [{ ...h, rest: 1 }, 'resting'], [{ ...h, needs: { ...h.needs, energy: 10 } }, 'tired']] as const) {
      expect(cantWork(bad, DATA.lessons.energy)).toBe(why);
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

  it('widens the take-off window for a skilled, well kept horse; a tap inside half of it clears the jump', () => {
    const h = newGame(1).horses[0], J = DATA.jumping;
    const poor = { ...h, skills: { jumping: 0 }, needs: { ...h.needs, fed: 0, clean: 0, happy: 0 } };
    const best = { ...h, skills: { jumping: 100 }, needs: { ...h.needs, fed: 100, clean: 100, happy: 100 } };
    expect(jumpWindow(poor)).toBeCloseTo(J.window.base);
    expect(jumpWindow(best)).toBeCloseTo(J.window.base + J.window.skill + J.window.kept);
    expect(jumpWindow(h)).toBeGreaterThan(jumpWindow(poor));
    expect(clears(poor, J.window.base / 2)).toBe(true);
    expect(clears(poor, -J.window.base / 2 - 0.01)).toBe(false);
    expect(clears(best, 0.2)).toBe(true);
    // a tap long before the jump does not count yet; one a bit early knocks the pole; no tap at all knocks it later
    expect(takeOff(h, -J.early - 0.01)).toBe('early');
    expect(takeOff(h, -J.early + 0.01)).toBe('fault');
    expect(takeOff(h, 0)).toBe('clear');
    expect(missed(h, jumpWindow(h) / 2 + J.late - 0.01)).toBe(false);
    expect(missed(h, jumpWindow(h) / 2 + J.late + 0.01)).toBe(true);
  });

  it('trains jumping: skill grows (more for a clear round), energy goes; a sick or tired horse cannot', () => {
    const s = newGame(1), h = s.horses[0], J = DATA.jumping;
    const clear = apply(s, { type: 'train', horse: h.id, faults: 0 }).horses[0];
    expect(clear.skills.jumping).toBe(h.skills.jumping + J.gain.clear);
    expect(clear.needs.energy).toBe(h.needs.energy - J.energy);
    expect(apply(s, { type: 'train', horse: h.id, faults: 2 }).horses[0].skills.jumping).toBe(h.skills.jumping + J.gain.faults);
    for (const bad of [{ ...h, needs: { ...h.needs, health: 5 } }, { ...h, needs: { ...h.needs, energy: J.energy - 1 } }]) {
      const st = { ...s, horses: [bad] };
      expect(apply(st, { type: 'train', horse: h.id, faults: 0 })).toBe(st);
    }
    expect(apply(s, { type: 'train', horse: h.id, faults: -1 })).toBe(s);
  });

  it('opens the riding badge after practice; the Sim scores the quiz; a pass opens shows, a fail waits for tomorrow', () => {
    let s = newGame(1);
    const kiwi = s.horses[0].id, B = DATA.badge, fresh = (st: State) => ({ ...st, horses: st.horses.map((h) => ({ ...h, needs: { ...h.needs, energy: 100 } })) });
    const right = [0, 0, 0, 0, 0], oneWrong = [0, 2, 0, 0, 0], twoWrong = [1, 2, 0, 0, 0];
    expect(badgeWaits(s)).toEqual({ why: 'practise', rounds: B.trainings });
    for (let i = 0; i < B.trainings; i++) s = apply(fresh(s), { type: 'train', horse: kiwi, faults: 1 });
    s = fresh(s);
    expect(badgeWaits(s)).toBeNull();
    expect(badgeWaits({ ...s, horses: s.horses.map((h) => ({ ...h, needs: { ...h.needs, energy: 0 } })) })).toEqual({ why: 'tired' });
    expect([quizScore(right), quizScore(oneWrong), quizScore(twoWrong)]).toEqual([5, 4, 3]);
    expect(t.quiz.map((q) => q.a.length)).toEqual(Array(B.questions).fill(B.answers)); // the texts fit the rule
    // no jumping round without today's passed quiz; bad answers are refused
    expect(apply(s, { type: 'badge', horse: kiwi, faults: 0 })).toBe(s);
    for (const bad of [[0, 0, 0, 0], [0, 0, 0, 0, 3], [0, 0, 0, 0, 0.5], [0, 0, 0, 0, -1]]) expect(apply(s, { type: 'badgeQuiz', answers: bad })).toBe(s);
    // too few right answers fail the badge for today at once
    const quizFailed = apply(s, { type: 'badgeQuiz', answers: twoWrong });
    expect(badgeWaits(quizFailed)).toEqual({ why: 'tomorrow' });
    // enough right, then too many poles: also a fail for today
    const quizOk = apply(s, { type: 'badgeQuiz', answers: oneWrong });
    expect(quizOk.badgeQuizDay).toBe(s.day);
    expect(apply(quizOk, { type: 'badgeQuiz', answers: right })).toBe(quizOk); // one quiz a day
    expect(apply(quizOk, { type: 'badge', horse: kiwi, faults: -1 })).toBe(quizOk);
    const failed = apply(quizOk, { type: 'badge', horse: kiwi, faults: B.maxFaults + 1 });
    expect([failed.badges, badgeWaits(failed)]).toEqual([0, { why: 'tomorrow' }]);
    // the next day: quiz and round again, this time passed
    const tomorrow = fresh(apply(failed, { type: 'sleep' }));
    expect(badgeWaits(tomorrow)).toBeNull();
    const passed = apply(apply(tomorrow, { type: 'badgeQuiz', answers: right }), { type: 'badge', horse: kiwi, faults: B.maxFaults });
    expect([passed.badges, badgeWaits(passed)]).toEqual([1, { why: 'passed' }]);
    expect(passed.horses[0].needs.energy).toBe(100 - DATA.jumping.energy);
  });

  it('holds a show every few days once the badge is passed; the entry fee needs the money', () => {
    const S = DATA.shows, s: State = { ...newGame(1), badges: 1, money: 100 };
    expect(showWaits({ ...s, badges: 0 })).toBe('badge');
    expect([nextShowDay(s), showWaits(s)]).toEqual([S.every, 'notToday']);
    const showDay = { ...s, day: S.every };
    expect(showWaits(showDay)).toBeNull();
    expect(showWaits({ ...showDay, money: S.fee - 1 })).toBe('money');
    expect(nextShowDay({ ...showDay, lastShowDay: S.every })).toBe(2 * S.every);
  });

  it('ranks the player against rivals: a clear round on a skilled horse wins, a bad one comes last; same seed, same table', () => {
    const s = newGame(5), h = s.horses[0];
    const best = showResult(s, { ...h, skills: { jumping: 100 } }, 0, 'Mara');
    expect([best.rank, best.prize, best.table.length]).toEqual([1, DATA.shows.prizes[0], DATA.shows.rivalsPerShow + 1]);
    expect(best.table[0]).toMatchObject({ rider: 'Mara', horse: h.name, you: true });
    const worst = showResult(s, { ...h, skills: { jumping: 0 } }, DATA.jumping.jumps, 'Mara');
    expect([worst.rank, worst.prize]).toEqual([DATA.shows.rivalsPerShow + 1, 0]);
    expect(showResult(s, h, 1, 'Mara')).toEqual(showResult(s, h, 1, 'Mara'));
    expect(new Set(best.table.map((r) => r.rider)).size).toBe(best.table.length); // no rival twice
  });

  it('enters a show: fee out, prize in (debt first), horse tired, one show a day; not with a sick horse', () => {
    const S = DATA.shows, base = newGame(5), h = { ...base.horses[0], skills: { jumping: 100 } };
    const s: State = { ...base, day: S.every, badges: 1, horses: [h] };
    const won = apply(s, { type: 'show', horse: h.id, faults: 0 });
    expect(won.money).toBe(s.money - S.fee + S.prizes[0]);
    expect(won.today).toEqual([{ what: 'showFee', amount: -S.fee }, { what: 'prize', amount: S.prizes[0] }]);
    expect(won.horses[0].needs.energy).toBe(h.needs.energy - DATA.jumping.energy);
    expect(apply(won, { type: 'show', horse: h.id, faults: 0 })).toBe(won); // one show a day
    const owing = apply({ ...s, debt: 100 }, { type: 'show', horse: h.id, faults: 0 });
    expect(owing.debt).toBe(100 - Math.round(S.prizes[0] * DATA.repayShare));
    const sick = { ...s, horses: [{ ...h, needs: { ...h.needs, health: 5 } }] };
    expect(apply(sick, { type: 'show', horse: h.id, faults: 0 })).toBe(sick);
  });

  it('tracks the stage goals; a goal once reached stays done, even if the money goes again', () => {
    const s = newGame(1);
    expect(goals(s).map((g) => [g.id, g.have, g.done])).toEqual([['groom', 0, false], ['lessons', 0, false], ['badge', 0, false], ['savings', 300, false], ['reputation', 30, false]]);
    const rich = apply({ ...s, money: 500 }, { type: 'buyHay', pack: 0 });
    expect(rich.goalsDone).toEqual(['savings']);
    const poor = apply({ ...rich, money: 30 }, { type: 'buyHay', pack: 0 });
    expect(goals(poor).find((g) => g.id === 'savings')).toMatchObject({ done: true, have: 400 });
    expect(goals({ ...s, debt: 50, money: 999 }).find((g) => g.id === 'savings')!.have).toBe(0); // saved means without debts
    expect(allGoalsDone({ ...s, goalsDone: ['groom', 'lessons', 'badge', 'savings', 'reputation'] })).toBe(true);
  });

  it('gives one hint at a time, the most urgent first', () => {
    const s = newGame(1), [a, b] = s.horses, below = DATA.hints.needBelow - 1;
    expect(hint(s)).toBeNull();
    const dirty = { ...a, needs: { ...a.needs, clean: below } }, hungry = { ...b, needs: { ...b.needs, fed: below } };
    expect(hint({ ...s, horses: [dirty, hungry] })).toEqual({ kind: 'hungry', horse: b.id });
    expect(hint({ ...s, horses: [dirty, { ...hungry, needs: { ...hungry.needs, health: 5 } }] })).toEqual({ kind: 'sick', horse: b.id });
    expect(hint({ ...s, horses: [dirty, b] })).toEqual({ kind: 'dirty', horse: a.id });
    expect(hint({ ...s, feed: 1 })).toEqual({ kind: 'hay' });
  });

  it('notes what Oma Hanne has explained, once', () => {
    const s = apply(newGame(1), { type: 'explained', what: 'stable' });
    expect(s.explained).toEqual(['stable']);
    expect(apply(s, { type: 'explained', what: 'stable' })).toBe(s);
  });

  it('rolls the same numbers from the same seed', () => {
    const a = roll(42);
    expect(roll(42)).toEqual(a);
    expect(a[0]).toBeGreaterThanOrEqual(0);
    expect(a[0]).toBeLessThan(1);
  });
});
