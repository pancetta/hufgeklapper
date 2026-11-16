/**
 * A save file: what one slot stores and what export/import moves. A file from outside is checked field by field
 * before it can replace anything; an unreadable or newer file is reported, never used.
 */
import { BREEDS, COATS, FACES, LEGS, type Look, MANES } from '../horses/look';
import { HAIR, HAIR_STYLES, type HairStyle, JACKET, SKIN } from '../riders/look';
import { DATA } from './data';
import { CARE, type Care, type Entry, type Horse, NEEDS, type News, pupilsFor, type State } from './state';

// every kind of morning news; typed, so a new kind can't be forgotten here (that would make saves unreadable)
const NEWS: Record<News['kind'], 1> = { sick: 1, noHay: 1, hayLow: 1, rested: 1, bill: 1, staffCared: 1, staffUnpaid: 1, boarderLeft: 1 };
const ENTRIES: Record<Entry['what'], 1> = { hay: 1, hayOnCredit: 1, vet: 1, loan: 1, repay: 1, lesson: 1, showFee: 1, prize: 1, horse: 1, build: 1, wage: 1, board: 1, partBoard: 1 };
const isPupil = (p: unknown) => isObj(p) && typeof p.id === 'string' && /^[a-z0-9-]{1,40}$/.test(p.id) && isText(p.name, 30)
  && (p.size === 'small' || p.size === 'big') && (p.level === 'beginner' || p.level === 'advanced') && isInt(p.look, 0, 999);

/** Bump when State changes shape, and add the step from the old shape to parseSave. */
export const SAVE_VERSION = 11;
export type SaveFile = { app: 'hufgeklapper'; version: number; name: string; savedAt: string; state: State };
export type Parsed = { ok: true; save: SaveFile } | { ok: false; reason: 'invalid' | 'newer' };

export function toSave(state: State, name: string, now = new Date()): SaveFile {
  return { app: 'hufgeklapper', version: SAVE_VERSION, name, savedAt: now.toISOString(), state };
}

type Obj = Record<string, unknown>;
const GOALS = new Set<string>(Object.values(DATA.goals).flat().map((g) => g.id));
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
    && isObj(x.skills) && isInt(x.skills.jumping, 0, 100) && isInt(x.rest, 0, 30)
    && Array.isArray(x.cared) && x.cared.length <= CARE.length && x.cared.every((c) => CARE.includes(c as Care))
    && (x.owner === undefined || (isObj(x.owner) && isText(x.owner.name, 30) && isInt(x.owner.pay, 0, 1000) && isInt(x.owner.unhappy, 0, 30)))
    && (x.rider === undefined || (isObj(x.rider) && isText(x.rider.name, 30) && isInt(x.rider.pay, 0, 1000)));
}
const isBoardOffer = (x: unknown) => isObj(x) && typeof x.id === 'string' && /^[a-z0-9-]{1,40}$/.test(x.id) && isText(x.owner, 30) && isText(x.name, 30)
  && oneOf(x.breed, BREEDS) && isLook(x.look) && isInt(x.pay, 0, 1000);

const isEntries = (x: unknown) => Array.isArray(x) && x.length < 100 && x.every((e) => isObj(e) && oneOf(e.what, ENTRIES) && isInt(e.amount));

function isAvatar(x: unknown) {
  return isObj(x) && isText(x.name, 20) && isInt(x.skin, 0, SKIN.length - 1) && HAIR_STYLES.includes(x.hair as HairStyle)
    && isInt(x.hairColor, 0, HAIR.length - 1) && isInt(x.jacket, 0, JACKET.length - 1);
}

function isOffer(x: unknown) {
  return isObj(x) && typeof x.id === 'string' && /^[a-z0-9-]{1,40}$/.test(x.id) && isText(x.name, 30) && oneOf(x.breed, BREEDS) && isLook(x.look) && isInt(x.price, 0);
}

function isState(x: unknown): x is State {
  return isObj(x) && x.version === 11 && isAvatar(x.avatar)
    && isInt(x.staff, 0, DATA.staff.max) && Array.isArray(x.boardOffers) && x.boardOffers.length <= 10 && x.boardOffers.every(isBoardOffer)
    && (x.partOffer === null || (isObj(x.partOffer) && typeof x.partOffer.horse === 'string' && isText(x.partOffer.rider, 30) && isInt(x.partOffer.pay, 0, 1000))) && isInt(x.inspectionFailedDay, 0) && isInt(x.lessonsBefore, 0)
    && Array.isArray(x.market) && x.market.length <= 10 && x.market.every(isOffer)
    && isObj(x.built) && isInt(x.built.stalls, 0, 1) && isInt(x.built.arena, 0, 1)
    && Array.isArray(x.goalsDone) && x.goalsDone.length <= 20 && x.goalsDone.every((g) => GOALS.has(g as string))
    && Array.isArray(x.explained) && x.explained.every((f) => (DATA.features as readonly unknown[]).includes(f)) && isInt(x.lastShowDay, 0) && isInt(x.trainings, 0) && isInt(x.badges, 0, 1) && isInt(x.badgeFailedDay, 0) && isInt(x.badgeQuizDay, 0) && Number.isFinite(x.seed) && isInt(x.day, 1) && isInt(x.money)
    && isInt(x.feed, 0) && oneOf(x.stage, DATA.stalls) && Array.isArray(x.horses) && x.horses.every(isHorse)
    && Array.isArray(x.night) && x.night.every((n) => isObj(n) && oneOf(n.kind, NEWS) && (n.horse === undefined || isText(n.horse, 40))
      && (n.owner === undefined || isText(n.owner, 30)) && (n.count === undefined || isInt(n.count, 0, 100)))
    && isObj(x.careDone) && CARE.every((c) => isInt((x.careDone as Obj)[c], 0))
    && isInt(x.debt, 0) && isEntries(x.today) && isEntries(x.bill)
    && Array.isArray(x.pupils) && x.pupils.length <= 10 && x.pupils.every(isPupil) && isInt(x.reputation, 0, 100) && isInt(x.lessonsGiven, 0);
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
  return { ...x, version: 3, state: { ...s, version: 3, careDone: { groom: 0, hooves: 0, feed: 0, muck: 0 },
    horses: Array.isArray(s.horses) ? s.horses.map((h) => (isObj(h) ? { ...h, cared: [] } : h)) : s.horses } };
}

/** Version 3 (before money): no debt, no bill. */
function fromVersion3(x: Obj): unknown {
  const s = x.state;
  if (!isObj(s)) return x;
  return { ...x, version: 4, state: { ...s, version: 4, debt: 0, today: [], bill: [] } };
}

/** Version 4 (before lessons): no pupils, no reputation. */
function fromVersion4(x: Obj): unknown {
  const s = x.state;
  if (!isObj(s)) return x;
  // the first pupils come at once, not only after the next night
  const [pupils, seed] = isInt(s.day, 1) && isInt(s.seed) ? pupilsFor(s.day as number, DATA.lessons.startReputation, s.seed as number) : [[], s.seed];
  return { ...x, version: 5, state: { ...s, version: 5, seed, pupils, reputation: DATA.lessons.startReputation, lessonsGiven: 0 } };
}

/** Version 5 (before the avatar editor): the player gets the default figure. */
function fromVersion5(x: Obj): unknown {
  const s = x.state;
  if (!isObj(s)) return x;
  return { ...x, version: 6, state: { ...s, version: 6, avatar: { ...DATA.avatar } } };
}

/** Version 6 (before the riding badge): no practice counted, no badge. */
function fromVersion6(x: Obj): unknown {
  const s = x.state;
  if (!isObj(s)) return x;
  return { ...x, version: 7, state: { ...s, version: 7, trainings: 0, badges: 0, badgeFailedDay: 0, badgeQuizDay: 0 } };
}

/** Version 7 (before shows): no show ridden yet. */
function fromVersion7(x: Obj): unknown {
  const s = x.state;
  if (!isObj(s)) return x;
  return { ...x, version: 8, state: { ...s, version: 8, lastShowDay: 0 } };
}

/** Version 8 (before goals and Oma's explanations): none reached yet; a player that far knows the places already. */
function fromVersion8(x: Obj): unknown {
  const s = x.state;
  if (!isObj(s)) return x;
  return { ...x, version: 9, state: { ...s, version: 9, goalsDone: [], explained: [...DATA.features] } };
}

/** Version 9 (before the farm inspection): no failed inspection, no market, nothing built. */
/** Version 10 to 11: the Pensionsstall (no grooms, no boarders or riders yet). */
function fromVersion10(x: Obj): unknown {
  const s = x.state;
  if (!isObj(s)) return x;
  return { ...x, version: 11, state: { ...s, version: 11, staff: 0, boardOffers: [], partOffer: null } };
}

function fromVersion9(x: Obj): unknown {
  const s = x.state;
  if (!isObj(s)) return x;
  return { ...x, version: 10, state: { ...s, version: 10, inspectionFailedDay: 0, lessonsBefore: 0, market: [], built: { stalls: 0, arena: 0 } } };
}

/** Reads a save file's text: the save if it is a valid Hufgeklapper save, else why not. */
export function parseSave(text: string): Parsed {
  let x: unknown;
  try { x = JSON.parse(text); } catch { return { ok: false, reason: 'invalid' }; }
  if (!isObj(x) || x.app !== 'hufgeklapper' || !isInt(x.version, 1)) return { ok: false, reason: 'invalid' };
  if ((x.version as number) > SAVE_VERSION) return { ok: false, reason: 'newer' };
  if (x.version === 1) x = fromVersion1(x);
  if (isObj(x) && x.version === 2) x = fromVersion2(x);
  if (isObj(x) && x.version === 3) x = fromVersion3(x);
  if (isObj(x) && x.version === 4) x = fromVersion4(x);
  if (isObj(x) && x.version === 5) x = fromVersion5(x);
  if (isObj(x) && x.version === 6) x = fromVersion6(x);
  if (isObj(x) && x.version === 7) x = fromVersion7(x);
  if (isObj(x) && x.version === 8) x = fromVersion8(x);
  if (isObj(x) && x.version === 9) x = fromVersion9(x);
  if (isObj(x) && x.version === 10) x = fromVersion10(x);
  if (!isObj(x) || !isText(x.name, 30) || typeof x.savedAt !== 'string' || !isState(x.state)) return { ok: false, reason: 'invalid' };
  return { ok: true, save: x as SaveFile };
}
