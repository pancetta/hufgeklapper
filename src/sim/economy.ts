/**
 * The economy run: plays the Sim headless for some days with a simple strategy, to check the balance (#18).
 * Strategies are players in miniature, using only actions a child has; jumping rounds get their poles from the
 * game's own random numbers, as a child of middling skill would knock them.
 */
import { DATA } from './data';
import {
  type Action, apply, badgeWaits, classWaits, SHOW_CLASSES, type ShowClass, jumpWindow, buildWaits, canInspect, CARE, cantWork, type Horse, isSick, lessonOutcome, newGame, roll, scope, atLeast, own, stuck, gameOver,
  showWaits, stalls, xcWindow, noRoom, badge2Waits, xcShowWaits, xcClassWaits,
} from './state';

export type Strategy = 'careful' | 'careless' | 'sport';
export type Report = {
  strategy: Strategy; seed: number; days: number;
  money: number[]; // at the end of each day
  /** What the farm is worth at the end: money minus debt, plus what was spent on horses and building. */
  worth: number;
  badgeDay: number | null; inspectionDay: number | null; pensionDay: number | null;
  sickDays: number; maxDebt: number; lessons: number; shows: number;
  xcRides: number; xcShows: number; badge2Day: number | null; jumping: number; crossCountry: number; // cross-country practice rides; the best skills at the end
  deadEnd: number; // the longest run of mornings in a dead end (every horse sick, no money, no loan)
  lostDay: number | null; // the day the farm was lost (game over), if it was
};

const ALL_RIGHT = Array(DATA.badge.questions).fill(0);

/** Plays `days` days with `strategy` from a new game on `seed`. */
export function play(strategy: Strategy, seed: number, days: number): Report {
  let s = newGame(seed), luck = seed ^ 0x5eed, streak = 0, longest = 0, lostDay: number | null = null, shows = 0, sickDays = 0, maxDebt = 0, badgeDay: number | null = null, inspectionDay: number | null = null, pensionDay: number | null = null;
  const money: number[] = [];
  const act = (a: Action) => { s = apply(s, a); };
  /**
   * Poles a middling rider knocks: one time in five on a new pony, fewer the wider the horse's take-off window
   * (skill and care, as in the minigame), more on a neglected one.
   */
  const base = jumpWindow(newGame(seed).horses[0]);
  const faults = (h: Horse, c: ShowClass = 'E') => {
    let n = 0, r: number;
    for (let i = 0; i < DATA.jumping.courses[c].jumps.length; i++) { [r, luck] = roll(luck); if (r < 0.2 * (base / jumpWindow(h))) n++; }
    return n;
  };
  /**
   * Refusals cross-country: one obstacle in six on a new pony, fewer the wider its take-off window (#73); a show class
   * (#75) has more obstacles and a narrower window.
   */
  const xcBase = xcWindow(newGame(seed).horses[0]);
  let xcLuck = seed ^ 0xbeef; // its own dice: riding cross-country doesn't shuffle the jumping rounds
  const xcFaults = (h: Horse, c?: ShowClass) => {
    const C = c ? DATA.xcShows.classes[c] : { obstacles: DATA.crossCountry.obstacles, window: 1 };
    let n = 0, r: number;
    for (let i = 0; i < C.obstacles; i++) { [r, xcLuck] = roll(xcLuck); if (r < (1 / 6) * (xcBase / (xcWindow(h) * C.window))) n++; }
    return n;
  };
  let invested = 0, xcRides = 0, xcShows = 0, badge2Day: number | null = null;
  /** A stall is free but the pasture is full (#79): enlarge it, if the money allows. */
  const roomOnPasture = (build: Horse['look']['build']) => {
    if (noRoom(s, build) === 'pasture' && !buildWaits(s, 'pasture') && s.money > DATA.build.pasture.cost + 150) act({ type: 'build', what: 'pasture' });
  };
  const best = (c: Horse[]) => [...c].sort((a, b) => b.skills.jumping - a.skills.jumping)[0];
  /** The highest class a horse may start in today: a child picks the class with the biggest prize. */
  const topClass = (h: Horse) => SHOW_CLASSES.filter((c) => !classWaits(s, h, c)).pop();
  // boarders' horses aren't ours to ride; the freshest first
  const fresh = (energy: number) => s.horses.filter((h) => own(h) && !cantWork(h, energy)).sort((a, b) => b.needs.energy - a.needs.energy);

  for (let d = 0; d < days; d++) {
    const careful = strategy !== 'careless' || d % 3 === 0; // the careless player looks after the horses every third day
    sickDays += s.horses.filter(isSick).length; // counted in the morning, before the vet comes
    streak = stuck(s) ? streak + 1 : 0; longest = Math.max(longest, streak); // mornings in a dead end in a row
    if (gameOver(s)) { lostDay = s.day; break; }
    // the vet for a sick horse, with a loan if the money is short
    for (const h of s.horses.filter(isSick)) { if (s.money < DATA.vet.cost) act({ type: 'loan' }); act({ type: 'vet', horse: h.id }); }
    // hay: the careful keep a few nights in store, the careless buy when it's gone
    const want = strategy === 'careless' ? 1 : s.horses.length * 3;
    if (s.feed < want) act({ type: 'buyHay', pack: s.horses.length > 2 ? 1 : 0 });
    if (careful) for (const h of s.horses) for (const what of CARE) act({ type: 'care', horse: h.id, what, quick: s.careDone[what] >= DATA.quickCareAfter });
    // sport first for the sport player, lessons first for the others
    const sport = () => {
      if (s.trainings < DATA.badge.trainings || (strategy === 'sport' && s.badges)) {
        // the sport player trains their best jumper, so one horse grows into the higher classes
        // (the one that can still get better, the best jumper by breed first: class L needs one)
        const h = strategy === 'sport'
          ? fresh(DATA.jumping.energy).filter((x) => x.skills.jumping < scope(x)).sort((a, b) => scope(b) - scope(a) || b.skills.jumping - a.skills.jumping)[0]
          : fresh(DATA.jumping.energy)[0];
        if (h && (strategy === 'sport' || s.trainings < DATA.badge.trainings)) act({ type: 'train', horse: h.id, faults: faults(h) });
      }
      if (!badgeWaits(s)) {
        act({ type: 'badgeQuiz', answers: ALL_RIGHT });
        const h = fresh(DATA.jumping.energy)[0];
        if (h) act({ type: 'badge', horse: h.id, faults: faults(h) });
        if (s.badges && badgeDay === null) badgeDay = s.day;
      }
      if (!showWaits(s)) {
        const h = best(fresh(DATA.jumping.energy)), c = h && topClass(h);
        if (h && c) { act({ type: 'show', horse: h.id, faults: faults(h, c), showClass: c }); shows++; }
      }
    };
    const lessons = () => {
      const first = s.pupils[0];
      for (const p of [...s.pupils]) {
        const best = fresh(DATA.lessons.energy).sort((a: Horse, b: Horse) => lessonOutcome(p, b).pay - lessonOutcome(p, a).pay)[0];
        if (best && (strategy !== 'sport' || s.horses.filter(own).length > 2 || p === first)) act({ type: 'lesson', pupil: p.id, horse: best.id });
      }
    };
    // the sport player, once practised cross-country: one care course, then riding badge 2 (#74) with a fresh horse in
    // the morning
    if (strategy === 'sport' && s.badges === 1) {
      if (s.xcTrainings >= DATA.badge2.xcTrainings && !s.routines) act({ type: 'routine', horse: s.horses.filter(own)[0].id, wrong: 0, ride: false });
      const exam = !badge2Waits(s) && fresh(DATA.badge2.energy)[0];
      if (exam) act({ type: 'badge2', horse: exam.id, wrong: 0, faults: xcFaults(exam) });
      if (s.badges >= 2) badge2Day = s.day;
    }
    if (strategy === 'sport') { sport(); lessons(); } else { lessons(); sport(); }
    // the sport player also rides cross-country (#73), with whatever horse has energy left after jumping and lessons:
    // after riding badge 2 a cross-country show on show days (#75)
    if (strategy === 'sport' && s.badges) {
      const h = fresh(DATA.crossCountry.energy).sort((a, b) => b.skills.crossCountry - a.skills.crossCountry)[0];
      const c = h && !xcShowWaits(s) && SHOW_CLASSES.filter((k) => !xcClassWaits(s, h, k)).pop();
      if (h && c) { act({ type: 'xcShow', horse: h.id, faults: xcFaults(h, c), showClass: c }); xcShows++; }
      else if (h) { act({ type: 'xcTrain', horse: h.id, faults: xcFaults(h) }); xcRides++; }
    }
    // the farm grows: inspection, then stall places, horses and the arena when the money is there
    if (canInspect(s)) {
      act({ type: 'inspection', answers: ALL_RIGHT });
      if (s.stage === 'reitschule' && inspectionDay === null) inspectionDay = s.day;
      if (s.stage === 'pensionsstall' && pensionDay === null) pensionDay = s.day;
    }
    // the Pensionsstall: a groom once there is money for a few days' wages, boarders into free stalls, any rider
    if (s.stage === 'pensionsstall' && strategy !== 'careless') {
      if (!s.staff && s.money > DATA.staff.wage * 10) act({ type: 'hire' });
      for (const o of [...s.boardOffers]) { roomOnPasture(o.look.build); act({ type: 'board', offer: o.id }); }
      if (s.partOffer) act({ type: 'partBoard' });
    }
    if (atLeast(s, 'reitschule') && strategy !== 'careless') {
      if (!buildWaits(s, 'stalls') && s.money > DATA.build.stalls.cost + 200) act({ type: 'build', what: 'stalls' });
      // the careful player buys the cheapest horse, the sport player the best jumper it can afford (class L needs one)
      const offer = s.market.filter((o) => o.price + 150 < s.money).sort((a, b) => (strategy === 'sport' ? scope(b) - scope(a) : 0) || a.price - b.price)[0];
      if (offer && s.horses.length < stalls(s) && (!noRoom(s, offer.look.build) || s.money > offer.price + DATA.build.pasture.cost)) { roomOnPasture(offer.look.build); act({ type: 'buyHorse', offer: offer.id }); }
      if (!buildWaits(s, 'arena') && s.money > DATA.build.arena.cost + 300) act({ type: 'build', what: 'arena' });
    }
    invested -= s.today.filter((e) => e.what === 'horse' || e.what === 'build').reduce((n, e) => n + e.amount, 0);
    maxDebt = Math.max(maxDebt, s.debt);
    money.push(s.money);
    act({ type: 'sleep' });
  }
  const top = (k: 'jumping' | 'crossCountry') => Math.max(0, ...s.horses.filter(own).map((h) => h.skills[k]));
  return { strategy, seed, days, money, worth: s.money - s.debt + invested, badgeDay, inspectionDay, pensionDay, sickDays, maxDebt, lessons: s.lessonsGiven, shows, deadEnd: longest, lostDay, xcRides, xcShows, badge2Day, jumping: top('jumping'), crossCountry: top('crossCountry') };
}

/** One line per run, for docs/economy.md and the console. */
export function summary(r: Report) {
  const at = (d: number) => r.money[Math.min(d, r.money.length) - 1];
  return `| ${r.strategy} | ${r.seed} | ${at(10)} € | ${at(20)} € | ${at(r.days)} € | ${r.worth} € | ${r.badgeDay ?? '–'} | ${r.inspectionDay ?? '–'} | ${r.lessons} | ${r.shows} | ${r.sickDays} | ${r.maxDebt} € | ${r.lostDay ?? '–'} | ${r.jumping} / ${r.crossCountry} (${r.xcRides}) | ${r.badge2Day ?? '–'} | ${r.xcShows} |`;
}
export const TABLE_HEAD = '| Spielweise | Seed | Geld Tag 10 | Geld Tag 20 | Geld am Ende | Hof-Wert am Ende | Reitabzeichen (Tag) | Hof-Prüfung (Tag) | Reitstunden | Turniere | Kranktage | höchste Schulden | Hof verloren (Tag) | Können Springen / Gelände (Geländeritte) | Reitabzeichen 2 (Tag) | Gelände-Turniere |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';
