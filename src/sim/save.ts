/**
 * A save file: what one slot stores and what export/import moves. A file from outside is checked field by field
 * before it can replace anything; an unreadable or newer file is reported, never used.
 */
import { BREEDS, COATS, FACES, LEGS, type Look, MANES } from '../horses/look';
import { DATA } from './data';
import { CARE, type Horse, NEEDS, type News, type State } from './state';

// every kind of morning news; typed, so a new kind can't be forgotten here (that would make saves unreadable)
const NEWS: Record<News['kind'], 1> = { sick: 1, noHay: 1, hayLow: 1, rested: 1 };

/** Bump when State changes shape, and add the step from the old shape to parseSave. */
export const SAVE_VERSION = 3;
export type SaveFile = { app: 'hufgeklapper'; version: number; name: string; savedAt: string; state: State };
export type Parsed = { ok: true; save: SaveFile } | { ok: false; reason: 'invalid' | 'newer' };

export function toSave(state: State, name: string, now = new Date()): SaveFile {
  return { app: 'hufgeklapper', version: SAVE_VERSION, name, savedAt: now.toISOString(), state };
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const isInt = (x: unknown, min = -Infinity, max = Infinity) => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
const isText = (x: unknown, max: number) => typeof x === 'string' && x.length > 0 && x.length <= max;
const oneOf = (x: unknown, options: object) => typeof x === 'string' && Object.hasOwn(options, x);

function isLook(x: unknown): x is Look {
  return isObj(x) && (x.build === 'horse' || x.build === 'pony') && oneOf(x.coat, COATS)
    && (x.mane === undefined || oneOf(x.mane, MANES)) && (x.face === undefined || oneOf(x.face, FACES))
    && (x.legs === undefined || oneOf(x.legs, LEGS)) && (x.saddle === undefined || typeof x.saddle === 'boolean')
    && (x.blanket === undefined || (typeof x.blanket === 'string' && /^#[0-9a-f]{6}$/i.test(x.blanket)));
}

function isHorse(x: unknown): x is Horse {
  // ids end up in HTML attributes, so only plain characters
  return isObj(x) && typeof x.id === 'string' && /^[a-z0-9-]{1,40}$/.test(x.id) && isText(x.name, 30) && oneOf(x.breed, BREEDS) && isLook(x.look)
    && isObj(x.needs) && NEEDS.every((n) => isInt((x.needs as Obj)[n], 0, 100))
    && isObj(x.skills) && isInt(x.skills.jumping, 0, 100) && isInt(x.rest, 0, 30);
}

function isState(x: unknown): x is State {
  return isObj(x) && x.version === 3 && Number.isFinite(x.seed) && isInt(x.day, 1) && isInt(x.money)
    && isInt(x.feed, 0) && oneOf(x.stage, DATA.stalls) && Array.isArray(x.horses) && x.horses.every(isHorse)
    && Array.isArray(x.night) && x.night.every((n) => isObj(n) && oneOf(n.kind, NEWS) && (n.horse === undefined || isText(n.horse, 40)))
    && isObj(x.careDone) && CARE.every((c) => isInt((x.careDone as Obj)[c], 0));
}

/** Version 1 (before the day cycle): horses had no rest days and there was no morning news. */
function fromVersion1(x: Obj): unknown {
  const s = x.state;
  if (!isObj(s) || !Array.isArray(s.horses)) return x;
  return { ...x, version: 2, state: { ...s, version: 2, night: [], horses: s.horses.map((h) => (isObj(h) ? { ...h, rest: 0 } : h)) } };
}

/** Version 2 (before care): nothing counted how often each care action was done. */
function fromVersion2(x: Obj): unknown {
  const s = x.state;
  if (!isObj(s)) return x;
  return { ...x, version: 3, state: { ...s, version: 3, careDone: { groom: 0, hooves: 0, feed: 0, muck: 0 } } };
}

/** Reads a save file's text: the save if it is a valid Hufgeklapper save, else why not. */
export function parseSave(text: string): Parsed {
  let x: unknown;
  try { x = JSON.parse(text); } catch { return { ok: false, reason: 'invalid' }; }
  if (!isObj(x) || x.app !== 'hufgeklapper' || !isInt(x.version, 1)) return { ok: false, reason: 'invalid' };
  if ((x.version as number) > SAVE_VERSION) return { ok: false, reason: 'newer' };
  if (x.version === 1) x = fromVersion1(x);
  if (isObj(x) && x.version === 2) x = fromVersion2(x);
  if (!isObj(x) || !isText(x.name, 30) || typeof x.savedAt !== 'string' || !isState(x.state)) return { ok: false, reason: 'invalid' };
  return { ok: true, save: x as SaveFile };
}
