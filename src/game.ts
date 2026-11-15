/** The running game: the Sim state the screens show, the one way to change it, and the autosave to its slot. */
import { toSave } from './sim/save';
import { type Action, apply, newGame, type State } from './sim/state';
import { writeSlot } from './slots';

let state: State = newGame(1);
let slot = 0, name = '';
const listeners = new Set<() => void>();
let onSaveFailed = () => {};

function changed() {
  if (!writeSlot(slot, toSave(state, name))) onSaveFailed();
  listeners.forEach((f) => f());
}

export const game = {
  get: () => state,
  name: () => name,
  /** A fresh game in a slot; the seed makes it repeatable. */
  start(seed: number, inSlot: number, farmName: string) { state = newGame(seed); slot = inSlot; name = farmName; changed(); },
  /** Carries on a saved game. */
  resume(saved: State, inSlot: number, farmName: string) { state = saved; slot = inSlot; name = farmName; listeners.forEach((f) => f()); },
  dispatch(action: Action) { state = apply(state, action); changed(); },
  /** Calls `f` after every change; returns the unsubscribe. */
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
  /** What to do when the browser refuses to save. */
  onSaveFailed(f: () => void) { onSaveFailed = f; },
};
