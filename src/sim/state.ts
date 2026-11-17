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
  id: string; name: string; breed: Breed; look: Look; needs: Needs; skills: { jumping: number; crossCountry: number };
  /** The skills at the start of each of the last days (#78), oldest first: [jumping, cross-country]. */
  log: [number, number][];
  rest: number; // days the horse must still rest after the vet (no riding, no lessons)
  cared: Care[]; // care actions it had today; each once a day
  /** A boarder's horse ("Einsteller", #63): whose it is, what they pay a day, nights in a row it was badly kept. */
  owner?: { name: string; pay: number; unhappy: number };
  /** A part-boarder ("Reitbeteiligung") rides this horse each day for `pay`. */
  rider?: { name: string; pay: number };
};

export type FarmStage = (typeof DATA.stages)[number];
/** A boarder looking for a stall: their horse and what they would pay a day. */
export type BoardOffer = { id: string; owner: string; name: string; breed: Breed; look: Look; pay: number };

export type State = {
  version: 18;
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
  xcTrainings: number; // cross-country practice rounds (#74: they open riding badge 2)
  routines: number; // care courses done (#74)
  badges: number;
  badgeFailedDay: number;
  /** The day of the last show the player rode in (0: none yet). */
  lastShowDay: number;
  lastXcShowDay: number; // the last cross-country show ridden (#75)
  /** Goals of the current stage reached (they stay reached; a new stage starts afresh), and the features Oma Hanne has explained. */
  goalsDone: GoalId[];
  explained: Feature[];
  /** The farm inspection: the day it last failed (0: never). The Reitschule's market and what has been built. */
  inspectionFailedDay: number;
  /** Lessons given before this farm stage began: a stage's lesson goal counts from its start. */
  lessonsBefore: number;
  market: Offer[];
  built: { stalls: number; arena: number; pasture: number };
  /** The Pensionsstall: grooms hired, boarders looking for a stall today, a rider who would like one of your horses. */
  staff: number;
  /** The day Oma Hanne helped out of a dead end (0: never; she helps once); mornings in a dead end since, in a row. */
  rescueDay: number;
  deadEnd: number;
  boardOffers: BoardOffer[];
  partOffer: { horse: string; rider: string; pay: number } | null;
  badgeQuizDay: number;
  /** Money in and out today, for tomorrow morning's bill; `bill` is yesterday's. */
  today: Entry[];
  bill: Entry[];
};

/** One line of the bill: what for, and the amount (+ in, − out). */
export type Entry = { what: 'hay' | 'hayOnCredit' | 'vet' | 'loan' | 'repay' | 'lesson' | 'showFee' | 'prize' | 'horse' | 'build' | 'wage' | 'board' | 'partBoard' | 'sale'; amount: number };

/** A horse for sale at the Reitschule's market. */
export type Offer = { id: string; name: string; breed: Breed; look: Look; price: number };

/** The player's figure ("Avatar"): a name and a rider's look (indices into the palettes in riders/look.ts). */
export type Avatar = { name: string; skin: number; hair: HairStyle; hairColor: number; jacket: number };

/** A pupil ("Reitschüler"): a small or big child, a beginner or advanced rider. */
export type Pupil = { id: string; name: string; size: 'small' | 'big'; level: 'beginner' | 'advanced'; look: number };

export type Care = 'groom' | 'hooves' | 'feed' | 'muck';
export const CARE: Care[] = ['groom', 'hooves', 'feed', 'muck'];

/** Morning news: data only; the screens turn it into words. */
export type News = { kind: 'sick' | 'noHay' | 'hayLow' | 'rested' | 'bill' | 'staffUnpaid' | 'boarderLeft' | 'omaHelped' | 'lastWarning' | 'gameOver'; horse?: string; owner?: string; count?: number };

export type Action = { type: 'sleep' } | { type: 'vet'; horse: string } | { type: 'care'; horse: string; what: Care; quick?: boolean }
  | { type: 'buyHay'; pack: number } | { type: 'loan' } | { type: 'lesson'; pupil: string; horse: string; prepared?: number }
  | { type: 'routine'; horse: string; wrong: number; ride: boolean }
  | { type: 'badge2'; horse: string; wrong: number; faults: number | null }
  | { type: 'train'; horse: string; faults: number } | { type: 'xcTrain'; horse: string; faults: number }
  | { type: 'badgeQuiz'; answers: number[] } | { type: 'badge'; horse: string; faults: number }
  | { type: 'show'; horse: string; faults: number; showClass: ShowClass } | { type: 'xcShow'; horse: string; faults: number; showClass: ShowClass }
  | { type: 'explained'; what: Feature } | { type: 'rename'; horse: string; name: string }
  | { type: 'inspection'; answers: number[] } | { type: 'buyHorse'; offer: string } | { type: 'build'; what: Buildable }
  | { type: 'hire' } | { type: 'fire' } | { type: 'board'; offer: string } | { type: 'partBoard' } | { type: 'endPartBoard'; horse: string } | { type: 'sell'; horse: string };

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
  ({ id, name, breed, look, needs: { ...DATA.needs.start }, skills: { jumping: 10, crossCountry: 10 }, log: [[10, 10]], rest: 0, cared: [] });

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

/** Whether the farm has come to stage `stage` (or further). */
export const atLeast = (s: State, stage: FarmStage) => DATA.stages.indexOf(s.stage) >= DATA.stages.indexOf(stage);
/** The stage the next farm inspection opens, or null at the last one. */
export const nextStage = (s: State): FarmStage | null => DATA.stages[DATA.stages.indexOf(s.stage) + 1] ?? null;
/** The farm inspection can come once every goal of the stage is met, if there is a next stage (not again on the day it failed). */
export const canInspect = (s: State) => nextStage(s) !== null && allGoalsDone(s) && s.inspectionFailedDay !== s.day;
/** A horse of the farm's own (not a boarder's): only these give lessons, jump and start in shows. */
export const own = (h: Horse) => !h.owner;

/** Boarders looking for a stall this morning: their horses (names not taken on the farm) and the pay. */
export function boardersFor(day: number, seed: number, taken: string[]): [BoardOffer[], number] {
  const B = DATA.boarders, [horses, next] = marketFor(day, seed, taken);
  let r: number;
  seed = next;
  const offers = horses.slice(0, B.offers).map((o, i): BoardOffer => {
    [r, seed] = roll(seed); const owner = B.owners[Math.floor(r * B.owners.length)];
    [r, seed] = roll(seed); const pay = Math.round(B.pay[0] + r * (B.pay[1] - B.pay[0]));
    return { id: `b${day}-${i}`, owner, name: o.name, breed: o.breed, look: o.look, pay };
  });
  return [offers, seed];
}
/** A rider who would like one of your horses this morning (one without a rider yet), or none. */
function partOfferFor(s: State, seed: number): [State['partOffer'], number] {
  const P = DATA.partBoard, free = s.horses.filter((h) => own(h) && !h.rider);
  let r: number;
  if (!free.length) return [null, seed];
  [r, seed] = roll(seed); const h = free[Math.floor(r * free.length)];
  [r, seed] = roll(seed); const rider = DATA.pupilNames[Math.floor(r * DATA.pupilNames.length)];
  [r, seed] = roll(seed);
  return [{ horse: h.id, rider, pay: Math.round(P.pay[0] + r * (P.pay[1] - P.pay[0])) }, seed];
}
const isQuiz = (a: unknown, q: { questions: number; answers: number }) =>
  Array.isArray(a) && a.length === q.questions && a.every((x) => Number.isInteger(x) && x >= 0 && x < q.answers);
/** Why a building can't be built now: not yet a Reitschule, built already, or too little money. */
export function buildWaits(s: State, what: Buildable): 'stage' | 'built' | 'money' | null {
  const most = what === 'pasture' ? DATA.build.pasture.max : 1;
  return !atLeast(s, 'reitschule') ? 'stage' : s.built[what] >= most ? 'built' : s.money < DATA.build[what].cost ? 'money' : null;
}
export type Buildable = 'stalls' | 'arena' | 'pasture';

/** The pasture's places (#79), and how many the farm's horses take: a pony 1, a big horse 2. */
export const pasture = (s: State) => DATA.pasture.start + s.built.pasture * DATA.build.pasture.places;
export const grazing = (s: State) => s.horses.reduce((n, h) => n + DATA.pasture.need[h.look.build], 0);
/** Why one more horse of `build` can't come to the farm: no free stall, or no room on the pasture; null if it can. */
export const noRoom = (s: State, build: Look['build']): 'stall' | 'pasture' | null =>
  s.horses.length >= stalls(s) ? 'stall' : grazing(s) + DATA.pasture.need[build] > pasture(s) ? 'pasture' : null;

/** How well trained horse `h` is, 0–1: its jumping and cross-country skill against what its breed can reach. */
const trained = (h: Horse) => Math.min(1, (h.skills.jumping + h.skills.crossCountry) / (scope(h) + xcScope(h)));
/** What horse `h` fetches at the market (#85): half the middle price for its build, more the better trained it is. */
export function salePrice(h: Horse) {
  const [lo, hi] = DATA.market.price[h.look.build], S = DATA.sale;
  return Math.round((((lo + hi) / 2) * (S.base + S.trained * trained(h))) / 10) * 10;
}
/**
 * Why horse `h` can't be sold now, or null: only at the market (Reitschule on), never the last horse, never a
 * boarder's, not while a part-boarder rides it, not sick.
 */
export function saleWaits(s: State, h: Horse): 'market' | 'last' | 'boarder' | 'rider' | 'sick' | null {
  return !atLeast(s, 'reitschule') ? 'market' : !own(h) ? 'boarder' : s.horses.filter(own).length <= 1 ? 'last' : h.rider ? 'rider' : isSick(h) ? 'sick' : null;
}
/** Oma Hanne's word on a sale: the last pony (small pupils need one), well trained (a good price), or worth more with practice. */
export function saleAdvice(s: State, h: Horse): 'lastPony' | 'good' | 'practise' {
  if (h.look.build === 'pony' && s.horses.filter((x) => own(x) && x.look.build === 'pony').length === 1) return 'lastPony';
  return trained(h) >= DATA.sale.good ? 'good' : 'practise';
}

/** A new game on Oma Hanne's small farm: two ponies of different breeds and coats. */
export function newGame(seed: number, avatar: Avatar = DATA.avatar): State {
  const [pupils, next] = pupilsFor(1, DATA.lessons.startReputation, seed);
  return {
    version: 18, lastXcShowDay: 0, rescueDay: 0, xcTrainings: 0, routines: 0, deadEnd: 0, staff: 0, boardOffers: [], partOffer: null, inspectionFailedDay: 0, lessonsBefore: 0, market: [], built: { stalls: 0, arena: 0, pasture: 0 }, avatar, trainings: 0, badges: 0, badgeFailedDay: 0, badgeQuizDay: 0, lastShowDay: 0, goalsDone: [], explained: [], seed: next, day: 1, money: DATA.start.money, feed: DATA.start.feed, stage: 'kleinerHof', night: [],
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
/** Paid if the money is there, else on credit while the store is low (see hayWaits), so the horses never go hungry for lack of it. */
export const hayOnCredit = (s: State, pack: number) => s.money < DATA.hayPacks[pack].price;
/**
 * Why a hay pack can't be bought now: the store is full, or there's no money and still hay for a few nights (credit is
 * help in need, not a shopping spree; with the store low it is always there, so the horses never go without).
 */
export function hayWaits(s: State, pack: number): 'full' | 'enough' | null {
  if (s.feed + DATA.hayPacks[pack].bales > DATA.hay.store) return 'full';
  return hayOnCredit(s, pack) && hayNights(s) >= DATA.hay.creditNights ? 'enough' : null;
}
export const canLoan = (s: State) => s.debt + DATA.loan.amount <= DATA.loan.debtLimit;
/** A dead end: every horse of your own sick, no money for the vet and no more loans; nothing earns money any more. */
export const stuck = (s: State) => s.horses.some(own) && s.horses.filter(own).every(isSick) && !canPayVet(s) && !canLoan(s);
/**
 * A dead end in the morning: the first time Oma Hanne helps (the vet for every sick horse of yours, and some hay).
 * After that she only warns, counting down the mornings in a row; at the last one the farm is lost.
 */
function rescue(s: State): State {
  if (!stuck(s)) return s.deadEnd ? { ...s, deadEnd: 0 } : s;
  if (!s.rescueDay) {
    const horses = s.horses.map((h) => (own(h) && isSick(h) ? { ...h, needs: { ...h.needs, health: Math.max(h.needs.health, DATA.vet.health) }, rest: DATA.vet.restDays } : h));
    return { ...s, horses, feed: s.feed + DATA.rescue.hay, rescueDay: s.day, night: [...s.night, { kind: 'omaHelped' }] };
  }
  const deadEnd = s.deadEnd + 1, left = DATA.rescue.grace - deadEnd;
  return { ...s, deadEnd, night: [...s.night, left > 0 ? { kind: 'lastWarning', count: left } : { kind: 'gameOver' }] };
}
/** The farm is lost: a second dead end lasted too long. Nothing more happens in this game. */
export const gameOver = (s: State) => s.deadEnd >= DATA.rescue.grace;

/** Why a horse can't do work that takes `energy` now (sick, resting after the vet, too tired), or null if it can. */
export function cantWork(h: Horse, energy: number): 'sick' | 'resting' | 'tired' | null {
  return isSick(h) ? 'sick' : h.rest ? 'resting' : h.needs.energy < energy ? 'tired' : null;
}

/** How well a horse is kept: its fed, clean and happy needs as a share of full (0–1). */
const keptShare = (h: Horse) => (h.needs.fed + h.needs.clean + h.needs.happy) / 300;

/**
 * The jumping minigame's take-off window in seconds: wider for a skilled, well kept, happy horse.
 * A tap within half the window of the perfect moment clears the jump.
 */
export function jumpWindow(h: Horse) {
  const J = DATA.jumping, kept = keptShare(h);
  return J.window.base + J.window.skill * (h.skills.jumping / 100) + J.window.kept * kept;
}
export const clears = (h: Horse, offset: number) => Math.abs(offset) <= jumpWindow(h) / 2;
/**
 * What "Hopp!" `offset` seconds from the perfect take-off does: too early to count yet, a clear jump, or a knocked
 * pole. Without it the horse refuses (see round.ts).
 */
export const takeOff = (h: Horse, offset: number, held = Infinity, need = 0): 'early' | 'clear' | 'fault' =>
  offset < -DATA.jumping.early ? 'early' : clears(h, offset) && held >= need ? 'clear' : 'fault';
/**
 * Higher jumps (classes A and L, #58) need momentum: the finger held down for `need` seconds before letting go at
 * take-off. A well-trained horse needs less of it. 0: a tap is enough (class E).
 */
export const holdNeed = (h: Horse, hold: number) => hold * (1 - DATA.jumping.holdSkill * (h.skills.jumping / 100));
/** Why a take-off knocked the pole: not enough momentum (held too briefly) with the timing right, else too soon or late. */
export const faultWhy = (h: Horse, offset: number, held = Infinity, need = 0): 'soon' | 'late' | 'power' =>
  clears(h, offset) && held < need ? 'power' : offset < 0 ? 'soon' : 'late';

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
/** Why riding badge 2 (#74) can't be taken now: badge 1 first, more cross-country practice, the care course once, tomorrow, all tired; null if it can. */
export function badge2Waits(s: State): { why: 'passed' | 'badge1' | 'routine' | 'tomorrow' | 'tired' } | { why: 'practise'; rounds: number } | null {
  const B = DATA.badge2;
  if (s.badges >= 2) return { why: 'passed' };
  if (s.badges < 1) return { why: 'badge1' };
  if (s.xcTrainings < B.xcTrainings) return { why: 'practise', rounds: B.xcTrainings - s.xcTrainings };
  if (s.routines < B.routines) return { why: 'routine' };
  if (s.badgeFailedDay === s.day) return { why: 'tomorrow' };
  // the exam needs the care course's walk and the cross-country round from one horse
  return s.horses.filter(own).every((h) => cantWork(h, DATA.badge2.energy)) ? { why: 'tired' } : null;
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
/** The next cross-country show day (#75): the days between the jumping shows; today if one is on and not ridden yet. */
export function nextXcShowDay(s: State) {
  const { every, on } = DATA.xcShows, next = s.day + ((on - (s.day % every) + every) % every);
  return next === s.lastXcShowDay ? next + every : next;
}
/** Why the player can't ride in a cross-country show today, or null if they can. */
export function xcShowWaits(s: State): 'badge' | 'notToday' | 'money' | null {
  return s.badges < 2 ? 'badge' : nextXcShowDay(s) !== s.day ? 'notToday' : s.money < DATA.xcShows.classes.E.fee ? 'money' : null;
}
/** Why horse `h` can't start in cross-country class `c` today (#75): its breed, its skill, the fee. */
export const xcClassWaits = (s: State, h: Horse, c: ShowClass): 'scope' | 'skill' | 'money' | null =>
  xcScope(h) < DATA.xcShows.classes[c].minSkill ? 'scope' : h.skills.crossCountry < DATA.xcShows.classes[c].minSkill ? 'skill' : s.money < DATA.xcShows.classes[c].fee ? 'money' : null;
/** Why cross-country class `c` is shut today for every horse, the nearest reason first; null if one can start. */
export function xcClassShut(s: State, c: ShowClass): 'money' | 'tired' | 'skill' | 'scope' | null {
  const w = s.horses.filter(own).map((h) => xcClassWaits(s, h, c) ?? (cantWork(h, DATA.crossCountry.energy) ? 'tired' : null));
  return w.includes(null) ? null : (['money', 'tired', 'skill', 'scope'] as const).find((r) => w.includes(r)) ?? 'scope';
}
export const SHOW_CLASSES = Object.keys(DATA.shows.classes) as ShowClass[];
/** How far horse `h` can come in jumping: its breed's limit for the skill. */
export const scope = (h: { breed: Breed }) => DATA.jumping.scope[h.breed];
/**
 * How a horse's skills grew (#78): since the start of the day `days` ago (1: today), as [jumping, cross-country].
 * A horse with a shorter log counts from its oldest day.
 */
export function gained(h: Horse, days = 1): [number, number] {
  const [j, x] = h.log[Math.max(0, h.log.length - days)] ?? [h.skills.jumping, h.skills.crossCountry];
  return [h.skills.jumping - j, h.skills.crossCountry - x];
}
/** How far a breed can come cross-country (#73): sure-footed ponies do better here than over poles. */
export const xcScope = (h: { breed: Breed }) => DATA.crossCountry.scope[h.breed];
/** The cross-country take-off window (seconds): wider with skill and good care; narrower in a higher show class (#75). */
export function xcWindow(h: Horse, c?: ShowClass) {
  const w = DATA.crossCountry.window;
  return (w.base + w.skill * (h.skills.crossCountry / 100) + w.kept * keptShare(h)) * (c ? DATA.xcShows.classes[c].window : 1);
}
/** How fast galloping tires this horse, as a share: a skilled one less. */
export const xcDrain = (h: Horse) => 1 - DATA.crossCountry.skillDrain * (h.skills.crossCountry / 100);
/** The highest class horse `h` can ever start in, with enough practice. */
export const topClass = (h: { breed: Breed }) => SHOW_CLASSES.filter((c) => DATA.shows.classes[c].minSkill <= scope(h)).pop()!;
/**
 * Why horse `h` can't start in class `c` today: it can never jump that high (its breed), not skilled enough yet,
 * or the entry fee is too much; null if it can.
 */
export const classWaits = (s: State, h: Horse, c: ShowClass): 'scope' | 'skill' | 'money' | null =>
  scope(h) < DATA.shows.classes[c].minSkill ? 'scope' : h.skills.jumping < DATA.shows.classes[c].minSkill ? 'skill' : s.money < DATA.shows.classes[c].fee ? 'money' : null;
/**
 * Why class `c` is shut today for every horse, the nearest reason first (the fee, then a skilled horse that can't
 * work today, then no horse skilled enough); null if some horse can start there.
 */
export function classShut(s: State, c: ShowClass): 'money' | 'tired' | 'skill' | 'scope' | null {
  const w = s.horses.filter(own).map((h) => classWaits(s, h, c) ?? (cantWork(h, DATA.jumping.energy) ? 'tired' : null));
  return w.includes(null) ? null : (['money', 'tired', 'skill', 'scope'] as const).find((r) => w.includes(r)) ?? 'scope';
}
const showScore = (faults: number, skill: number) => 100 - DATA.shows.faultPoints * faults + Math.round(skill * DATA.shows.skillPoints);

export type ShowRow = { rider: string; horse: string; score: number; you?: true };
/**
 * A show's results for the player's round with horse `h`: the rivals ride with chance from the game's seed. The table
 * is best first; the player wins a tie. Returns the rank (1 = first), the prize and the moved seed.
 */
export function showResult(s: State, h: Horse, faults: number, rider: string, c: ShowClass, xc = false) {
  // a cross-country show (#75): its own classes, the cross-country skill, its obstacles
  const S = DATA.shows, C = xc ? DATA.xcShows.classes[c] : S.classes[c], J = DATA.jumping, rows: ShowRow[] = [];
  const obstacles = xc ? DATA.xcShows.classes[c].obstacles : J.courses[c].jumps.length, skillOf = xc ? h.skills.crossCountry : h.skills.jumping;
  let seed = s.seed, r: number;
  const pool = S.rivals.filter(([name, horse]) => name !== rider && horse.toLowerCase() !== h.name.toLowerCase()); // no rival with the player's or the horse's name
  for (let i = 0; i < S.rivalsPerShow; i++) {
    [r, seed] = roll(seed);
    const [name, horse] = pool.splice(Math.floor(r * pool.length), 1)[0];
    [r, seed] = roll(seed);
    const skill = C.rivalSkill[0] + r * (C.rivalSkill[1] - C.rivalSkill[0]);
    let down = 0;
    for (let j = 0; j < obstacles; j++) { [r, seed] = roll(seed); if (r < S.rivalFaultChance * (1 - skill / 100)) down++; }
    rows.push({ rider: name, horse, score: showScore(down, skill) });
  }
  const you: ShowRow = { rider, horse: h.name, score: showScore(faults, skillOf), you: true };
  const table = [you, ...rows].sort((a, b) => b.score - a.score || (a.you ? -1 : b.you ? 1 : 0));
  const rank = table.indexOf(you) + 1;
  return { table, rank, prize: C.prizes[rank - 1] ?? 0, seed };
}

/** The quiz's score: in the quiz data the right answer of each question comes first (index 0). */
export const quizScore = (answers: number[]) => answers.filter((a) => a === 0).length;
/**
 * The order to show a question's `n` answers in (indices into its answers, 0 the right one): shuffled, the same for
 * the same `seed` (the day and the question), so a reload mid-exam doesn't reshuffle (#98).
 */
export function answerOrder(n: number, seed: number) {
  let r = Math.abs(Math.floor(seed)) % 2147483646 + 1;
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { r = (r * 16807) % 2147483647; const j = r % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  return order;
}

/** How a pupil and a horse fit: a small child belongs on a pony, a big one on a horse. */
export function fit(p: Pupil, h: Horse): keyof typeof DATA.lessons.fit {
  const pony = h.look.build === 'pony';
  return p.size === 'small' ? (pony ? 'right' : 'smallOnHorse') : pony ? 'bigOnPony' : 'right';
}

/** What a lesson would bring: how happy the pupil is (0–100) and the pay. A well kept, fitting horse makes it best. */
export function lessonOutcome(p: Pupil, h: Horse) {
  const L = DATA.lessons, kept = keptShare(h);
  const happy = Math.round(100 * L.fit[fit(p, h)] * (0.5 + 0.5 * kept));
  return { happy, pay: Math.round(L.pay[p.level] * (0.6 + 0.4 * (happy / 100))) };
}

/**
 * Each horse for a lesson with pupil `p`, as the horse list shows it: why it can't (tired, resting, sick), how it
 * fits, whether it needs care first, how happy the pupil would be and the pay; the best one is marked.
 */
export function lessonChoices(p: Pupil, horses: Horse[]) {
  const all = horses.map((h) => {
    const why = cantWork(h, DATA.lessons.energy), out = lessonOutcome(p, h);
    return { horse: h, why, fit: fit(p, h), unkempt: keptShare(h) < DATA.lessons.keptWell, ...out, mood: mood(out.happy), best: false };
  });
  const best = all.filter((c) => !c.why && c.mood !== 'unhappy').sort((a, b) => b.pay - a.pay)[0]; // never "best" for an unhappy pupil
  if (best) best.best = true;
  return all;
}
/** No horse that can work today is the right size for pupil `p`: Oma Hanne then explains which horse fits whom. */
export const fitsNone = (p: Pupil, horses: Horse[]) => !lessonChoices(p, horses).some((c) => !c.why && c.fit === 'right');

/** How a pupil felt about a lesson: below `happyAt` the farm's reputation drops. */
export const mood = (happy: number): 'delighted' | 'happy' | 'unhappy' => happy >= DATA.lessons.delightedAt ? 'delighted' : happy >= DATA.lessons.happyAt ? 'happy' : 'unhappy';

/**
 * The day's money for the diary: the entries summed by what they were for, earned and spent apart (the biggest
 * first), debts on their own (a loan, hay on credit, debt paid back), and the total: exactly how the money changed
 * (hay on credit doesn't touch it).
 */
export function dayMoney(entries: Entry[]) {
  const DEBT: Entry['what'][] = ['loan', 'repay', 'hayOnCredit'], by = new Map<Entry['what'], number>();
  for (const e of entries) by.set(e.what, (by.get(e.what) ?? 0) + e.amount);
  const rows = [...by].map(([what, amount]) => ({ what, amount })).filter((r) => r.amount), debt = (r: { what: Entry['what'] }) => DEBT.includes(r.what);
  return {
    income: rows.filter((r) => r.amount > 0 && !debt(r)).sort((a, b) => b.amount - a.amount),
    costs: rows.filter((r) => r.amount < 0 && !debt(r)).sort((a, b) => a.amount - b.amount),
    debts: rows.filter(debt),
    total: entries.filter((e) => e.what !== 'hayOnCredit').reduce((n, e) => n + e.amount, 0),
  };
}

/**
 * The Pensionsstall's morning, after the night: the riders ride (their horse's energy, their fee) and the boarders pay
 * for the night; then the grooms, if their wage can be paid, care for as many horses as they can (worst kept first;
 * feeding takes hay); then a boarder whose horse was badly kept too long leaves (the reputation drops). Then new
 * offers for boarders (no name already on the farm or at the market) and a rider.
 */
function pensionMorning(s: State): State {
  const S = DATA.staff, B = DATA.boarders, news = [...s.night], ridden = s.horses.filter((h) => h.rider && !cantWork(h, 0));
  let next: State = { ...s, today: [], horses: s.horses.map((h) => (ridden.includes(h) ? { ...h, needs: { ...h.needs, energy: clamp(h.needs.energy - DATA.partBoard.energy) } } : h)) };
  const pay = (what: 'partBoard' | 'board', amount: number) => { const e = earn(next, amount); next = { ...e, today: [...e.today, { what, amount }] }; };
  for (const h of ridden) pay('partBoard', h.rider!.pay);
  for (const h of s.horses) if (h.owner) pay('board', h.owner.pay);
  // the grooms: their wage from the morning's money; unpaid, they stay away today
  let horses = next.horses, feed = next.feed;
  const wage = s.staff * S.wage;
  if (s.staff && next.money >= wage) {
    next = { ...next, money: next.money - wage, today: [...next.today, { what: 'wage', amount: -wage }] };
    const turn = [...horses].sort((a, b) => keptShare(a) - keptShare(b)).slice(0, s.staff * S.horses).map((h) => h.id);
    horses = horses.map((h) => {
      if (!turn.includes(h.id)) return h;
      const needs = { ...h.needs };
      for (const what of CARE) {
        if (what === 'feed') { if (feed < 1) continue; feed--; }
        for (const [n, v] of Object.entries(DATA.care[what]) as [Need, number][]) needs[n] = clamp(needs[n] + v);
      }
      return { ...h, needs };
    });
  } else if (s.staff) news.push({ kind: 'staffUnpaid' });
  // the boarders: badly kept too many nights in a row, they take their horse away
  let reputation = next.reputation;
  horses = horses.flatMap((h) => {
    if (!h.owner) return [h];
    const bad = keptShare(h) < B.keptBelow || isSick(h), unhappy = bad ? h.owner.unhappy + 1 : 0;
    if (unhappy >= B.patience) { reputation = clamp(reputation - B.leaveReputation); news.push({ kind: 'boarderLeft', horse: h.name, owner: h.owner.name }); return []; }
    return [{ ...h, owner: { ...h.owner, unhappy } }];
  });
  next = { ...next, horses, feed, reputation, night: news };
  const [boardOffers, seed1] = boardersFor(s.day, s.seed, [...horses, ...s.market].map((h) => h.name));
  const [partOffer, seed] = partOfferFor(next, seed1);
  return { ...next, boardOffers, partOffer, seed };
}

/** Money earned (lessons, prizes): part of it pays back debt first. Used by the actions that earn. */
export function earn(s: State, amount: number): State {
  const repay = Math.min(s.debt, Math.round(amount * DATA.repayShare));
  const today: Entry[] = repay ? [...s.today, { what: 'repay', amount: -repay }] : s.today;
  return { ...s, money: s.money + amount - repay, debt: s.debt - repay, today };
}
export const stalls = (s: State) => DATA.stalls[s.stage] + s.built.stalls * DATA.build.stalls.places;
export const canBuild = (s: State) => atLeast(s, DATA.freePlotsFrom);
/** How many nights the hay in store feeds every horse. */
export const hayNights = (s: State) => Math.floor(s.feed / Math.max(1, s.horses.length * DATA.hayPerNight));

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
  const have = {
    groom: s.careDone.groom, lessons: s.lessonsGiven - s.lessonsBefore, badge: s.badges, badge2: s.badges >= 2 ? 1 : 0, savings: s.debt ? 0 : s.money, reputation: s.reputation,
    horses: s.horses.filter(own).length, boarders: s.horses.filter((h) => h.owner).length, staff: [...s.today, ...s.bill].some((e) => e.what === 'wage') ? s.staff : 0, partBoard: s.horses.filter((h) => h.rider).length, // a groom counts once paid
  };
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
  return hayNights(s) < DATA.hints.hayNights ? { kind: 'hay' } : null;
}

/** Applies one action (never changing the state it was given); afterwards every goal just reached is noted as done. */
export function apply(state: State, action: Action): State {
  if (gameOver(state)) return state;
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
      // the next stage: the Reitschule opens the horse market, the Pensionsstall the boarders; the new stage starts its
      // own goal list (counts like lessons given go on from where they are)
      const stage = nextStage(state)!, names = state.horses.map((h) => h.name);
      const [market, seed1] = marketFor(state.day, state.seed, names);
      const [boardOffers, seed] = stage === 'pensionsstall' ? boardersFor(state.day, seed1, [...names, ...market.map((o) => o.name)]) : [state.boardOffers, seed1];
      return { ...state, stage, market, boardOffers, seed, goalsDone: [], lessonsBefore: state.lessonsGiven };
    }
    case 'buyHorse': {
      const o = state.market.find((x) => x.id === action.offer);
      if (!o || state.money < o.price || noRoom(state, o.look.build) || state.horses.some((h) => h.id === o.id)) return state; // a stall and room on the pasture
      return { ...state, money: state.money - o.price, market: state.market.filter((x) => x !== o),
        horses: [...state.horses, horse(o.id, o.name, o.breed, o.look)], today: [...state.today, { what: 'horse', amount: -o.price }] };
    }
    case 'sell': {
      // the money (some of it pays debts, like any income), the stall and pasture places free; an offer for it goes
      const h = state.horses.find((x) => x.id === action.horse);
      if (!h || saleWaits(state, h)) return state;
      const price = salePrice(h), sold = earn({ ...state, today: [...state.today, { what: 'sale', amount: price }] }, price);
      return { ...sold, horses: state.horses.filter((x) => x !== h), partOffer: state.partOffer?.horse === h.id ? null : state.partOffer };
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
        const after = { ...night(h, hay), log: [...h.log, [h.skills.jumping, h.skills.crossCountry] as [number, number]].slice(-DATA.progress.days) }; // tomorrow starts with today's skills
        if (!hay) news.push({ kind: 'noHay', horse: h.id });
        if (isSick(after) && !isSick(h)) news.push({ kind: 'sick', horse: h.id });
        if (h.rest === 1 && !isSick(after)) news.push({ kind: 'rested', horse: h.id });
        return after;
      });
      if (feed > 0 && feed < horses.length * DATA.hayPerNight * DATA.hayLowNights) news.push({ kind: 'hayLow' });
      if (state.today.length) news.push({ kind: 'bill' });
      const [pupils, seed1] = pupilsFor(state.day + 1, state.reputation, state.seed, state.built.arena * DATA.build.arena.pupils);
      const [market, seed2] = atLeast(state, 'reitschule') ? marketFor(state.day + 1, seed1, horses.map((h) => h.name)) : [state.market, seed1];
      const morning: State = { ...state, day: state.day + 1, feed, horses, night: news, bill: state.today, today: [], pupils, market, seed: seed2 };
      return rescue(atLeast(state, 'pensionsstall') ? pensionMorning(morning) : morning);
    }
    case 'hire': // a groom more (from the Pensionsstall on), up to the most a farm takes; or one less
      return atLeast(state, 'pensionsstall') && state.staff < DATA.staff.names.length ? { ...state, staff: state.staff + 1 } : state;
    case 'fire':
      return state.staff > 0 ? { ...state, staff: state.staff - 1 } : state;
    case 'board': {
      // a boarder's horse moves into a free stall; it pays each morning from tomorrow on
      const o = state.boardOffers.find((x) => x.id === action.offer);
      if (!o || noRoom(state, o.look.build) || state.horses.some((h) => h.id === o.id)) return state;
      const guest: Horse = { ...horse(o.id, o.name, o.breed, o.look), owner: { name: o.owner, pay: o.pay, unhappy: 0 } };
      return { ...state, horses: [...state.horses, guest], boardOffers: state.boardOffers.filter((x) => x !== o) };
    }
    case 'partBoard': {
      // the rider offered this morning rides that horse from now on, each day, for their fee
      const p = state.partOffer, h = p && state.horses.find((x) => x.id === p.horse);
      if (!p || !h || !own(h) || h.rider) return state;
      return { ...state, partOffer: null, horses: state.horses.map((x) => (x === h ? { ...h, rider: { name: p.rider, pay: p.pay } } : x)) };
    }
    case 'endPartBoard': {
      const h = state.horses.find((x) => x.id === action.horse);
      if (!h?.rider) return state;
      const { rider: _, ...free } = h;
      return { ...state, horses: state.horses.map((x) => (x === h ? free : x)) };
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
    case 'routine': {
      // the care course done: groomed and hooves done today (as by hand), happier, more without a wrong step; a walk
      // ride by the player costs a little energy (a lesson's ride took its own)
      const h = state.horses.find((x) => x.id === action.horse), R = DATA.routine;
      if (!h || !own(h) || !Number.isInteger(action.wrong) || action.wrong < 0 || (action.ride && cantWork(h, R.energy))) return state;
      const fresh = (['groom', 'hooves'] as const).filter((c) => !h.cared.includes(c)), needs = { ...h.needs };
      for (const c of fresh) for (const [n, v] of Object.entries(DATA.care[c]) as [Need, number][]) needs[n] = clamp(needs[n] + v);
      needs.happy = clamp(needs.happy + (action.wrong ? R.happy : R.happyClean));
      if (action.ride) needs.energy = clamp(needs.energy - R.energy);
      return {
        ...state,
        horses: state.horses.map((x) => (x === h ? { ...h, needs, cared: [...h.cared, ...fresh] } : x)),
        careDone: fresh.reduce((d, c) => ({ ...d, [c]: d[c] + 1 }), state.careDone), routines: state.routines + 1,
      };
    }
    case 'rename': {
      // a name of its own: trimmed, not empty, not too long for a nameplate, not the name of another horse on the farm
      // or at the market (buying it would make two)
      const name = typeof action.name === 'string' ? action.name.trim() : '', h = state.horses.find((x) => x.id === action.horse);
      const same = (n: string) => n.toLowerCase() === name.toLowerCase();
      if (!h || !own(h) || !name || name.length > DATA.horseName.max || state.horses.some((x) => x !== h && same(x.name)) || [...state.market, ...state.boardOffers].some((o) => same(o.name))) return state;
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
      if (!p || hayWaits(state, action.pack)) return state;
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
      if (!h || !own(h) || cantWork(h, J.energy) || !Number.isInteger(action.faults) || action.faults < 0) return state;
      const trained: Horse = {
        ...h, skills: { ...h.skills, jumping: Math.max(h.skills.jumping, Math.min(scope(h), clamp(h.skills.jumping + (action.faults ? J.gain.faults : J.gain.clear)))) }, // up to the breed's limit, never down
        needs: { ...h.needs, energy: clamp(h.needs.energy - J.energy), happy: clamp(h.needs.happy + J.happy) },
      };
      return { ...state, trainings: state.trainings + 1, horses: state.horses.map((x) => (x === h ? trained : x)) };
    }
    case 'xcTrain': {
      // a cross-country ride as training: its own skill grows (more without a fault), the horse tires and enjoys it
      const h = state.horses.find((x) => x.id === action.horse), X = DATA.crossCountry;
      if (state.badges < 1 || !h || !own(h) || cantWork(h, X.energy) || !Number.isInteger(action.faults) || action.faults < 0) return state; // after riding badge 1
      const xc = Math.max(h.skills.crossCountry, Math.min(xcScope(h), clamp(h.skills.crossCountry + (action.faults ? X.gain.faults : X.gain.clear))));
      const trained: Horse = { ...h, skills: { ...h.skills, crossCountry: xc }, needs: { ...h.needs, energy: clamp(h.needs.energy - X.energy), happy: clamp(h.needs.happy + X.happy) } };
      return { ...state, xcTrainings: state.xcTrainings + 1, horses: state.horses.map((x) => (x === h ? trained : x)) };
    }
    case 'badge2': {
      // the exam: the care course (its wrong steps), then a cross-country round (`faults`; null: not ridden, the course
      // already had too many wrong steps); both within the limits pass it, else another try tomorrow
      const h = state.horses.find((x) => x.id === action.horse), B = DATA.badge2, X = DATA.crossCountry;
      // tired now is no reason to drop the result: part 1 itself took the horse's energy (the round checks its own below)
      const w = badge2Waits(state);
      if (!h || !own(h) || (w && w.why !== 'tired') || !Number.isInteger(action.wrong) || action.wrong < 0) return state;
      const rode = action.faults !== null;
      if (rode && (!Number.isInteger(action.faults) || action.faults! < 0 || cantWork(h, X.energy))) return state;
      const ridden = rode ? { ...h, needs: { ...h.needs, energy: clamp(h.needs.energy - X.energy) } } : h;
      const passed = action.wrong <= B.maxWrong && rode && action.faults! <= B.maxFaults;
      return { ...state, horses: state.horses.map((x) => (x === h ? ridden : x)), badges: passed ? 2 : state.badges, badgeFailedDay: passed ? 0 : state.day };
    }
    case 'show': {
      // the entry fee, the round (the horse tires like practice), the prize for the first three; one show a day
      const h = state.horses.find((x) => x.id === action.horse), c = action.showClass;
      if (!h || !own(h) || !SHOW_CLASSES.includes(c) || showWaits(state) || classWaits(state, h, c) || cantWork(h, DATA.jumping.energy)
        || !Number.isInteger(action.faults) || action.faults < 0) return state;
      const fee = DATA.shows.classes[c].fee, { prize, seed } = showResult(state, h, action.faults, state.avatar.name, c);
      const ridden = { ...h, needs: { ...h.needs, energy: clamp(h.needs.energy - DATA.jumping.energy) } };
      const paid: State = { ...state, seed, lastShowDay: state.day, money: state.money - fee, horses: state.horses.map((x) => (x === h ? ridden : x)),
        today: [...state.today, { what: 'showFee', amount: -fee }, ...(prize ? [{ what: 'prize' as const, amount: prize }] : [])] };
      return prize ? earn(paid, prize) : paid;
    }
    case 'xcShow': {
      // a cross-country show (#75): the entry fee, the round (the horse tires like practice), a prize for the first three
      const h = state.horses.find((x) => x.id === action.horse), c = action.showClass, X = DATA.crossCountry;
      if (!h || !own(h) || !SHOW_CLASSES.includes(c) || xcShowWaits(state) || xcClassWaits(state, h, c) || cantWork(h, X.energy)
        || !Number.isInteger(action.faults) || action.faults < 0) return state;
      const fee = DATA.xcShows.classes[c].fee, { prize, seed } = showResult(state, h, action.faults, state.avatar.name, c, true);
      const ridden = { ...h, needs: { ...h.needs, energy: clamp(h.needs.energy - X.energy) } };
      const paid: State = { ...state, seed, lastXcShowDay: state.day, money: state.money - fee, horses: state.horses.map((x) => (x === h ? ridden : x)),
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
      if (!h || !own(h) || badgeWaits(state) || state.badgeQuizDay !== state.day || cantWork(h, J.energy) || !Number.isInteger(action.faults) || action.faults < 0) return state;
      const ridden = { ...h, needs: { ...h.needs, energy: clamp(h.needs.energy - J.energy) } };
      const passed = action.faults <= DATA.badge.maxFaults;
      return { ...state, horses: state.horses.map((x) => (x === h ? ridden : x)), badgeQuizDay: 0, badges: passed ? 1 : state.badges, badgeFailedDay: passed ? 0 : state.day };
    }
    case 'lesson': {
      const p = state.pupils.find((x) => x.id === action.pupil), h = state.horses.find((x) => x.id === action.horse);
      if (!p || !h || !own(h) || cantWork(h, DATA.lessons.energy)) return state;
      const { happy, pay: fee } = lessonOutcome(p, h), R = DATA.routine;
      // a horse the pupil got ready step by step (the care course): a tip and a little reputation, more without a wrong step
      const prep = action.prepared === undefined ? null : action.prepared === 0, pay = fee + (prep === null ? 0 : prep ? R.tipClean : R.tip);
      const worked = { ...h, needs: { ...h.needs, energy: clamp(h.needs.energy - DATA.lessons.energy) } };
      const after = earn({ ...state, today: [...state.today, { what: 'lesson', amount: pay }] }, pay);
      return {
        ...after, horses: state.horses.map((x) => (x === h ? worked : x)), pupils: state.pupils.filter((x) => x !== p), lessonsGiven: state.lessonsGiven + 1,
        reputation: clamp(state.reputation + (happy - DATA.lessons.happyAt) / 5 + (prep === null ? 0 : prep ? R.reputationClean : R.reputation)),
      };
    }
    case 'loan': {
      if (!canLoan(state)) return state;
      const a = DATA.loan.amount;
      return { ...state, money: state.money + a, debt: state.debt + a, today: [...state.today, { what: 'loan', amount: a }] };
    }
  }
}
