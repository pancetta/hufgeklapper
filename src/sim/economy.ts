/**
 * The economy run: plays the Sim headless for some days with a simple strategy, to check the balance (#18).
 * Strategies are players in miniature, using only actions a child has; jumping rounds get their poles from the
 * game's own random numbers, as a child of middling skill would knock them.
 */
import { DATA } from './data';
import {
  type Action, apply, badgeWaits, classWaits, SHOW_CLASSES, type ShowClass, jumpWindow, buildWaits, canInspect, CARE, cantWork, type Horse, isSick, lessonOutcome, newGame, roll,
  showWaits, stalls,
} from './state';

export type Strategy = 'careful' | 'careless' | 'sport';
export type Report = {
  strategy: Strategy; seed: number; days: number;
  money: number[]; // at the end of each day
  /** What the farm is worth at the end: money minus debt, plus what was spent on horses and building. */
  worth: number;
  badgeDay: number | null; inspectionDay: number | null;
  sickDays: number; maxDebt: number; lessons: number; shows: number; stuck: boolean;
};

const ALL_RIGHT = Array(DATA.badge.questions).fill(0);

/** Plays `days` days with `strategy` from a new game on `seed`. */
export function play(strategy: Strategy, seed: number, days: number): Report {
  let s = newGame(seed), luck = seed ^ 0x5eed, shows = 0, sickDays = 0, maxDebt = 0, badgeDay: number | null = null, inspectionDay: number | null = null;
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
  let invested = 0;
  const best = (c: Horse[]) => [...c].sort((a, b) => b.skills.jumping - a.skills.jumping)[0];
  /** The highest class a horse may start in today: a child picks the class with the biggest prize. */
  const topClass = (h: Horse) => SHOW_CLASSES.filter((c) => !classWaits(s, h, c)).pop();
  const fresh = (energy: number) => s.horses.filter((h) => !cantWork(h, energy)).sort((a, b) => b.needs.energy - a.needs.energy);

  for (let d = 0; d < days; d++) {
    const careful = strategy !== 'careless' || d % 3 === 0; // the careless player looks after the horses every third day
    sickDays += s.horses.filter(isSick).length; // counted in the morning, before the vet comes
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
        const h = strategy === 'sport' ? best(fresh(DATA.jumping.energy)) : fresh(DATA.jumping.energy)[0];
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
        if (best && (strategy !== 'sport' || s.horses.length > 2 || p === first)) act({ type: 'lesson', pupil: p.id, horse: best.id });
      }
    };
    if (strategy === 'sport') { sport(); lessons(); } else { lessons(); sport(); }
    // the farm grows: inspection, then stall places, horses and the arena when the money is there
    if (canInspect(s)) { act({ type: 'inspection', answers: ALL_RIGHT }); if (s.stage === 'reitschule') inspectionDay = s.day; }
    if (s.stage === 'reitschule' && strategy !== 'careless') {
      if (!buildWaits(s, 'stalls') && s.money > DATA.build.stalls.cost + 200) act({ type: 'build', what: 'stalls' });
      const offer = s.market.filter((o) => o.price + 150 < s.money).sort((a, b) => a.price - b.price)[0];
      if (offer && s.horses.length < stalls(s)) act({ type: 'buyHorse', offer: offer.id });
      if (!buildWaits(s, 'arena') && s.money > DATA.build.arena.cost + 300) act({ type: 'build', what: 'arena' });
    }
    invested -= s.today.filter((e) => e.what === 'horse' || e.what === 'build').reduce((n, e) => n + e.amount, 0);
    maxDebt = Math.max(maxDebt, s.debt);
    money.push(s.money);
    act({ type: 'sleep' });
  }
  // stuck: every horse sick, no money for the vet and no more loans
  const stuck = s.horses.every((h) => isSick(h)) && s.money < DATA.vet.cost && s.debt + DATA.loan.amount > DATA.loan.debtLimit;
  return { strategy, seed, days, money, worth: s.money - s.debt + invested, badgeDay, inspectionDay, sickDays, maxDebt, lessons: s.lessonsGiven, shows, stuck };
}

/** One line per run, for docs/economy.md and the console. */
export function summary(r: Report) {
  const at = (d: number) => r.money[Math.min(d, r.money.length) - 1];
  return `| ${r.strategy} | ${r.seed} | ${at(10)} € | ${at(20)} € | ${at(r.days)} € | ${r.worth} € | ${r.badgeDay ?? '–'} | ${r.inspectionDay ?? '–'} | ${r.lessons} | ${r.shows} | ${r.sickDays} | ${r.maxDebt} € | ${r.stuck ? 'ja' : 'nein'} |`;
}
export const TABLE_HEAD = '| Spielweise | Seed | Geld Tag 10 | Geld Tag 20 | Geld am Ende | Hof-Wert am Ende | Reitabzeichen (Tag) | Hof-Prüfung (Tag) | Reitstunden | Turniere | Kranktage | höchste Schulden | festgefahren |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|';
