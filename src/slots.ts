/** The three save slots, kept in the browser's local storage. */
import { parseSave, type SaveFile } from './sim/save';

export const SLOTS = 3;
const key = (slot: number) => `hufgeklapper.slot.${slot}`;

export type Slot = { kind: 'empty' } | { kind: 'save'; save: SaveFile } | { kind: 'broken'; reason: 'invalid' | 'newer' };

export function readSlot(slot: number): Slot {
  let text: string | null = null;
  try { text = localStorage.getItem(key(slot)); } catch { /* storage blocked: treat as empty */ }
  if (text === null) return { kind: 'empty' };
  const p = parseSave(text);
  return p.ok ? { kind: 'save', save: p.save } : { kind: 'broken', reason: p.reason };
}

/** Writes a slot; false if the browser refused (storage full or blocked). */
export function writeSlot(slot: number, save: SaveFile) {
  try { localStorage.setItem(key(slot), JSON.stringify(save)); return true; } catch { return false; }
}
