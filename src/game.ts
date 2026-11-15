/** The running game: the Sim state the screens show, and the one way to change it. */
import { type Action, apply, newGame, type State } from './sim/state';

let state: State = newGame(1);
const listeners = new Set<() => void>();

export const game = {
  get: () => state,
  /** A fresh game; the seed makes it repeatable. */
  start(seed: number) { state = newGame(seed); listeners.forEach((f) => f()); },
  dispatch(action: Action) { state = apply(state, action); listeners.forEach((f) => f()); },
  /** Calls `f` after every change; returns the unsubscribe. */
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
};
