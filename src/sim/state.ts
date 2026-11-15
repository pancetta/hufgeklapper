/**
 * The Sim: the game rules as a pure module (ADR-0001). State in, action in, new state out; no pixels, no DOM.
 * Randomness comes from the seed kept in the state, so the same game plays the same way.
 */
import type { Breed, Look } from '../horses/look';
import { breedLook } from '../horses/look';
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
  version: 5;
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
  /** Money in and out today, for tomorrow morning's bill; `bill` is yesterday's. */
  today: Entry[];
  bill: Entry[];
};

/** One line of the bill: what for, and the amount (+ in, − out). */
export type Entry = { what: 'hay' | 'hayOnCredit' | 'vet' | 'loan' | 'repay' | 'lesson'; amount: number };

/** A pupil ("Reitschüler"): a small or big child, a beginner or advanced rider. */
export type Pupil = { id: string; name: string; size: 'small' | 'big'; level: 'beginner' | 'advanced'; look: number };

export type Care = 'groom' | 'hooves' | 'feed' | 'muck';
export const CARE: Care[] = ['groom', 'hooves', 'feed', 'muck'];

/** Morning news: data only; the screens turn it into words. */
export type News = { kind: 'sick' | 'noHay' | 'hayLow' | 'rested' | 'bill'; horse?: string };

export type Action = { type: 'sleep' } | { type: 'vet'; horse: string } | { type: 'care'; horse: string; what: Care; quick?: boolean }
  | { type: 'buyHay'; pack: number } | { type: 'loan' } | { type: 'lesson'; pupil: string; horse: string };

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
export function newGame(seed: number): State {
  const horse = (id: string, name: string, breed: Breed, look: Look): Horse =>
    ({ id, name, breed, look, needs: { ...DATA.needs.start }, skills: { jumping: 10 }, rest: 0, cared: [] });
  const [pupils, next] = pupilsFor(1, DATA.lessons.startReputation, seed);
  return {
    version: 5, seed: next, day: 1, money: DATA.start.money, feed: DATA.start.feed, stage: 'kleinerHof', night: [],
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

/** Why a horse can't give a lesson now (sick, resting after the vet, too tired), or null if it can. */
export function cantTeach(h: Horse): 'sick' | 'resting' | 'tired' | null {
  return isSick(h) ? 'sick' : h.rest ? 'resting' : h.needs.energy < DATA.lessons.energy ? 'tired' : null;
}

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
export function apply(state: State, action: Action): State {
  switch (action.type) {
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
    case 'lesson': {
      const p = state.pupils.find((x) => x.id === action.pupil), h = state.horses.find((x) => x.id === action.horse);
      if (!p || !h || cantTeach(h)) return state;
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
