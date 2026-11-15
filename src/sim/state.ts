/**
 * The Sim: the game rules as a pure module (ADR-0001). State in, action in, new state out; no pixels, no DOM.
 * Randomness will come from the seed kept in the state, so the same game plays the same way.
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
};

export type FarmStage = 'kleinerHof' | 'reitschule';

export type State = {
  version: 3;
  seed: number; // the game's random seed (the first rule with chance adds a generator that uses it)
  day: number;
  money: number;
  feed: number; // hay bales in store
  stage: FarmStage;
  horses: Horse[];
  /** What happened last night, for the morning summary. */
  night: News[];
  /** How often each care action was done by hand (quick care unlocks after a few). */
  careDone: Record<Care, number>;
};

export type Care = 'groom' | 'hooves' | 'feed' | 'muck';
export const CARE: Care[] = ['groom', 'hooves', 'feed', 'muck'];

/** Morning news: data only; the screens turn it into words. */
export type News = { kind: 'sick' | 'noHay' | 'hayLow' | 'rested'; horse?: string };

export type Action = { type: 'sleep' } | { type: 'vet'; horse: string } | { type: 'care'; horse: string; what: Care; quick?: boolean };

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** A new game on Oma Hanne's small farm: two ponies of different breeds and coats. */
export function newGame(seed: number): State {
  const horse = (id: string, name: string, breed: Breed, look: Look): Horse =>
    ({ id, name, breed, look, needs: { ...DATA.needs.start }, skills: { jumping: 10 }, rest: 0 });
  return {
    version: 3, seed, day: 1, money: DATA.start.money, feed: DATA.start.feed, stage: 'kleinerHof', night: [],
    careDone: { groom: 0, hooves: 0, feed: 0, muck: 0 },
    horses: [
      horse('kiwi', 'Kiwi', 'haflinger', breedLook('haflinger')),
      horse('luna', 'Luna', 'islaender', breedLook('islaender', 'rappe', { face: 'stern' })),
    ],
  };
}

export const isSick = (h: Horse) => h.needs.health < DATA.needs.sickBelow;
/** A sick or resting horse can't be ridden or used for lessons. */
export const canWork = (h: Horse) => !isSick(h) && h.rest === 0;
export const canPayVet = (s: State) => s.money >= DATA.vet.cost;
export const canQuickCare = (s: State, what: Care) => s.careDone[what] >= DATA.quickCareAfter;
export const canFeed = (s: State) => s.feed >= 1;
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
  return { ...h, needs, rest: Math.max(0, h.rest - 1) };
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
      return { ...state, day: state.day + 1, feed, horses, night: news };
    }
    case 'care': {
      const h = state.horses.find((x) => x.id === action.horse);
      if (!h || (action.what === 'feed' && !canFeed(state)) || (action.quick && !canQuickCare(state, action.what))) return state;
      const gain = DATA.care[action.what] as Partial<Needs>;
      const needs = { ...h.needs };
      for (const [n, v] of Object.entries(gain) as [Need, number][]) needs[n] = clamp(needs[n] + v);
      return {
        ...state,
        feed: state.feed - (action.what === 'feed' ? 1 : 0),
        horses: state.horses.map((x) => (x === h ? { ...h, needs } : x)),
        careDone: action.quick ? state.careDone : { ...state.careDone, [action.what]: state.careDone[action.what] + 1 },
      };
    }
    case 'vet': {
      const h = state.horses.find((x) => x.id === action.horse);
      if (!h || !isSick(h) || !canPayVet(state)) return state;
      const healed = { ...h, needs: { ...h.needs, health: Math.max(h.needs.health, DATA.vet.health) }, rest: DATA.vet.restDays };
      return { ...state, money: state.money - DATA.vet.cost, horses: state.horses.map((x) => (x === h ? healed : x)) };
    }
  }
}
