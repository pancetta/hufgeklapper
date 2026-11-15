/**
 * The Sim: the game rules as a pure module (ADR-0001). State in, action in, new state out; no pixels, no DOM.
 * Randomness comes from the seed kept in the state, so the same game plays the same way.
 */
import type { Breed, Look } from '../horses/look';
import { breedLook } from '../horses/look';
import type { HairStyle } from '../riders/look';
import { DATA } from './data';

export type Need = 'fed' | 'clean' | 'happy' | 'energy' | 'health';
export const NEEDS: Need[] = ['fed', 'clean', 'happy', 'energy', 'health'];
export type Needs = Record<Need, number>;

export type Horse = {
  id: string; name: string; breed: Breed; look: Look; needs: Needs; skills: { jumping: number };
  rest: number; // days the horse must still rest after the vet (no riding, no lessons)
  cared: Care[]; // care actions it had today; each once a day
};

export type FarmStage = 'kleinerHof' | 'reitschule';

export type State = {
  version: 9;
  /** The player's figure. */
  avatar: Avatar;
  seed: number; // the random generator's state, moved on by each roll
  day: number;
  money: number;
  feed: number; // hay bales in store
  stage: FarmStage;
  horses: Horse[];
  /** What happened last night, for the morning summary. */
  night: News[];
  /** How often each care action was done by hand (quick care unlocks after a few). */
  careDone: Record<Care, number>;
  /** Money owed: hay bought on credit ("angeschrieben") and bank loans. */
  debt: number;
  /** Pupils waiting for a lesson today; the farm's reputation (0–100) brings more. */
  pupils: Pupil[];
  reputation: number;
  lessonsGiven: number;
  /** Jumping rounds practised; riding badges passed; the day a badge attempt last failed and the day its quiz was passed (0: never). */
  trainings: number;
  badges: number;
  badgeFailedDay: number;
  /** The day of the last show the player rode in (0: none yet). */
  lastShowDay: number;
  /** Goals reached (they stay reached), and the features Oma Hanne has explained already. */
  goalsDone: GoalId[];
  explained: Feature[];
  badgeQuizDay: number;
  /** Money in and out today, for tomorrow morning's bill; `bill` is yesterday's. */
  today: Entry[];
  bill: Entry[];
};

/** One line of the bill: what for, and the amount (+ in, − out). */
export type Entry = { what: 'hay' | 'hayOnCredit' | 'vet' | 'loan' | 'repay' | 'lesson' | 'showFee' | 'prize'; amount: number };

/** The player's figure ("Avatar"): a name and a rider's look (indices into the palettes in riders/look.ts). */
export type Avatar = { name: string; skin: number; hair: HairStyle; hairColor: number; jacket: number };

/** A pupil ("Reitschüler"): a small or big child, a beginner or advanced rider. */
export type Pupil = { id: string; name: string; size: 'small' | 'big'; level: 'beginner' | 'advanced'; look: number };

export type Care = 'groom' | 'hooves' | 'feed' | 'muck';
export const CARE: Care[] = ['groom', 'hooves', 'feed', 'muck'];

/** Morning news: data only; the screens turn it into words. */
export type News = { kind: 'sick' | 'noHay' | 'hayLow' | 'rested' | 'bill'; horse?: string };

export type Action = { type: 'sleep' } | { type: 'vet'; horse: string } | { type: 'care'; horse: string; what: Care; quick?: boolean }
  | { type: 'buyHay'; pack: number } | { type: 'loan' } | { type: 'lesson'; pupil: string; horse: string }
  | { type: 'train'; horse: string; faults: number }
  | { type: 'badgeQuiz'; answers: number[] } | { type: 'badge'; horse: string; faults: number }
  | { type: 'show'; horse: string; faults: number }
  | { type: 'explained'; what: Feature };

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** The game's random generator (mulberry32): a value in [0, 1) and the next seed. */
export function roll(seed: number): [value: number, next: number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** This morning's pupils: one, plus more the better the farm's reputation. */
export function pupilsFor(day: number, reputation: number, seed: number): [Pupil[], number] {
  const n = 1 + DATA.lessons.morePupilsAt.filter((r) => reputation >= r).length, pupils: Pupil[] = [];
  for (let i = 0; i < n; i++) {
    let a: number, b: number, c: number, d: number;
    [a, seed] = roll(seed); [b, seed] = roll(seed); [c, seed] = roll(seed); [d, seed] = roll(seed);
    pupils.push({
      id: `d${day}-${i}`, name: DATA.pupilNames[Math.floor(a * DATA.pupilNames.length)],
      size: b < 0.6 ? 'small' : 'big', level: c < 0.65 ? 'beginner' : 'advanced', look: Math.floor(d * 1000),
    });
  }
  return [pupils, seed];
}

/** A new game on Oma Hanne's small farm: two ponies of different breeds and coats. */
export function newGame(seed: number, avatar: Avatar = DATA.avatar): State {
  const horse = (id: string, name: string, breed: Breed, look: Look): Horse =>
    ({ id, name, breed, look, needs: { ...DATA.needs.start }, skills: { jumping: 10 }, rest: 0, cared: [] });
  const [pupils, next] = pupilsFor(1, DATA.lessons.startReputation, seed);
  return {
    version: 9, avatar, trainings: 0, badges: 0, badgeFailedDay: 0, badgeQuizDay: 0, lastShowDay: 0, goalsDone: [], explained: [], seed: next, day: 1, money: DATA.start.money, feed: DATA.start.feed, stage: 'kleinerHof', night: [],
    careDone: { groom: 0, hooves: 0, feed: 0, muck: 0 }, debt: 0, today: [], bill: [],
    pupils, reputation: DATA.lessons.startReputation, lessonsGiven: 0,
    horses: [
      horse('kiwi', 'Kiwi', 'haflinger', breedLook('haflinger')),
      horse('luna', 'Luna', 'islaender', breedLook('islaender', 'rappe', { face: 'stern' })),
    ],
  };
}

export const isSick = (h: Horse) => h.needs.health < DATA.needs.sickBelow;
export const canPayVet = (s: State) => s.money >= DATA.vet.cost;
export const canQuickCare = (s: State, what: Care) => s.careDone[what] >= DATA.quickCareAfter;
export const canFeed = (s: State) => s.feed >= 1;
/** Hay can always be had: paid if the money is there, else on credit, so the horses never go hungry for lack of it. */
export const hayOnCredit = (s: State, pack: number) => s.money < DATA.hayPacks[pack].price;
export const canLoan = (s: State) => s.debt + DATA.loan.amount <= DATA.loan.debtLimit;

/** Why a horse can't do work that takes `energy` now (sick, resting after the vet, too tired), or null if it can. */
export function cantWork(h: Horse, energy: number): 'sick' | 'resting' | 'tired' | null {
  return isSick(h) ? 'sick' : h.rest ? 'resting' : h.needs.energy < energy ? 'tired' : null;
}

/**
 * The jumping minigame's take-off window in seconds: wider for a skilled, well kept, happy horse.
 * A tap within half the window of the perfect moment clears the jump.
 */
export function jumpWindow(h: Horse) {
  const J = DATA.jumping, kept = (h.needs.fed + h.needs.clean + h.needs.happy) / 300;
  return J.window.base + J.window.skill * (h.skills.jumping / 100) + J.window.kept * kept;
}
export const clears = (h: Horse, offset: number) => Math.abs(offset) <= jumpWindow(h) / 2;
/**
 * What a tap `offset` seconds from the perfect take-off does: too early to count yet, a clear jump, or a knocked pole.
 * Without a tap, the pole falls once `missed`.
 */
export const takeOff = (h: Horse, offset: number): 'early' | 'clear' | 'fault' =>
  offset < -DATA.jumping.early ? 'early' : clears(h, offset) ? 'clear' : 'fault';
export const missed = (h: Horse, offset: number) => offset > jumpWindow(h) / 2 + DATA.jumping.late;

/**
 * Why the riding badge can't be tried now: passed already, more practice first, tomorrow after a failed try, or every
 * horse too tired for the jumping round (so the quiz isn't wasted).
 */
export function badgeWaits(s: State): { why: 'passed' } | { why: 'practise'; rounds: number } | { why: 'tomorrow' } | { why: 'tired' } | null {
  if (s.badges >= 1) return { why: 'passed' };
  if (s.trainings < DATA.badge.trainings) return { why: 'practise', rounds: DATA.badge.trainings - s.trainings };
  if (s.badgeFailedDay === s.day) return { why: 'tomorrow' };
  return s.horses.every((h) => cantWork(h, DATA.jumping.energy)) ? { why: 'tired' } : null;
}
/** The next show day: today if a show is on and not ridden yet. */
export function nextShowDay(s: State) {
  const every = DATA.shows.every, on = Math.ceil(s.day / every) * every;
  return on === s.lastShowDay ? on + every : on;
}
/** Why the player can't ride in a show today, or null if they can (the horse still has to be fit). */
export function showWaits(s: State): 'badge' | 'notToday' | 'money' | null {
  return s.badges < 1 ? 'badge' : nextShowDay(s) !== s.day ? 'notToday' : s.money < DATA.shows.fee ? 'money' : null;
}
const showScore = (faults: number, skill: number) => 100 - DATA.shows.faultPoints * faults + Math.round(skill * DATA.shows.skillPoints);

export type ShowRow = { rider: string; horse: string; score: number; you?: true };
/**
 * A show's results for the player's round with horse `h`: the rivals ride with chance from the game's seed. The table
 * is best first; the player wins a tie. Returns the rank (1 = first), the prize and the moved seed.
 */
export function showResult(s: State, h: Horse, faults: number, rider: string) {
  const S = DATA.shows, J = DATA.jumping, rows: ShowRow[] = [];
  let seed = s.seed, r: number;
  const pool = S.rivals.filter(([name]) => name !== rider); // no rival with the player's own name
  for (let i = 0; i < S.rivalsPerShow; i++) {
    [r, seed] = roll(seed);
    const [name, horse] = pool.splice(Math.floor(r * pool.length), 1)[0];
    [r, seed] = roll(seed);
    const skill = S.rivalSkill[0] + r * (S.rivalSkill[1] - S.rivalSkill[0]);
    let down = 0;
    for (let j = 0; j < J.jumps; j++) { [r, seed] = roll(seed); if (r < S.rivalFaultChance * (1 - skill / 100)) down++; }
    rows.push({ rider: name, horse, score: showScore(down, skill) });
  }
  const you: ShowRow = { rider, horse: h.name, score: showScore(faults, h.skills.jumping), you: true };
  const table = [you, ...rows].sort((a, b) => b.score - a.score || (a.you ? -1 : b.you ? 1 : 0));
  const rank = table.indexOf(you) + 1;
  return { table, rank, prize: S.prizes[rank - 1] ?? 0, seed };
}

/** The quiz's score: in the quiz data the right answer of each question comes first (index 0). */
export const quizScore = (answers: number[]) => answers.filter((a) => a === 0).length;
const isAnswers = (a: unknown) => Array.isArray(a) && a.length === DATA.badge.questions && a.every((x) => Number.isInteger(x) && x >= 0 && x < DATA.badge.answers);

/** How a pupil and a horse fit: a small child belongs on a pony, a big one on a horse. */
export function fit(p: Pupil, h: Horse): keyof typeof DATA.lessons.fit {
  const pony = h.look.build === 'pony';
  return p.size === 'small' ? (pony ? 'right' : 'smallOnHorse') : pony ? 'bigOnPony' : 'right';
}

/** What a lesson would bring: how happy the pupil is (0–100) and the pay. A well kept, fitting horse makes it best. */
export function lessonOutcome(p: Pupil, h: Horse) {
  const L = DATA.lessons, kept = (h.needs.fed + h.needs.clean + h.needs.happy) / 300;
  const happy = Math.round(100 * L.fit[fit(p, h)] * (0.5 + 0.5 * kept));
  return { happy, pay: Math.round(L.pay[p.level] * (0.6 + 0.4 * (happy / 100))) };
}

/** How a pupil felt about a lesson: below `happyAt` the farm's reputation drops. */
export const mood = (happy: number) => happy >= DATA.lessons.delightedAt ? 'delighted' : happy >= DATA.lessons.happyAt ? 'happy' : 'unhappy';

/** Money earned (lessons, prizes): part of it pays back debt first. Used by the actions that earn. */
export function earn(s: State, amount: number): State {
  const repay = Math.min(s.debt, Math.round(amount * DATA.repayShare));
  const today: Entry[] = repay ? [...s.today, { what: 'repay', amount: -repay }] : s.today;
  return { ...s, money: s.money + amount - repay, debt: s.debt - repay, today };
}
export const stalls = (s: State) => DATA.stalls[s.stage];
export const canBuild = (s: State) => s.stage === DATA.freePlotsFrom;

/** One night for one horse: it eats from the hay store if there is any, gets hungry, dirty and rested, and its
 *  health follows how well it is kept. */
function night(h: Horse, hay: boolean): Horse {
  const N = DATA.needs, loss = { ...N.nightlyLoss } as Record<Need, number>;
  if (!hay) { loss.fed += N.hungryNight.fed; loss.happy += N.hungryNight.happy; }
  const needs = Object.fromEntries(NEEDS.map((n) => [n, clamp(h.needs[n] - loss[n])])) as Needs;
  const neglected = (['fed', 'clean'] as const).filter((n) => needs[n] < N.neglectBelow).length;
  needs.health = clamp(h.needs.health + (neglected ? -neglected * N.healthLossPerNeglect : N.healthGain));
  return { ...h, needs, rest: Math.max(0, h.rest - 1), cared: [] };
}

/** Applies one action; never changes the state it was given. */
export type GoalId = (typeof DATA.goals.kleinerHof)[number]['id'];
export type Feature = (typeof DATA.features)[number];

/** How far each goal of the farm stage has come; a goal once reached stays done. */
export function goals(s: State) {
  const have = { groom: s.careDone.groom, lessons: s.lessonsGiven, badge: s.badges, savings: s.debt ? 0 : s.money, reputation: s.reputation };
  return DATA.goals[s.stage].map(({ id, need }) => {
    const done = s.goalsDone.includes(id) || have[id] >= need;
    return { id, need, have: done ? need : Math.max(0, have[id]), done };
  });
}
export const allGoalsDone = (s: State) => goals(s).every((g) => g.done);

/**
 * Oma Hanne's hint for now, if any, the most urgent first: a sick horse, a hungry one, a dirty one, hay running out.
 * One at a time, so the child is not flooded.
 */
export function hint(s: State): { kind: 'sick' | 'hungry' | 'dirty'; horse: string } | { kind: 'hay' } | null {
  const below = DATA.hints.needBelow;
  for (const [kind, test] of [['sick', isSick], ['hungry', (h: Horse) => h.needs.fed < below], ['dirty', (h: Horse) => h.needs.clean < below]] as const) {
    const h = s.horses.find(test);
    if (h) return { kind, horse: h.id };
  }
  return s.feed < s.horses.length * DATA.hints.hayNights ? { kind: 'hay' } : null;
}

/** Applies an action; afterwards every goal just reached is noted as done. */
export function apply(state: State, action: Action): State {
  const next = step(state, action);
  if (next === state) return state;
  const reached = goals(next).filter((g) => g.done && !next.goalsDone.includes(g.id)).map((g) => g.id);
  return reached.length ? { ...next, goalsDone: [...next.goalsDone, ...reached] } : next;
}

function step(state: State, action: Action): State {
  switch (action.type) {
    case 'explained':
      return state.explained.includes(action.what) || !DATA.features.includes(action.what) ? state : { ...state, explained: [...state.explained, action.what] };
    case 'sleep': {
      // horses eat from the store in turn; whoever finds it empty goes hungry
      let feed = state.feed;
      const news: News[] = [];
      const horses = state.horses.map((h) => {
        const hay = feed >= DATA.hayPerNight;
        if (hay) feed -= DATA.hayPerNight;
        const after = night(h, hay);
        if (!hay) news.push({ kind: 'noHay', horse: h.id });
        if (isSick(after) && !isSick(h)) news.push({ kind: 'sick', horse: h.id });
        if (h.rest === 1 && !isSick(after)) news.push({ kind: 'rested', horse: h.id });
        return after;
      });
      if (feed > 0 && feed < horses.length * DATA.hayPerNight * DATA.hayLowNights) news.push({ kind: 'hayLow' });
      if (state.today.length) news.push({ kind: 'bill' });
      const [pupils, seed] = pupilsFor(state.day + 1, state.reputation, state.seed);
      return { ...state, day: state.day + 1, feed, horses, night: news, bill: state.today, today: [], pupils, seed };
    }
    case 'care': {
      const h = state.horses.find((x) => x.id === action.horse);
      // each care action once per horse and day, so care can't be repeated to heal for free or to empty the hay store
      if (!h || h.cared.includes(action.what) || (action.what === 'feed' && !canFeed(state)) || (action.quick && !canQuickCare(state, action.what))) return state;
      const gain = DATA.care[action.what] as Partial<Needs>;
      const needs = { ...h.needs };
      for (const [n, v] of Object.entries(gain) as [Need, number][]) needs[n] = clamp(needs[n] + v);
      return {
        ...state,
        feed: state.feed - (action.what === 'feed' ? 1 : 0),
        horses: state.horses.map((x) => (x === h ? { ...h, needs, cared: [...h.cared, action.what] } : x)),
        careDone: action.quick ? state.careDone : { ...state.careDone, [action.what]: state.careDone[action.what] + 1 },
      };
    }
    case 'vet': {
      const h = state.horses.find((x) => x.id === action.horse);
      if (!h || !isSick(h) || !canPayVet(state)) return state;
      const healed = { ...h, needs: { ...h.needs, health: Math.max(h.needs.health, DATA.vet.health) }, rest: DATA.vet.restDays };
      return { ...state, money: state.money - DATA.vet.cost, horses: state.horses.map((x) => (x === h ? healed : x)),
        today: [...state.today, { what: 'vet', amount: -DATA.vet.cost }] };
    }
    case 'buyHay': {
      const p = DATA.hayPacks[action.pack];
      if (!p) return state;
      const credit = hayOnCredit(state, action.pack);
      return {
        ...state, feed: state.feed + p.bales,
        money: credit ? state.money : state.money - p.price, debt: credit ? state.debt + p.price : state.debt,
        today: [...state.today, { what: credit ? 'hayOnCredit' : 'hay', amount: -p.price }],
      };
    }
    case 'train': {
      // a jumping round as training: skill grows (more for a clear round), the horse gets tired and enjoys it
      const h = state.horses.find((x) => x.id === action.horse), J = DATA.jumping;
      if (!h || cantWork(h, J.energy) || !Number.isInteger(action.faults) || action.faults < 0) return state;
      const trained: Horse = {
        ...h, skills: { ...h.skills, jumping: clamp(h.skills.jumping + (action.faults ? J.gain.faults : J.gain.clear)) },
        needs: { ...h.needs, energy: clamp(h.needs.energy - J.energy), happy: clamp(h.needs.happy + J.happy) },
      };
      return { ...state, trainings: state.trainings + 1, horses: state.horses.map((x) => (x === h ? trained : x)) };
    }
    case 'show': {
      // the entry fee, the round (the horse tires like practice), the prize for the first three; one show a day
      const h = state.horses.find((x) => x.id === action.horse), S = DATA.shows;
      if (!h || showWaits(state) || cantWork(h, DATA.jumping.energy) || !Number.isInteger(action.faults) || action.faults < 0) return state;
      const { prize, seed } = showResult(state, h, action.faults, state.avatar.name);
      const ridden = { ...h, needs: { ...h.needs, energy: clamp(h.needs.energy - DATA.jumping.energy) } };
      const paid: State = { ...state, seed, lastShowDay: state.day, money: state.money - S.fee, horses: state.horses.map((x) => (x === h ? ridden : x)),
        today: [...state.today, { what: 'showFee', amount: -S.fee }, ...(prize ? [{ what: 'prize' as const, amount: prize }] : [])] };
      return prize ? earn(paid, prize) : paid;
    }
    case 'badgeQuiz': {
      // the quiz first: too few right answers fail the badge for today; enough lead on to the jumping round
      if (badgeWaits(state) || state.badgeQuizDay === state.day || !isAnswers(action.answers)) return state;
      return quizScore(action.answers) >= DATA.badge.quizPass ? { ...state, badgeQuizDay: state.day } : { ...state, badgeFailedDay: state.day };
    }
    case 'badge': {
      // the badge's jumping round, after today's passed quiz, tires the horse like practice; few poles down pass it
      const h = state.horses.find((x) => x.id === action.horse), J = DATA.jumping;
      if (!h || badgeWaits(state) || state.badgeQuizDay !== state.day || cantWork(h, J.energy) || !Number.isInteger(action.faults) || action.faults < 0) return state;
      const ridden = { ...h, needs: { ...h.needs, energy: clamp(h.needs.energy - J.energy) } };
      const passed = action.faults <= DATA.badge.maxFaults;
      return { ...state, horses: state.horses.map((x) => (x === h ? ridden : x)), badgeQuizDay: 0, badges: passed ? 1 : state.badges, badgeFailedDay: passed ? 0 : state.day };
    }
    case 'lesson': {
      const p = state.pupils.find((x) => x.id === action.pupil), h = state.horses.find((x) => x.id === action.horse);
      if (!p || !h || cantWork(h, DATA.lessons.energy)) return state;
      const { happy, pay } = lessonOutcome(p, h);
      const worked = { ...h, needs: { ...h.needs, energy: clamp(h.needs.energy - DATA.lessons.energy) } };
      const after = earn({ ...state, today: [...state.today, { what: 'lesson', amount: pay }] }, pay);
      return {
        ...after, horses: state.horses.map((x) => (x === h ? worked : x)), pupils: state.pupils.filter((x) => x !== p),
        reputation: clamp(state.reputation + (happy - DATA.lessons.happyAt) / 5), lessonsGiven: state.lessonsGiven + 1,
      };
    }
    case 'loan': {
      if (!canLoan(state)) return state;
      const a = DATA.loan.amount;
      return { ...state, money: state.money + a, debt: state.debt + a, today: [...state.today, { what: 'loan', amount: a }] };
    }
  }
}
