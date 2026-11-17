import { describe, expect, it } from 'vitest';
import { t } from '../strings';
import { DATA } from './data';
import { allGoalsDone, apply, CARE, badgeWaits, buildWaits, canInspect, marketFor, goals, hint, canBuild, canLoan, canQuickCare, cantWork, hayNights, dayMoney, clears, earn, fit, isSick, jumpWindow, fitsNone, lessonChoices, lessonOutcome, mood, NEEDS, newGame, nextShowDay, type Pupil, quizScore, roll, showResult, showWaits, SHOW_CLASSES, classShut, classWaits, scope, topClass, holdNeed, faultWhy, nextStage, stuck, gameOver, type State, stalls, takeOff, xcScope, xcWindow, gained, pasture, grazing, noRoom, badge2Waits, nextXcShowDay, xcShowWaits, xcClassWaits, salePrice, saleWaits, saleAdvice } from './state';

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
    const poor = { ...h, skills: { jumping: 0, crossCountry: 10 }, needs: { ...h.needs, fed: 0, clean: 0, happy: 0 } };
    const best = { ...h, skills: { jumping: 100, crossCountry: 10 }, needs: { ...h.needs, fed: 100, clean: 100, happy: 100 } };
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

  it('higher jumps need momentum: held too briefly, the pole falls; a skilled horse needs less; the reason is said', () => {
    const h = newGame(1).horses[0], pro = { ...h, skills: { jumping: 100, crossCountry: 10 } }, A = DATA.jumping.hold.A;
    expect(holdNeed(h, 0)).toBe(0); // class E: a tap
    expect(holdNeed(pro, A)).toBeLessThan(holdNeed(h, A));
    const need = holdNeed(h, A);
    expect([takeOff(h, 0, need, need), takeOff(h, 0, need * 0.5, need), takeOff(h, 0)]).toEqual(['clear', 'fault', 'clear']);
    expect([faultWhy(h, 0, need * 0.5, need), faultWhy(h, -0.4, need, need), faultWhy(h, 0.4)]).toEqual(['power', 'soon', 'late']);
  });

  it('practice raises a horse only up to what its breed can', () => {
    const s = newGame(1), kiwi = { ...s.horses[0], skills: { jumping: scope(s.horses[0]) - 1, crossCountry: 10 } }, st: State = { ...s, horses: [kiwi] };
    const once = apply(st, { type: 'train', horse: kiwi.id, faults: 0 }), twice = apply({ ...once, horses: once.horses.map((h) => ({ ...h, needs: { ...h.needs, energy: 100 } })) }, { type: 'train', horse: kiwi.id, faults: 0 });
    expect([once.horses[0].skills.jumping, twice.horses[0].skills.jumping]).toEqual([scope(kiwi), scope(kiwi)]);
    const veteran = { ...kiwi, skills: { jumping: 90, crossCountry: 10 } }; // from a save before the breed limit: practice never lowers it
    expect(apply({ ...s, horses: [veteran] }, { type: 'train', horse: kiwi.id, faults: 0 }).horses[0].skills.jumping).toBe(90);
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

  it('holds a show every few days once the badge is passed; the cheapest entry fee needs the money', () => {
    const S = DATA.shows, s: State = { ...newGame(1), badges: 1, money: 100 };
    expect(showWaits({ ...s, badges: 0 })).toBe('badge');
    expect([nextShowDay(s), showWaits(s)]).toEqual([S.every, 'notToday']);
    const showDay = { ...s, day: S.every };
    expect(showWaits(showDay)).toBeNull();
    expect(showWaits({ ...showDay, money: S.classes.E.fee - 1 })).toBe('money');
    expect(nextShowDay({ ...showDay, lastShowDay: S.every })).toBe(2 * S.every);
  });

  it('opens the higher classes to a horse once its jumping skill is high enough and the fee is there', () => {
    const C = DATA.shows.classes, s: State = { ...newGame(1), money: 1000 }, h = s.horses[0];
    expect(SHOW_CLASSES).toEqual(['E', 'A', 'L']);
    expect(SHOW_CLASSES.map((c) => classWaits(s, h, c))).toEqual([null, 'skill', 'scope']); // a Haflinger: never class L
    const trained = { ...h, skills: { jumping: C.A.minSkill, crossCountry: 10 } };
    expect(SHOW_CLASSES.map((c) => classWaits(s, trained, c))).toEqual([null, null, 'scope']);
    const warmblut = { ...trained, breed: 'warmblut' as const };
    expect(SHOW_CLASSES.map((c) => classWaits(s, warmblut, c))).toEqual([null, null, 'skill']); // a Warmblut can, with practice
    expect([topClass(h), topClass(s.horses[1]), topClass(warmblut), topClass({ breed: 'reitpony' })]).toEqual(['A', 'A', 'L', 'L']);
    expect(classWaits({ ...s, money: C.A.fee - 1 }, trained, 'A')).toBe('money');
    // each class up pays more for a win
    expect(C.E.prizes[0] < C.A.prizes[0] && C.A.prizes[0] < C.L.prizes[0]).toBe(true);
    // a class is shut for the whole farm: open with the trained horse, 'tired' when only that horse could and it can't
    const farm: State = { ...s, horses: [trained, s.horses[1]] };
    expect(SHOW_CLASSES.map((c) => classShut(farm, c))).toEqual([null, null, 'scope']);
    expect(classShut({ ...farm, horses: [{ ...trained, needs: { ...trained.needs, energy: 0 } }, s.horses[1]] }, 'A')).toBe('tired');
    expect(classShut({ ...farm, money: C.A.fee - 1 }, 'A')).toBe('money');
  });

  it('ranks the player against rivals: a clear round on a skilled horse wins, a bad one comes last; same seed, same table', () => {
    const s = newGame(5), h = s.horses[0];
    const best = showResult(s, { ...h, skills: { jumping: 100, crossCountry: 10 } }, 0, 'Mara', 'L');
    expect([best.rank, best.prize, best.table.length]).toEqual([1, DATA.shows.classes.L.prizes[0], DATA.shows.rivalsPerShow + 1]);
    expect(best.table[0]).toMatchObject({ rider: 'Mara', horse: h.name, you: true });
    const worst = showResult(s, { ...h, skills: { jumping: 0, crossCountry: 10 } }, DATA.jumping.courses.E.jumps.length, 'Mara', 'E');
    expect([worst.rank, worst.prize]).toEqual([DATA.shows.rivalsPerShow + 1, 0]);
    expect(showResult(s, h, 1, 'Mara', 'E')).toEqual(showResult(s, h, 1, 'Mara', 'E'));
    expect(new Set(best.table.map((r) => r.rider)).size).toBe(best.table.length); // no rival twice
  });

  it('enters a show: fee out, prize in (debt first), horse tired, one show a day; not with a sick horse', () => {
    const S = DATA.shows, E = S.classes.E, base = newGame(5), h = { ...base.horses[0], skills: { jumping: 100, crossCountry: 10 } };
    const s: State = { ...base, day: S.every, badges: 1, horses: [h] };
    const show = { type: 'show', horse: h.id, faults: 0, showClass: 'E' } as const;
    const won = apply(s, show);
    expect(won.money).toBe(s.money - E.fee + E.prizes[0]);
    expect(won.today).toEqual([{ what: 'showFee', amount: -E.fee }, { what: 'prize', amount: E.prizes[0] }]);
    expect(won.horses[0].needs.energy).toBe(h.needs.energy - DATA.jumping.energy);
    expect(apply(won, show)).toBe(won); // one show a day
    const owing = apply({ ...s, debt: 100 }, show);
    expect(owing.debt).toBe(100 - Math.round(E.prizes[0] * DATA.repayShare));
    for (const bad of [{ ...h, needs: { ...h.needs, health: 5 } }, { ...h, needs: { ...h.needs, energy: DATA.jumping.energy - 1 } }]) {
      const st = { ...s, horses: [bad] }; // sick, or too tired
      expect(apply(st, show)).toBe(st);
    }
    expect(showResult(s, h, 0, 'Lotta', 'E').table.filter((r) => r.rider === 'Lotta')).toHaveLength(1);
    const blitz = { ...h, name: 'blitz' }; // no rival on a horse with the player's horse's name
    expect(showResult({ ...s, horses: [blitz] }, blitz, 0, 'Mara', 'E').table.filter((r) => r.horse.toLowerCase() === 'blitz')).toHaveLength(1);
  });

  it('enters a higher class only with a horse that may start there; its fee and prize are the class\'s own', () => {
    const L = DATA.shows.classes.L, base = newGame(5), h = { ...base.horses[0], breed: 'warmblut' as const, skills: { jumping: 100, crossCountry: 10 } };
    const s: State = { ...base, day: DATA.shows.every, badges: 1, horses: [h] };
    const won = apply(s, { type: 'show', horse: h.id, faults: 0, showClass: 'L' });
    expect(won.today).toEqual([{ what: 'showFee', amount: -L.fee }, { what: 'prize', amount: L.prizes[0] }]);
    const novice = { ...s, horses: [{ ...h, skills: { jumping: L.minSkill - 1, crossCountry: 10 } }] };
    expect(apply(novice, { type: 'show', horse: h.id, faults: 0, showClass: 'L' })).toBe(novice);
    expect(apply(s, { type: 'show', horse: h.id, faults: 0, showClass: 'toString' as 'E' })).toBe(s); // not a class
  });

  it('lists the horses for a lesson: why one cannot, how each fits, the best one marked', () => {
    const s = newGame(1), [kiwi, luna] = s.horses, big: Pupil = { id: 'p', name: 'Ben', size: 'big', level: 'beginner', look: 1 };
    const tired = { ...luna, needs: { ...luna.needs, energy: 0 } }, dirty = { ...kiwi, needs: { ...kiwi.needs, fed: 10, clean: 10, happy: 10 } };
    const [a, b] = lessonChoices(big, [dirty, tired]);
    expect([a.why, a.fit, a.unkempt, a.mood, a.best]).toEqual([null, 'bigOnPony', true, 'unhappy', false]); // never "best" for an unhappy pupil
    expect(lessonChoices(big, [kiwi])[0].best).toBe(false); // a big child on a well-kept pony: still not happy
    expect([fitsNone(big, s.horses), fitsNone({ ...big, size: 'small' }, s.horses), fitsNone({ ...big, size: 'small' }, [tired])]).toEqual([true, false, true]);
    expect([b.why, b.best]).toEqual(['tired', false]);
    const small: Pupil = { ...big, size: 'small' }, horse = { ...kiwi, id: 'h', look: { ...kiwi.look, build: 'horse' as const } };
    expect(lessonChoices(small, [horse, kiwi]).map((c) => [c.fit, c.best])).toEqual([['smallOnHorse', false], ['right', true]]);
    expect(lessonChoices(small, [tired]).some((c) => c.best)).toBe(false);
  });

  it('renames a horse: trimmed, 1–16 characters, not a name another horse already has', () => {
    const s = newGame(1), [kiwi, luna] = s.horses;
    expect(apply(s, { type: 'rename', horse: kiwi.id, name: '  Sternchen ' }).horses[0].name).toBe('Sternchen');
    expect(apply(s, { type: 'rename', horse: kiwi.id, name: 'kiwi' }).horses[0].name).toBe('kiwi'); // its own name, other case
    for (const name of ['', '   ', 'x'.repeat(DATA.horseName.max + 1), luna.name, luna.name.toUpperCase()])
      expect(apply(s, { type: 'rename', horse: kiwi.id, name }), JSON.stringify(name)).toBe(s);
    expect(apply(s, { type: 'rename', horse: 'nobody', name: 'Max' })).toBe(s);
    const market: State = { ...s, market: marketFor(5, 9)[0] }; // a name for sale is taken too
    expect(apply(market, { type: 'rename', horse: kiwi.id, name: market.market[0].name.toLowerCase() })).toBe(market);
    expect(marketFor(5, 9, [market.market[0].name.toLowerCase()])[0].map((o) => o.name)).not.toContain(market.market[0].name);
  });

  it('says how many nights the hay lasts: one bale per horse a night', () => {
    const s = newGame(1); // two ponies
    expect([hayNights({ ...s, feed: 10 }), hayNights({ ...s, feed: 5 }), hayNights({ ...s, feed: 1 }), hayNights({ ...s, feed: 0 })]).toEqual([5, 2, 0, 0]);
  });

  it('sums the day\'s money for the diary: in and out apart, by kind, the biggest first', () => {
    const day = dayMoney([{ what: 'lesson', amount: 20 }, { what: 'hay', amount: -25 }, { what: 'lesson', amount: 28 }, { what: 'prize', amount: 60 }, { what: 'showFee', amount: -15 }]);
    expect(day).toEqual({ income: [{ what: 'prize', amount: 60 }, { what: 'lesson', amount: 48 }], costs: [{ what: 'hay', amount: -25 }, { what: 'showFee', amount: -15 }], debts: [], total: 68 });
    expect(dayMoney([])).toEqual({ income: [], costs: [], debts: [], total: 0 });
    // debts apart; the total is exactly how the money changed: 100 lent, 60 prize of which 30 paid debt back, and
    // hay on credit, which doesn't touch the money
    const d = dayMoney([{ what: 'loan', amount: 100 }, { what: 'hayOnCredit', amount: -25 }, { what: 'prize', amount: 60 }, { what: 'repay', amount: -30 }]);
    expect([d.income, d.debts.map((r) => r.what), d.total]).toEqual([[{ what: 'prize', amount: 60 }], ['loan', 'hayOnCredit', 'repay'], 130]);
  });

  it('shows no minus points on the podium, however bad the round (#104)', () => {
    expect([t.points(-39), t.points(0), t.points(82)]).toEqual(['0 Punkte', '0 Punkte', '82 Punkte']);
  });

  it('tracks the stage goals; a goal once reached stays done, even if the money goes again', () => {
    const s = newGame(1);
    expect(goals(s).map((g) => [g.id, g.have, g.done])).toEqual([['groom', 0, false], ['lessons', 0, false], ['badge', 0, false], ['savings', 300, false], ['reputation', 30, false]]);
    const rich = apply({ ...s, money: 600 }, { type: 'buyHay', pack: 0 });
    expect(rich.goalsDone).toEqual(['savings']);
    const poor = apply({ ...rich, money: 30 }, { type: 'buyHay', pack: 0 });
    expect(goals(poor).find((g) => g.id === 'savings')).toMatchObject({ done: true, have: 500 });
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
    expect(hint({ ...s, feed: 0, horses: [dirty, hungry] })).toEqual({ kind: 'hay' }); // no hay: buy some before feeding
  });

  it('notes what Oma Hanne has explained, once', () => {
    const s = apply(newGame(1), { type: 'explained', what: 'stable' });
    expect(s.explained).toEqual(['stable']);
    expect(apply(s, { type: 'explained', what: 'stable' })).toBe(s);
  });

  it('holds the farm inspection once all goals are met: a passed quiz makes a Reitschule with a market, a failed one waits a day', () => {
    const s = newGame(1), done: State = { ...s, goalsDone: ['groom', 'lessons', 'badge', 'savings', 'reputation'] };
    const right = [0, 0, 0, 0, 0], twoWrong = [1, 2, 0, 0, 0];
    expect([canInspect(s), canInspect(done)]).toEqual([false, true]);
    expect(apply(done, { type: 'inspection', answers: [0, 0, 0] })).toBe(done);
    const failed = apply(done, { type: 'inspection', answers: twoWrong });
    expect([failed.stage, canInspect(failed)]).toEqual(['kleinerHof', false]);
    const passed = apply(done, { type: 'inspection', answers: right });
    expect([passed.stage, passed.market.length, canInspect(passed)]).toEqual(['reitschule', DATA.market.offers, false]);
    // the Reitschule has new goals
    expect(goals(passed).map((g) => g.id)).toEqual(DATA.goals.reitschule.map((g) => g.id));
    expect(goals(passed).filter((g) => g.done)).toEqual([]); // the Kleiner Hof's reached goals don't carry over
    // the lesson goal counts from the stage's start, even after many lessons before
    const busy = apply({ ...done, lessonsGiven: 40 }, { type: 'inspection', answers: right });
    expect(goals(busy).find((g) => g.id === 'lessons')).toMatchObject({ have: 0, done: false });
  });

  it('Oma Hanne helps out of a dead end once: the vet for every sick horse and some hay, a gift', () => {
    const sick = (st: State): State => ({ ...st, money: 0, debt: DATA.loan.debtLimit, feed: 0, horses: st.horses.map((h) => ({ ...h, needs: { ...h.needs, health: 10 } })) });
    const s = sick(newGame(1));
    expect(stuck(s)).toBe(true);
    const helped = apply(s, { type: 'sleep' });
    expect([helped.horses.every((h) => !isSick(h) && h.rest === DATA.vet.restDays), helped.feed, helped.rescueDay, helped.night]).toEqual([true, DATA.rescue.hay, helped.day, expect.arrayContaining([{ kind: 'omaHelped' }])]);
    expect([helped.money, helped.debt]).toEqual([0, DATA.loan.debtLimit]); // a gift, not a loan
    expect(stuck({ ...s, money: DATA.vet.cost })).toBe(false); // with money for the vet it is no dead end
    expect(apply({ ...s, money: DATA.vet.cost }, { type: 'sleep' }).night).not.toContainEqual({ kind: 'omaHelped' });
    // at the Pensionsstall the morning's pay comes first: a boarder whose pay (half of it repays debt) covers the vet
    // means no dead end
    const guest = { ...s.horses[0], id: 'g', needs: { ...s.horses[0].needs, health: 100 }, owner: { name: 'Familie Weber', pay: DATA.vet.cost / DATA.repayShare, unhappy: 0 } };
    expect(apply({ ...s, stage: 'pensionsstall', horses: [...s.horses, guest] }, { type: 'sleep' }).night).not.toContainEqual({ kind: 'omaHelped' });
  });

  it('a second dead end: Oma only warns, counting down; lasting the whole countdown, the farm is lost and nothing more happens', () => {
    const sick = (st: State): State => ({ ...st, money: 0, debt: DATA.loan.debtLimit, horses: st.horses.map((h) => ({ ...h, needs: { ...h.needs, health: 10 } })) });
    let s = sick({ ...newGame(1), rescueDay: 1, day: 20 }); // she has helped before
    const warnings: number[] = [];
    for (let i = 1; i < DATA.rescue.grace; i++) {
      s = apply(sick(s), { type: 'sleep' });
      warnings.push(s.night.find((n) => n.kind === 'lastWarning')!.count!);
      expect([s.deadEnd, gameOver(s), s.night.some((n) => n.kind === 'omaHelped')]).toEqual([i, false, false]);
    }
    expect(warnings).toEqual([...Array(DATA.rescue.grace - 1)].map((_, i) => DATA.rescue.grace - 1 - i)); // 4, 3, 2, 1
    const lost = apply(sick(s), { type: 'sleep' });
    expect([gameOver(lost), lost.night]).toEqual([true, expect.arrayContaining([{ kind: 'gameOver' }])]);
    expect(apply(lost, { type: 'loan' })).toBe(lost); // nothing more happens
    expect(apply(lost, { type: 'sleep' })).toBe(lost);
    // good care in time heals a horse: no dead end any more, the countdown starts afresh
    const healed = apply({ ...s, horses: s.horses.map((h, i) => (i ? h : { ...h, needs: { ...h.needs, health: 60 } })) }, { type: 'sleep' });
    expect([healed.deadEnd, gameOver(healed)]).toEqual([0, false]);
  });

  it('a second dead end at its worst (every need at 0): doing all Oma says each day saves the farm in time', () => {
    const zero = Object.fromEntries(NEEDS.map((n) => [n, 0])) as State['horses'][number]['needs'];
    let s: State = { ...newGame(1), rescueDay: 1, day: 20, deadEnd: 1, money: 0, debt: DATA.loan.debtLimit, feed: 0,
      horses: newGame(1).horses.map((h) => ({ ...h, needs: zero })) };
    for (let day = 1; s.deadEnd && day < DATA.rescue.grace; day++) {
      s = apply(s, { type: 'buyHay', pack: 0 });
      for (const h of s.horses) for (const what of CARE) s = apply(s, { type: 'care', horse: h.id, what });
      s = apply(s, { type: 'sleep' });
    }
    expect([gameOver(s), s.deadEnd]).toEqual([false, 0]);
  });

  it('the care course counts as grooming and hooves today, makes the horse happier (more without a wrong step); riding it costs a little energy', () => {
    const s = newGame(1), h = s.horses[0], R = DATA.routine;
    const after = (wrong: number, ride: boolean) => apply(s, { type: 'routine', horse: h.id, wrong, ride }).horses[0];
    const clean = after(0, true);
    expect(clean.cared).toEqual(['groom', 'hooves']);
    expect(clean.needs.happy).toBe(Math.min(100, h.needs.happy + DATA.care.groom.happy + DATA.care.hooves.happy + R.happyClean));
    expect(clean.needs.energy).toBe(h.needs.energy - R.energy);
    expect(after(2, false).needs.happy).toBe(Math.min(100, h.needs.happy + DATA.care.groom.happy + DATA.care.hooves.happy + R.happy));
    expect(after(2, false).needs.energy).toBe(h.needs.energy);
    // already groomed today: no second grooming, but the happiness
    const groomed = apply(s, { type: 'care', horse: h.id, what: 'groom' });
    expect(apply(groomed, { type: 'routine', horse: h.id, wrong: 0, ride: false }).horses[0].cared).toEqual(['groom', 'hooves']);
    // a horse too tired to ride can't be ridden in it
    const tired = { ...s, horses: s.horses.map((x, i) => (i ? x : { ...x, needs: { ...x.needs, energy: R.energy - 1 } })) };
    expect(apply(tired, { type: 'routine', horse: h.id, wrong: 0, ride: true })).toBe(tired);
  });

  it('a lesson on a horse the pupil got ready in the care course pays a tip and some reputation, more without a wrong step', () => {
    const s = { ...newGame(1), money: 0, debt: 0 }, p = s.pupils[0], h = lessonChoices(p, s.horses).find((c) => !c.why)!.horse, R = DATA.routine;
    const lesson = (prepared?: number) => apply(s, { type: 'lesson', pupil: p.id, horse: h.id, prepared });
    const plain = lesson(), clean = lesson(0), some = lesson(1);
    expect([clean.money - plain.money, some.money - plain.money]).toEqual([R.tipClean, R.tip]);
    expect([clean.reputation - plain.reputation, some.reputation - plain.reputation]).toEqual([R.reputationClean, R.reputation]);
  });

  it('cross-country practice (after riding badge 1) trains its own skill up to the breed limit (more without a fault), costs energy, not the jumping', () => {
    const s = { ...newGame(1), badges: 1 }, h = s.horses[0], X = DATA.crossCountry;
    expect(apply({ ...s, badges: 0 }, { type: 'xcTrain', horse: h.id, faults: 0 })).toEqual({ ...s, badges: 0 }); // only after riding badge 1
    const clean = apply(s, { type: 'xcTrain', horse: h.id, faults: 0 }).horses[0], some = apply(s, { type: 'xcTrain', horse: h.id, faults: 2 }).horses[0];
    expect([clean.skills.crossCountry, some.skills.crossCountry, clean.skills.jumping]).toEqual([h.skills.crossCountry + X.gain.clear, h.skills.crossCountry + X.gain.faults, h.skills.jumping]);
    expect(clean.needs.energy).toBe(h.needs.energy - X.energy);
    const near = { ...s, horses: [{ ...h, skills: { ...h.skills, crossCountry: xcScope(h) - 1 } }] };
    expect(apply(near, { type: 'xcTrain', horse: h.id, faults: 0 }).horses[0].skills.crossCountry).toBe(xcScope(h));
    // a sure-footed pony goes further cross-country than over poles; a skilled, well kept horse gets a wider window
    expect(xcScope({ breed: 'islaender' })).toBeGreaterThan(scope({ breed: 'islaender' }));
    expect(xcWindow({ ...h, skills: { ...h.skills, crossCountry: 80 } })).toBeGreaterThan(xcWindow(h));
    const tired = { ...s, horses: [{ ...h, needs: { ...h.needs, energy: X.energy - 1 } }] };
    expect(apply(tired, { type: 'xcTrain', horse: h.id, faults: 0 })).toBe(tired);
  });

  it('each horse keeps its skills at the start of each of the last days: what it gained today and this week', () => {
    let s = { ...newGame(1), badges: 1 };
    const id = s.horses[0].id, kiwi = () => s.horses.find((h) => h.id === id)!;
    expect(gained(kiwi())).toEqual([0, 0]);
    s = apply(s, { type: 'train', horse: id, faults: 0 });
    s = apply(s, { type: 'xcTrain', horse: id, faults: 1 });
    expect(gained(kiwi())).toEqual([DATA.jumping.gain.clear, DATA.crossCountry.gain.faults]);
    s = apply(s, { type: 'sleep' });
    expect([gained(kiwi()), gained(kiwi(), 7)]).toEqual([[0, 0], [DATA.jumping.gain.clear, DATA.crossCountry.gain.faults]]); // a new day; the week still has it
    for (let i = 0; i < DATA.progress.days + 3; i++) s = apply(s, { type: 'sleep' });
    expect(kiwi().log).toHaveLength(DATA.progress.days); // only the last days are kept
  });

  it('the pasture: a pony takes 1 place, a big horse 2; a horse comes only with a free stall and room on the pasture; it grows step by step', () => {
    const P = DATA.build.pasture;
    const school: State = { ...newGame(1), stage: 'reitschule', money: 5000, built: { stalls: 1, arena: 0, pasture: 0 } };
    expect([pasture(school), grazing(school)]).toEqual([DATA.pasture.start, 2]); // two ponies
    const big = { id: 'big', name: 'Big', breed: 'warmblut' as const, look: { build: 'horse' as const, coat: 'brauner' as const }, price: 400 };
    const pony = { ...big, id: 'small', name: 'Small', breed: 'haflinger' as const, look: { build: 'pony' as const, coat: 'fuchs' as const } };
    // the big horse fits (2 + 2 = 4), then the pasture is full for a pony too, though a stall is free
    let s = apply({ ...school, market: [big, pony] }, { type: 'buyHorse', offer: 'big' });
    expect([s.horses.length, grazing(s), noRoom(s, 'pony')]).toEqual([3, 4, 'pasture']);
    expect(apply(s, { type: 'buyHorse', offer: 'small' })).toBe(s);
    // more land: +2 places for its price, up to the most there is
    s = apply(s, { type: 'build', what: 'pasture' });
    expect([pasture(s), s.money]).toEqual([DATA.pasture.start + P.places, 5000 - 400 - P.cost]);
    s = apply(s, { type: 'buyHorse', offer: 'small' });
    expect(s.horses.length).toBe(4);
    for (let i = 0; i < P.max + 2; i++) s = apply(s, { type: 'build', what: 'pasture' });
    expect([s.built.pasture, buildWaits(s, 'pasture')]).toEqual([P.max, 'built']);
    // not before the Reitschule; and a full stable says so first
    expect(buildWaits(newGame(1), 'pasture')).toBe('stage');
    expect(noRoom({ ...s, built: { ...s.built, stalls: 0 } }, 'pony')).toBe('stall');
  });

  it('riding badge 2 opens after badge 1, cross-country practice and one care course; the exam needs both parts within their limits', () => {
    const B = DATA.badge2, X = DATA.crossCountry;
    let s: State = { ...newGame(1) };
    const id = s.horses[0].id;
    expect(badge2Waits(s)).toEqual({ why: 'badge1' });
    s = { ...s, badges: 1 };
    expect(badge2Waits(s)).toEqual({ why: 'practise', rounds: B.xcTrainings });
    for (let i = 0; i < B.xcTrainings; i++) s = apply({ ...s, horses: s.horses.map((h) => ({ ...h, needs: { ...h.needs, energy: 100 } })) }, { type: 'xcTrain', horse: id, faults: 0 });
    expect(badge2Waits(s)).toEqual({ why: 'routine' });
    s = apply(s, { type: 'routine', horse: id, wrong: 0, ride: false });
    expect(badge2Waits(s)).toBeNull();
    const rested = { ...s, horses: s.horses.map((h) => ({ ...h, needs: { ...h.needs, energy: 100 } })) };
    // too many wrong steps in the care course: failed without riding (no energy spent), again tomorrow
    const failed = apply(rested, { type: 'badge2', horse: id, wrong: B.maxWrong + 1, faults: null });
    expect([failed.badges, failed.badgeFailedDay, failed.horses[0].needs.energy, badge2Waits(failed)]).toEqual([1, s.day, 100, { why: 'tomorrow' }]);
    // too many faults cross-country: failed too; within both limits: passed, and the goal is done
    expect(apply(rested, { type: 'badge2', horse: id, wrong: 0, faults: B.maxFaults + 1 }).badges).toBe(1);
    const passed = apply(rested, { type: 'badge2', horse: id, wrong: B.maxWrong, faults: B.maxFaults });
    expect([passed.badges, passed.horses[0].needs.energy, badge2Waits(passed)]).toEqual([2, 100 - X.energy, { why: 'passed' }]);
    expect(apply(passed, { type: 'badge2', horse: id, wrong: 0, faults: 0 })).toBe(passed);
    expect(goals({ ...passed, stage: 'pensionsstall' }).find((g) => g.id === 'badge2')).toMatchObject({ done: true, need: 1 });
    // part 1 took the only fresh horse's energy: the result still counts (the round checks the horse itself)
    const tiredAfter = { ...rested, horses: rested.horses.map((h, i) => ({ ...h, needs: { ...h.needs, energy: i ? 10 : DATA.badge2.energy } })) };
    const course = apply(tiredAfter, { type: 'routine', horse: id, wrong: 0, ride: true });
    expect(badge2Waits(course)).toEqual({ why: 'tired' });
    expect(apply(course, { type: 'badge2', horse: id, wrong: 0, faults: 0 }).badges).toBe(2);
  });

  it('cross-country shows: after riding badge 2, on the days between the jumping shows; classes by cross-country skill; a prize for the first three', () => {
    const XS = DATA.xcShows;
    const days = (s: State) => [...Array(9)].map((_, i) => ({ ...s, day: i + 1 })).filter((d) => nextXcShowDay(d) === d.day).map((d) => d.day);
    const s0: State = { ...newGame(1), badges: 2, money: 1000 };
    const xcDays = days(s0), jumpDays = [...Array(9)].map((_, i) => i + 1).filter((d) => nextShowDay({ ...s0, day: d }) === d);
    expect(xcDays.every((d) => d % XS.every === XS.on)).toBe(true);
    expect(xcDays.some((d) => jumpDays.includes(d))).toBe(false); // never on a jumping show day
    expect(xcShowWaits({ ...s0, badges: 1, day: xcDays[0] })).toBe('badge');
    const s = { ...s0, day: xcDays[0] }, h = s.horses[0];
    expect([xcShowWaits(s), xcClassWaits(s, h, 'E'), xcClassWaits(s, h, 'A')]).toEqual([null, null, 'skill']);
    // a clear round over a pony of top cross-country skill: the podium, the prize minus the fee
    const pro = { ...s, horses: s.horses.map((x, i) => (i ? x : { ...x, skills: { ...x.skills, crossCountry: xcScope(x) } })) };
    const { rank, prize } = showResult(pro, pro.horses[0], 0, 'Mara', 'E', true);
    const after = apply(pro, { type: 'xcShow', horse: h.id, faults: 0, showClass: 'E' });
    expect([after.lastXcShowDay, after.money - pro.money, after.horses[0].needs.energy]).toEqual([pro.day, prize - XS.classes.E.fee, h.needs.energy - DATA.crossCountry.energy]);
    expect(rank).toBeLessThanOrEqual(3);
    expect(apply(after, { type: 'xcShow', horse: s.horses[1].id, faults: 0, showClass: 'E' })).toBe(after); // one a day
    expect(nextXcShowDay(after)).toBe(pro.day + XS.every);
    // the jumping skill counts nothing here: a horse good over poles but new cross-country stays out of class A
    const jumper = { ...h, skills: { jumping: 90, crossCountry: 10 } };
    expect(xcClassWaits(s, jumper, 'A')).toBe('skill');
    // a higher class is stricter: the same horse has less time to say "Hopp!"
    expect(xcWindow(h, 'E')).toBe(xcWindow(h));
    expect(xcWindow(h, 'L')).toBeLessThan(xcWindow(h, 'A'));
    expect(xcWindow(h, 'A')).toBeLessThan(xcWindow(h));
  });

  it('selling a horse at the market: half price new, more trained; never the last, a sick or part-boarded one; the stall frees', () => {
    const s0: State = { ...newGame(1), stage: 'reitschule' }, [kiwi, luna] = s0.horses;
    const [lo, hi] = DATA.market.price.pony;
    expect(salePrice({ ...kiwi, skills: { jumping: 0, crossCountry: 0 } })).toBe(Math.round(((lo + hi) / 2) * DATA.sale.base / 10) * 10);
    // training raises the price, up to about what a new pony costs: never a fortune
    const top = { ...kiwi, skills: { jumping: scope(kiwi), crossCountry: xcScope(kiwi) } };
    expect(salePrice(top)).toBeGreaterThan(salePrice(kiwi));
    expect(salePrice(top)).toBeLessThanOrEqual(hi);
    expect([saleAdvice(s0, kiwi), saleAdvice(s0, top)]).toEqual(['practise', 'good']);
    // why not: before the Reitschule, sick, a part-boarder rides it, the last horse
    expect(saleWaits(newGame(1), kiwi)).toBe('market');
    expect(saleWaits(s0, { ...kiwi, needs: { ...kiwi.needs, health: 0 } })).toBe('sick');
    expect(saleWaits(s0, { ...kiwi, rider: { name: 'Mia', pay: 8 } })).toBe('rider');
    expect(saleWaits(s0, kiwi)).toBe(null);
    // sold: the money (part of it pays the debt, like any income), a diary line, the stall free, an offer for it gone
    const s1 = { ...s0, debt: 100, partOffer: { horse: kiwi.id, rider: 'Mia', pay: 8 } }, price = salePrice(kiwi);
    const s2 = apply(s1, { type: 'sell', horse: kiwi.id });
    expect(s2.horses.map((h) => h.id)).toEqual([luna.id]);
    expect([s2.money - s2.debt, s2.partOffer]).toEqual([s1.money - s1.debt + price, null]);
    expect(s2.today).toContainEqual({ what: 'sale', amount: price });
    expect(noRoom(s2, 'pony')).toBe(null);
    // the last horse stays; only Luna is a pony now, Oma says so
    expect(saleWaits(s2, s2.horses[0])).toBe('last');
    expect(apply(s2, { type: 'sell', horse: luna.id })).toBe(s2);
    expect(saleAdvice({ ...s0, horses: [luna, { ...kiwi, look: { ...kiwi.look, build: 'horse' } }] }, luna)).toBe('lastPony');
  });

  describe('the Pensionsstall', () => {
    const pension = (): State => {
      // a Reitschule with every goal met passes its inspection: the Pensionsstall, with boarders looking for a stall
      const s: State = { ...newGame(3), stage: 'reitschule', goalsDone: DATA.goals.reitschule.map((g) => g.id), money: 2000 };
      return apply(s, { type: 'inspection', answers: Array(DATA.inspection.questions).fill(0) });
    };

    it('the second inspection makes a Pensionsstall with boarders looking for a stall; it has no next stage yet', () => {
      const s = pension();
      expect([s.stage, s.boardOffers.length, stalls(s), nextStage(s), canInspect({ ...s, goalsDone: DATA.goals.pensionsstall.map((g) => g.id) })])
        .toEqual(['pensionsstall', DATA.boarders.offers, DATA.stalls.pensionsstall, null, false]);
      expect(goals(s).map((g) => g.id)).toEqual(DATA.goals.pensionsstall.map((g) => g.id));
    });

    it('a groom, paid each morning, cares for the worst kept horses; unpaid, they stay away', () => {
      const s0 = apply(pension(), { type: 'hire' }), dirty = s0.horses.map((h) => ({ ...h, needs: { ...h.needs, fed: 20, clean: 20, happy: 20 } }));
      expect([s0.staff, apply(apply(s0, { type: 'hire' }), { type: 'hire' }).staff]).toEqual([1, DATA.staff.names.length]); // at most two
      const morning = apply({ ...s0, horses: dirty }, { type: 'sleep' });
      expect(morning.today).toContainEqual({ what: 'wage', amount: -DATA.staff.wage });
      expect(goals(morning).find((g) => g.id === 'staff')!.done).toBe(true); // a groom counts once paid
      expect(goals(s0).find((g) => g.id === 'staff')!.done).toBe(false); // hired, not yet paid
      expect(morning.horses.every((h) => h.needs.clean > 20)).toBe(true);
      // the morning's income comes first: a boarder's pay can pay the wage
      const guest = { ...dirty[0], id: 'g', owner: { name: 'Familie Weber', pay: DATA.staff.wage, unhappy: 0 } };
      const paidByBoard = apply({ ...s0, money: 0, horses: [...dirty, guest] }, { type: 'sleep' });
      expect(paidByBoard.today.some((e) => e.what === 'wage')).toBe(true);
      const broke = apply({ ...s0, money: DATA.staff.wage - 1, horses: dirty }, { type: 'sleep' });
      expect([broke.night.some((n) => n.kind === 'staffUnpaid'), broke.today.some((e) => e.what === 'wage')]).toEqual([true, false]);
      expect(apply(s0, { type: 'fire' }).staff).toBe(0);
      expect(apply({ ...newGame(1), money: 999 }, { type: 'hire' }).staff).toBe(0); // only from the Pensionsstall on
    });

    it('a boarder\'s horse moves into a free stall, pays each morning, and is not for lessons or shows', () => {
      const s0 = pension(), o = s0.boardOffers[0], s = apply(s0, { type: 'board', offer: o.id }), guest = s.horses.find((h) => h.id === o.id)!;
      expect([guest.owner, s.boardOffers.length]).toEqual([{ name: o.owner, pay: o.pay, unhappy: 0 }, DATA.boarders.offers - 1]);
      expect(apply({ ...s, horses: s.horses.map((h) => ({ ...h })) }, { type: 'train', horse: guest.id, faults: 0 }).trainings).toBe(s.trainings);
      expect(apply(s, { type: 'rename', horse: guest.id, name: 'Neu' })).toBe(s);
      const full = { ...s, horses: [...s.horses, ...Array(DATA.stalls.pensionsstall).fill(s.horses[0]).map((h, i) => ({ ...h, id: `x${i}` }))] };
      expect(apply(full, { type: 'board', offer: s.boardOffers[0].id })).toBe(full); // no free stall
      const next = apply(s, { type: 'sleep' });
      expect(next.today).toContainEqual({ what: 'board', amount: o.pay });
      expect(goals(next).find((g) => g.id === 'boarders')!.have).toBe(1);
      expect(goals(next).find((g) => g.id === 'horses')).toBeUndefined(); // the Pensionsstall counts boarders, not horses
    });

    it('badly kept for a few nights, a boarder takes their horse away and the reputation drops', () => {
      const s0 = pension(), o = s0.boardOffers[0];
      let s = apply(s0, { type: 'board', offer: o.id });
      const neglect = (st: State): State => ({ ...st, feed: 50, horses: st.horses.map((h) => (h.owner ? { ...h, needs: { ...h.needs, fed: 5, clean: 5, happy: 5 } } : h)) });
      for (let n = 1; n < DATA.boarders.patience; n++) s = apply(neglect(s), { type: 'sleep' });
      expect(s.horses.find((h) => h.id === o.id)?.owner?.unhappy).toBe(DATA.boarders.patience - 1);
      const gone = apply(neglect(s), { type: 'sleep' });
      expect([gone.horses.some((h) => h.id === o.id), gone.reputation]).toEqual([false, s.reputation - DATA.boarders.leaveReputation]);
      expect(gone.night).toContainEqual({ kind: 'boarderLeft', horse: o.name, owner: o.owner });
    });

    it('a rider rides one of your horses each day for a fee and its energy, until you end it', () => {
      let s = apply(pension(), { type: 'sleep' }); // a rider's offer comes in the morning
      const p = s.partOffer!, h = s.horses.find((x) => x.id === p.horse)!;
      s = apply(s, { type: 'partBoard' });
      expect([s.partOffer, s.horses.find((x) => x.id === h.id)!.rider]).toEqual([null, { name: p.rider, pay: p.pay }]);
      const rested = { ...s, horses: s.horses.map((x) => ({ ...x, needs: { ...x.needs, energy: 50 } })) }, next = apply(rested, { type: 'sleep' });
      expect(next.today).toContainEqual({ what: 'partBoard', amount: p.pay });
      const other = next.horses.find((x) => x.id !== h.id && !x.rider)!, ridden = next.horses.find((x) => x.id === h.id)!;
      expect(other.needs.energy - ridden.needs.energy).toBe(DATA.partBoard.energy);
      expect(apply(next, { type: 'endPartBoard', horse: h.id }).horses.find((x) => x.id === h.id)!.rider).toBeUndefined();
      // a resting horse isn't ridden that morning, and its rider doesn't pay
      const resting = apply({ ...rested, horses: rested.horses.map((x) => (x.id === h.id ? { ...x, rest: 2 } : x)) }, { type: 'sleep' });
      expect([resting.today.some((e) => e.what === 'partBoard'), resting.horses.find((x) => x.id === h.id)!.needs.energy]).toEqual([false, other.needs.energy]);
    });

    it('boarders never bring a horse with the name of one on the farm or at the market; a name for sale is taken', () => {
      let s = pension();
      for (let d = 0; d < 30; d++) {
        s = apply(s, { type: 'sleep' });
        const names = [...s.horses, ...s.market].map((x) => x.name.toLowerCase());
        for (const o of s.boardOffers) expect(names, `day ${s.day}`).not.toContain(o.name.toLowerCase());
      }
      expect(apply(s, { type: 'rename', horse: s.horses[0].id, name: s.boardOffers[0].name })).toBe(s);
    });
  });

  it('sells horses at the Reitschule: fresh offers each morning, only with money and a free stall place', () => {
    const [offers] = marketFor(4, 42);
    expect(offers).toHaveLength(DATA.market.offers);
    for (const o of offers) {
      const [lo, hi] = DATA.market.price[o.look.build];
      expect(o.price).toBeGreaterThanOrEqual(lo); expect(o.price).toBeLessThanOrEqual(hi);
    }
    expect(marketFor(4, 42)[0]).toEqual(offers);
    expect(new Set(offers.map((o) => o.name)).size).toBe(offers.length);
    expect(marketFor(4, 42, offers.map((o) => o.name))[0].map((o) => o.name).filter((n) => offers.some((o) => o.name === n))).toEqual([]); // not a name already on the farm
    const s: State = { ...newGame(1), stage: 'reitschule', market: offers, money: 2000 };
    // the Reitschule has a free stall at once: one horse fits, then every place is taken
    const first = apply(s, { type: 'buyHorse', offer: offers[1].id });
    expect([first.horses.length, stalls(first)]).toEqual([3, DATA.stalls.reitschule]);
    expect(apply(first, { type: 'buyHorse', offer: offers[2].id })).toBe(first);
    const roomy = apply(s, { type: 'build', what: 'stalls' });
    expect([stalls(roomy), roomy.money]).toEqual([DATA.stalls.reitschule + DATA.build.stalls.places, 2000 - DATA.build.stalls.cost]);
    const bought = apply(roomy, { type: 'buyHorse', offer: offers[0].id });
    expect(bought.horses.at(-1)).toMatchObject({ id: offers[0].id, name: offers[0].name, look: offers[0].look });
    expect([bought.money, bought.market.length]).toEqual([roomy.money - offers[0].price, offers.length - 1]);
    expect(apply({ ...roomy, money: 10 }, { type: 'buyHorse', offer: offers[0].id }).horses).toHaveLength(2);
    expect(apply(bought, { type: 'sleep' }).market.map((o) => o.id)).not.toContain(offers[1].id); // a new market tomorrow
  });

  it('builds once each: stall places and the arena upgrade, which brings one more pupil a day', () => {
    const s: State = { ...newGame(1), stage: 'reitschule', money: 1000, reputation: 0 };
    expect(buildWaits(newGame(1), 'arena')).toBe('stage');
    expect(buildWaits({ ...s, money: 10 }, 'arena')).toBe('money');
    const up = apply(s, { type: 'build', what: 'arena' });
    expect([up.built.arena, buildWaits(up, 'arena')]).toEqual([1, 'built']);
    expect(apply(up, { type: 'build', what: 'arena' })).toBe(up);
    expect(apply(s, { type: 'sleep' }).pupils.length + 1).toBe(apply(up, { type: 'sleep' }).pupils.length);
  });

  it('rolls the same numbers from the same seed', () => {
    const a = roll(42);
    expect(roll(42)).toEqual(a);
    expect(a[0]).toBeGreaterThanOrEqual(0);
    expect(a[0]).toBeLessThan(1);
  });
});
