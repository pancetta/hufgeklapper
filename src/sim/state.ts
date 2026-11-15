/**
 * The Sim: the game rules as a pure module (ADR-0001). State in, action in, new state out; no pixels, no DOM.
 * Randomness comes from a seed kept in the state, so the same game plays the same way.
 */
import type { Breed, Look } from '../horses/look';
import { breedLook } from '../horses/look';
import { DATA } from './data';

export type Need = 'fed' | 'clean' | 'happy' | 'energy' | 'health';
export const NEEDS: Need[] = ['fed', 'clean', 'happy', 'energy', 'health'];
export type Needs = Record<Need, number>;

export type Horse = { id: string; name: string; breed: Breed; look: Look; needs: Needs; skills: { jumping: number } };

export type FarmStage = 'kleinerHof' | 'reitschule';

export type State = {
  version: 1;
  seed: number; // the random generator's state
  day: number;
  money: number;
  feed: number; // hay bales in store
  stage: FarmStage;
  horses: Horse[];
};

export type Action = { type: 'sleep' };

/** The game's random generator (mulberry32): a value in [0, 1) and the next seed. */
export function roll(seed: number): [value: number, next: number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** A new game on Oma Hanne's small farm: two ponies of different breeds and coats. */
export function newGame(seed: number): State {
  const horse = (id: string, name: string, breed: Breed, look: Look): Horse =>
    ({ id, name, breed, look, needs: { ...DATA.needs.start }, skills: { jumping: 10 } });
  return {
    version: 1, seed, day: 1, money: DATA.start.money, feed: DATA.start.feed, stage: 'kleinerHof',
    horses: [
      horse('kiwi', 'Kiwi', 'haflinger', breedLook('haflinger')),
      horse('luna', 'Luna', 'islaender', breedLook('islaender', 'rappe', { face: 'stern' })),
    ],
  };
}

export const isSick = (h: Horse) => h.needs.health < DATA.needs.sickBelow;
export const stalls = (s: State) => DATA.stalls[s.stage];
export const canBuild = (s: State) => s.stage === DATA.freePlotsFrom;

/** Applies one action; never changes the state it was given. */
export function apply(state: State, action: Action): State {
  switch (action.type) {
    case 'sleep': {
      // overnight the horses get hungry and dirty and a little bored, but rested
      const loss = DATA.needs.nightlyLoss;
      const horses = state.horses.map((h) => ({
        ...h, needs: Object.fromEntries(NEEDS.map((n) => [n, clamp(h.needs[n] - loss[n])])) as Needs,
      }));
      return { ...state, day: state.day + 1, horses };
    }
  }
}
