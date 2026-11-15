/**
 * The economy run: plays the Sim headless for some days with a simple strategy, to check the balance (#18).
 * Strategies are players in miniature, using only actions a child has; jumping rounds get their poles from the
 * game's own random numbers, as a child of middling skill would knock them.
 */
import { DATA } from './data';
import {
  type Action, apply, badgeWaits, buildWaits, canInspect, CARE, cantWork, type Horse, isSick, lessonOutcome, newGame, roll,
  showWaits, stalls,
} from './state';

export type Strategy = 'careful' | 'careless' | 'sport';
export type Report = {
  strategy: Strategy; seed: number; days: number;
  money: number[]; // at the end of each day
  badgeDay: number | null; inspectionDay: number | null;
  sickDays: number; maxDebt: number; lessons: number; shows: number; stuck: boolean;
};

const ALL_RIGHT = Array(DATA.badge.questions).fill(0);

/** Plays `days` days with `strategy` from a new game on `seed`. */
export function play(strategy: Strategy, seed: number, days: number): Report {
  let s = newGame(seed), luck = seed ^ 0x5eed, shows = 0, sickDays = 0, maxDebt = 0, badgeDay: number | null = null, inspectionDay: number | null = null;
  const money: number[] = [];
  const act = (a: Action) => { s = apply(s, a); };
  /** Poles a middling rider knocks: each of the round's jumps falls one time in five. */
  const faults = () => {
    let n = 0, r: number;
    for (let i = 0; i < DATA.jumping.jumps; i++) { [r, luck] = roll(luck); if (r < 0.2) n++; }
    return n;
  };
  const fresh = (energy: number) => s.horses.filter((h) => !cantWork(h, energy)).sort((a, b) => b.needs.energy - a.needs.energy);

  for (let d = 0; d < days; d++) {
    const careful = strategy !== 'careless' || d % 3 === 0; // the careless player looks after the horses every third day
    // the vet for a sick horse, with a loan if the money is short
    for (const h of s.horses.filter(isSick)) { if (s.money < DATA.vet.cost) act({ type: 'loan' }); act({ type: 'vet', horse: h.id }); }
    // hay: the careful keep a few nights in store, the careless buy when it's gone
    const want = strategy === 'careless' ? 1 : s.horses.length * 3;
    if (s.feed < want) act({ type: 'buyHay', pack: s.horses.length > 2 ? 1 : 0 });
    if (careful) for (const h of s.horses) for (const what of CARE) act({ type: 'care', horse: h.id, what, quick: s.careDone[what] >= DATA.quickCareAfter });
    // sport first for the sport player, lessons first for the others
    const sport = () => {
      if (s.trainings < DATA.badge.trainings || (strategy === 'sport' && s.badges)) {
        const h = fresh(DATA.jumping.energy)[0];
        if (h && (strategy === 'sport' || s.trainings < DATA.badge.trainings)) act({ type: 'train', horse: h.id, faults: faults() });
      }
      if (!badgeWaits(s)) {
        act({ type: 'badgeQuiz', answers: ALL_RIGHT });
        const h = fresh(DATA.jumping.energy)[0];
        if (h) act({ type: 'badge', horse: h.id, faults: faults() });
        if (s.badges && badgeDay === null) badgeDay = s.day;
      }
      if (!showWaits(s)) {
        const h = fresh(DATA.jumping.energy)[0];
        if (h) { act({ type: 'show', horse: h.id, faults: faults() }); shows++; }
      }
    };
    const lessons = () => {
      for (const p of [...s.pupils]) {
        const best = fresh(DATA.lessons.energy).sort((a: Horse, b: Horse) => lessonOutcome(p, b).pay - lessonOutcome(p, a).pay)[0];
        if (best && (strategy !== 'sport' || s.horses.length > 2 || p === s.pupils[0])) act({ type: 'lesson', pupil: p.id, horse: best.id });
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
    sickDays += s.horses.filter(isSick).length;
    maxDebt = Math.max(maxDebt, s.debt);
    money.push(s.money);
    act({ type: 'sleep' });
  }
  // stuck: every horse sick or exhausted with no way to the vet, or debts at the limit with no money
  const stuck = s.horses.every((h) => isSick(h)) && s.money < DATA.vet.cost && s.debt + DATA.loan.amount > DATA.loan.debtLimit;
  return { strategy, seed, days, money, badgeDay, inspectionDay, sickDays, maxDebt, lessons: s.lessonsGiven, shows, stuck };
}

/** One line per run, for docs/economy.md and the console. */
export function summary(r: Report) {
  const at = (d: number) => r.money[Math.min(d, r.money.length) - 1];
  return `| ${r.strategy} | ${r.seed} | ${at(10)} € | ${at(20)} € | ${at(r.days)} € | ${r.badgeDay ?? '–'} | ${r.inspectionDay ?? '–'} | ${r.lessons} | ${r.shows} | ${r.sickDays} | ${r.maxDebt} € | ${r.stuck ? 'ja' : 'nein'} |`;
}
export const TABLE_HEAD = '| Spielweise | Seed | Geld Tag 10 | Geld Tag 20 | Geld am Ende | Reitabzeichen (Tag) | Hof-Prüfung (Tag) | Reitstunden | Turniere | Kranktage | höchste Schulden | festgefahren |\n|---|---|---|---|---|---|---|---|---|---|---|---|';
