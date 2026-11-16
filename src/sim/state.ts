/**
 * The Sim: the game rules as a pure module (ADR-0001). State in, action in, new state out; no pixels, no DOM.
 * Randomness comes from the seed kept in the state, so the same game plays the same way.
 */
import type { Breed, Look } from '../horses/look';
import { BREEDS, breedLook, type Coat, type Face, FACES } from '../horses/look';
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
  version: 10;
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
  /** Goals of the current stage reached (they stay reached; a new stage starts afresh), and the features Oma Hanne has explained. */
  goalsDone: GoalId[];
  explained: Feature[];
  /** The farm inspection: the day it last failed (0: never). The Reitschule's market and what has been built. */
  inspectionFailedDay: number;
  /** Lessons given before this farm stage began: a stage's lesson goal counts from its start. */
  lessonsBefore: number;
  market: Offer[];
  built: { stalls: number; arena: number };
  badgeQuizDay: number;
  /** Money in and out today, for tomorrow morning's bill; `bill` is yesterday's. */
  today: Entry[];
  bill: Entry[];
};

/** One line of the bill: what for, and the amount (+ in, − out). */
export type Entry = { what: 'hay' | 'hayOnCredit' | 'vet' | 'loan' | 'repay' | 'lesson' | 'showFee' | 'prize' | 'horse' | 'build'; amount: number };

/** A horse for sale at the Reitschule's market. */
export type Offer = { id: string; name: string; breed: Breed; look: Look; price: number };

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
  | { type: 'show'; horse: string; faults: number; showClass: ShowClass }
  | { type: 'explained'; what: Feature } | { type: 'rename'; horse: string; name: string }
  | { type: 'inspection'; answers: number[] } | { type: 'buyHorse'; offer: string } | { type: 'build'; what: 'stalls' | 'arena' };

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** The game's random generator (mulberry32): a value in [0, 1) and the next seed. */
export function roll(seed: number): [value: number, next: number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** This morning's pupils: one, plus more the better the farm's reputation. */
export function pupilsFor(day: number, reputation: number, seed: number, more = 0): [Pupil[], number] {
  const n = 1 + more + DATA.lessons.morePupilsAt.filter((r) => reputation >= r).length, pupils: Pupil[] = [];
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

/** A horse as it arrives: needs as new, a little jumping skill. */
const horse = (id: string, name: string, breed: Breed, look: Look): Horse =>
  ({ id, name, breed, look, needs: { ...DATA.needs.start }, skills: { jumping: 10 }, rest: 0, cared: [] });

/** This morning's horses for sale: breed, coat, a marking now and then, a price in the build's range. */
export function marketFor(day: number, seed: number, taken: string[] = []): [Offer[], number] {
  const M = DATA.market, offers: Offer[] = [];
  let r: number;
  for (let i = 0; i < M.offers; i++) {
    [r, seed] = roll(seed); const breed = M.breeds[Math.floor(r * M.breeds.length)] as Breed, b = BREEDS[breed];
    [r, seed] = roll(seed); const coat = b.coats[Math.floor(r * b.coats.length)] as Coat;
    [r, seed] = roll(seed); const face = r < 0.5 ? (Object.keys(FACES) as Face[])[Math.floor(r * 8)] : undefined;
    const free = M.names.filter((n) => !taken.some((x) => x.toLowerCase() === n.toLowerCase()) && !offers.some((o) => o.name === n)); // no two horses called the same
    [r, seed] = roll(seed); const name = free[Math.floor(r * free.length)] ?? M.names[i];
    [r, seed] = roll(seed); const [lo, hi] = M.price[b.build];
    offers.push({ id: `m${day}-${i}`, name, breed, look: breedLook(breed, coat, face ? { face } : {}), price: Math.round((lo + r * (hi - lo)) / 10) * 10 });
  }
  return [offers, seed];
}

/** The farm inspection can come once every goal of the Kleiner Hof is met (not again on the day it failed). */
export const canInspect = (s: State) => s.stage === 'kleinerHof' && allGoalsDone(s) && s.inspectionFailedDay !== s.day;
const isQuiz = (a: unknown, q: { questions: number; answers: number }) =>
  Array.isArray(a) && a.length === q.questions && a.every((x) => Number.isInteger(x) && x >= 0 && x < q.answers);
/** Why a building can't be built now: not yet a Reitschule, built already, or too little money. */
export function buildWaits(s: State, what: 'stalls' | 'arena'): 'stage' | 'built' | 'money' | null {
  return s.stage !== 'reitschule' ? 'stage' : s.built[what] >= 1 ? 'built' : s.money < DATA.build[what].cost ? 'money' : null;
}

/** A new game on Oma Hanne's small farm: two ponies of different breeds and coats. */
export function newGame(seed: number, avatar: Avatar = DATA.avatar): State {
  const [pupils, next] = pupilsFor(1, DATA.lessons.startReputation, seed);
  return {
    version: 10, inspectionFailedDay: 0, lessonsBefore: 0, market: [], built: { stalls: 0, arena: 0 }, avatar, trainings: 0, badges: 0, badgeFailedDay: 0, badgeQuizDay: 0, lastShowDay: 0, goalsDone: [], explained: [], seed: next, day: 1, money: DATA.start.money, feed: DATA.start.feed, stage: 'kleinerHof', night: [],
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
  return s.badges < 1 ? 'badge' : nextShowDay(s) !== s.day ? 'notToday' : s.money < DATA.shows.classes.E.fee ? 'money' : null;
}
export type ShowClass = keyof typeof DATA.shows.classes;
export const SHOW_CLASSES = Object.keys(DATA.shows.classes) as ShowClass[];
/** Why horse `h` can't start in class `c` today: not skilled enough, or the entry fee is too much; null if it can. */
export const classWaits = (s: State, h: Horse, c: ShowClass): 'skill' | 'money' | null =>
  h.skills.jumping < DATA.shows.classes[c].minSkill ? 'skill' : s.money < DATA.shows.classes[c].fee ? 'money' : null;
/**
 * Why class `c` is shut today for every horse, the nearest reason first (the fee, then a skilled horse that can't
 * work today, then no horse skilled enough); null if some horse can start there.
 */
export function classShut(s: State, c: ShowClass): 'money' | 'tired' | 'skill' | null {
  const w = s.horses.map((h) => classWaits(s, h, c) ?? (cantWork(h, DATA.jumping.energy) ? 'tired' : null));
  return w.includes(null) ? null : (['money', 'tired', 'skill'] as const).find((r) => w.includes(r)) ?? 'skill';
}
const showScore = (faults: number, skill: number) => 100 - DATA.shows.faultPoints * faults + Math.round(skill * DATA.shows.skillPoints);

export type ShowRow = { rider: string; horse: string; score: number; you?: true };
/**
 * A show's results for the player's round with horse `h`: the rivals ride with chance from the game's seed. The table
 * is best first; the player wins a tie. Returns the rank (1 = first), the prize and the moved seed.
 */
export function showResult(s: State, h: Horse, faults: number, rider: string, c: ShowClass) {
  const S = DATA.shows, C = S.classes[c], J = DATA.jumping, rows: ShowRow[] = [];
  let seed = s.seed, r: number;
  const pool = S.rivals.filter(([name, horse]) => name !== rider && horse.toLowerCase() !== h.name.toLowerCase()); // no rival with the player's or the horse's name
  for (let i = 0; i < S.rivalsPerShow; i++) {
    [r, seed] = roll(seed);
    const [name, horse] = pool.splice(Math.floor(r * pool.length), 1)[0];
    [r, seed] = roll(seed);
    const skill = C.rivalSkill[0] + r * (C.rivalSkill[1] - C.rivalSkill[0]);
    let down = 0;
    for (let j = 0; j < J.jumps; j++) { [r, seed] = roll(seed); if (r < S.rivalFaultChance * (1 - skill / 100)) down++; }
    rows.push({ rider: name, horse, score: showScore(down, skill) });
  }
  const you: ShowRow = { rider, horse: h.name, score: showScore(faults, h.skills.jumping), you: true };
  const table = [you, ...rows].sort((a, b) => b.score - a.score || (a.you ? -1 : b.you ? 1 : 0));
  const rank = table.indexOf(you) + 1;
  return { table, rank, prize: C.prizes[rank - 1] ?? 0, seed };
}

/** The quiz's score: in the quiz data the right answer of each question comes first (index 0). */
export const quizScore = (answers: number[]) => answers.filter((a) => a === 0).length;

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
export const stalls = (s: State) => DATA.stalls[s.stage] + s.built.stalls * DATA.build.stalls.places;
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

export type GoalId = (typeof DATA.goals.kleinerHof)[number]['id'];
export type Feature = (typeof DATA.features)[number];

/** How far each goal of the farm stage has come; a goal once reached stays done. */
export function goals(s: State) {
  const have = { groom: s.careDone.groom, lessons: s.lessonsGiven - s.lessonsBefore, badge: s.badges, savings: s.debt ? 0 : s.money, reputation: s.reputation, horses: s.horses.length };
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
  const below = DATA.hints.needBelow, sick = s.horses.find(isSick);
  if (sick) return { kind: 'sick', horse: sick.id };
  if (s.feed < 1) return { kind: 'hay' }; // with no hay, "feed the hungry pony" can't be done: buying hay comes first
  for (const [kind, test] of [['hungry', (h: Horse) => h.needs.fed < below], ['dirty', (h: Horse) => h.needs.clean < below]] as const) {
    const h = s.horses.find(test);
    if (h) return { kind, horse: h.id };
  }
  return s.feed < s.horses.length * DATA.hints.hayNights ? { kind: 'hay' } : null;
}

/** Applies one action (never changing the state it was given); afterwards every goal just reached is noted as done. */
export function apply(state: State, action: Action): State {
  const next = step(state, action);
  if (next === state) return state;
  const reached = goals(next).filter((g) => g.done && !next.goalsDone.includes(g.id)).map((g) => g.id);
  return reached.length ? { ...next, goalsDone: [...next.goalsDone, ...reached] } : next;
}

function step(state: State, action: Action): State {
  switch (action.type) {
    case 'inspection': {
      // the quiz with the inspector: enough right answers make the farm a Reitschule with its first market; else tomorrow
      const I = DATA.inspection;
      if (!canInspect(state) || !isQuiz(action.answers, I)) return state;
      if (quizScore(action.answers) < I.pass) return { ...state, inspectionFailedDay: state.day };
      const [market, seed] = marketFor(state.day, state.seed, state.horses.map((h) => h.name));
      // the new stage starts its own goal list (counts like lessons given go on from where they are)
      return { ...state, stage: 'reitschule', market, seed, goalsDone: [], lessonsBefore: state.lessonsGiven };
    }
    case 'buyHorse': {
      const o = state.market.find((x) => x.id === action.offer);
      if (!o || state.money < o.price || state.horses.length >= stalls(state) || state.horses.some((h) => h.id === o.id)) return state;
      return { ...state, money: state.money - o.price, market: state.market.filter((x) => x !== o),
        horses: [...state.horses, horse(o.id, o.name, o.breed, o.look)], today: [...state.today, { what: 'horse', amount: -o.price }] };
    }
    case 'build': {
      if (buildWaits(state, action.what)) return state;
      const cost = DATA.build[action.what].cost;
      return { ...state, money: state.money - cost, built: { ...state.built, [action.what]: state.built[action.what] + 1 }, today: [...state.today, { what: 'build', amount: -cost }] };
    }
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
      const [pupils, seed1] = pupilsFor(state.day + 1, state.reputation, state.seed, state.built.arena * DATA.build.arena.pupils);
      const [market, seed] = state.stage === 'reitschule' ? marketFor(state.day + 1, seed1, horses.map((h) => h.name)) : [state.market, seed1];
      return { ...state, day: state.day + 1, feed, horses, night: news, bill: state.today, today: [], pupils, market, seed };
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
    case 'rename': {
      // a name of its own: trimmed, not empty, not too long for a nameplate, not the name of another horse on the farm
      // or at the market (buying it would make two)
      const name = typeof action.name === 'string' ? action.name.trim() : '', h = state.horses.find((x) => x.id === action.horse);
      const same = (n: string) => n.toLowerCase() === name.toLowerCase();
      if (!h || !name || name.length > DATA.horseName.max || state.horses.some((x) => x !== h && same(x.name)) || state.market.some((o) => same(o.name))) return state;
      return { ...state, horses: state.horses.map((x) => (x === h ? { ...x, name } : x)) };
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
      const h = state.horses.find((x) => x.id === action.horse), c = action.showClass;
      if (!h || !SHOW_CLASSES.includes(c) || showWaits(state) || classWaits(state, h, c) || cantWork(h, DATA.jumping.energy)
        || !Number.isInteger(action.faults) || action.faults < 0) return state;
      const fee = DATA.shows.classes[c].fee, { prize, seed } = showResult(state, h, action.faults, state.avatar.name, c);
      const ridden = { ...h, needs: { ...h.needs, energy: clamp(h.needs.energy - DATA.jumping.energy) } };
      const paid: State = { ...state, seed, lastShowDay: state.day, money: state.money - fee, horses: state.horses.map((x) => (x === h ? ridden : x)),
        today: [...state.today, { what: 'showFee', amount: -fee }, ...(prize ? [{ what: 'prize' as const, amount: prize }] : [])] };
      return prize ? earn(paid, prize) : paid;
    }
    case 'badgeQuiz': {
      // the quiz first: too few right answers fail the badge for today; enough lead on to the jumping round
      if (badgeWaits(state) || state.badgeQuizDay === state.day || !isQuiz(action.answers, DATA.badge)) return state;
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
