/**
 * The screens: start, farm map, stable, and the horse card. Each screen fills #app and stops its scene when the
 * next one starts. Screens only show the Sim state and send actions; the rules live in src/sim/.
 */
import credits from '../credits.json';
import { game } from '../game';
import { horseSheet } from '../horses/compose';
import { BREEDS, COATS } from '../horses/look';
import { startFarm } from '../scene';
import { bounds, type Plot, waitingSpots } from '../scene/buildings';
import { avatarKid, HAIR, HAIR_STYLES, JACKET, pupilKid, SKIN } from '../riders/look';
import { drawKid } from '../scene/kids';
import { startJumping } from '../scene/jumping';
import { courseFor, newRound, type Round, timeAllowed } from '../sim/round';
import { omaPortrait, portrait } from '../scene/oma';
import { PLOTS, PROPS } from '../scene/farm';
import { startStable } from '../scene/stable';
import { startStore } from '../scene/store';
import { parseSave } from '../sim/save';
import { DATA } from '../sim/data';
import { startCare } from '../scene/care';
import { allGoalsDone, type Avatar, badgeWaits, buildWaits, canInspect, type State, type Feature, goals, hint, quizScore, nextShowDay, showResult, classShut, classWaits, SHOW_CLASSES, type ShowClass, type ShowRow, showWaits, CARE, canBuild, canFeed, canLoan, canPayVet, canQuickCare, hayNights, cantWork, type Care, fit, hayOnCredit, type Horse, isSick, jumpWindow, lessonOutcome, mood, NEEDS, type News, type Pupil, stalls, takeOff } from '../sim/state';
import { readSlot, type Slot, slotKey, SLOTS, writeSlot } from '../slots';
import { t } from '../strings';
import { icon } from './icons';

const app = document.querySelector<HTMLElement>('#app')!;
const base = import.meta.env.BASE_URL;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${({ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' })[c]};`);
let leave = () => {};

/** Swaps the screen: stops the old one's scene and listeners, puts in the new markup. */
function screen(html: string) {
  leave();
  leave = () => {};
  app.innerHTML = `${html}<p class="rotate">${t.rotate}</p>`;
  return <T extends HTMLElement>(id: string) => app.querySelector<T>(`#${id}`)!;
}

const creditsSheet = () => `
  <section id="credits" class="overlay" hidden aria-labelledby="credits-title">
    <div class="sheet">
      <h2 id="credits-title">${t.creditsTitle}</h2>
      <p>${t.creditsIntro}</p>
      <ul>${credits.map((c) => `
        <li>
          <b>${esc(c.title)}</b><br>
          ${t.creditsBy}: ${esc(c.authors)}<br>
          ${t.creditsLicence}: <a href="${c.licenseUrl}" target="_blank" rel="noopener">${c.license}</a> ·
          <a href="${c.page}" target="_blank" rel="noopener">${t.creditsSource}</a>${c.creditsFile ? ` ·
          <a href="${base}${c.creditsFile}" target="_blank" rel="noopener">${t.creditsAll}</a>` : ''}
        </li>`).join('')}
      </ul>
      <button id="close-credits" type="button">${t.back}</button>
    </div>
  </section>`;

/** A yes/no question over the screen. */
function ask(question: string, yes: string): Promise<boolean> {
  const box = document.createElement('section');
  box.className = 'overlay';
  box.innerHTML = `<div class="sheet ask"><p>${esc(question)}</p><button type="button" data-a="yes">${yes}</button><button type="button" data-a="no">${t.no}</button></div>`;
  app.append(box);
  return new Promise((ok) => box.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.a;
    if (a) { box.remove(); ok(a === 'yes'); }
  }));
}

/**
 * A new game: the player makes their figure (name, skin, hair style and colour, jacket; the preview follows every
 * tap) and names the farm. Null if cancelled.
 */
function askNewGame(): Promise<{ farmName: string; avatar: Avatar } | null> {
  const box = document.createElement('section');
  const avatar: Avatar = { ...DATA.avatar };
  const swatches = (key: 'skin' | 'hairColor' | 'jacket', colours: string[]) => colours.map((c, i) =>
    `<button type="button" class="swatch" data-k="${key}" data-v="${i}" style="background:${c}" aria-label="${t.colour(t.looks[key], i + 1)}"></button>`).join('');
  box.className = 'overlay';
  box.innerHTML = `<form class="sheet editor"><h2>${t.whoAreYou}</h2>
    <div class="editor-body">
      <canvas class="preview" width="40" height="32" aria-hidden="true"></canvas>
      <div class="editor-fields">
        <label>${t.yourName} <input id="player-name" maxlength="20" autocomplete="off" placeholder="${DATA.avatar.name}" enterkeyhint="done"></label>
        <div class="choice" role="group" aria-label="${t.looks.skin}"><span>${t.looks.skin}</span>${swatches('skin', SKIN)}</div>
        <div class="choice" role="group" aria-label="${t.looks.hair}"><span>${t.looks.hair}</span>${HAIR_STYLES.map((h) =>
          `<button type="button" class="style" data-k="hair" data-v="${h}">${t.hairStyles[h]}</button>`).join('')}</div>
        <div class="choice" role="group" aria-label="${t.looks.hairColor}"><span>${t.looks.hairColor}</span>${swatches('hairColor', HAIR)}</div>
        <div class="choice" role="group" aria-label="${t.looks.jacket}"><span>${t.looks.jacket}</span>${swatches('jacket', JACKET)}</div>
        <label>${t.farmName} <input id="farm-name" maxlength="20" autocomplete="off" placeholder="${t.farmNameDefault}" enterkeyhint="done"></label>
      </div>
    </div>
    <div class="editor-buttons"><button type="button" data-a="no">${t.back}</button><button type="submit">${t.start}</button></div></form>`;
  app.append(box);
  const preview = box.querySelector('canvas')!, g = preview.getContext('2d')!;
  const show = () => {
    // the figure from the front and from the side; aria-pressed marks the current choices
    g.clearRect(0, 0, preview.width, preview.height);
    drawKid(g, avatarKid(avatar), 11, 30, 'S');
    drawKid(g, avatarKid(avatar), 29, 30, 'E');
    box.querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) => b.setAttribute('aria-pressed', String(String(avatar[b.dataset.k as keyof Avatar]) === b.dataset.v)));
  };
  box.querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.k as 'skin' | 'hair' | 'hairColor' | 'jacket';
    if (k === 'hair') avatar.hair = b.dataset.v as Avatar['hair']; else avatar[k] = Number(b.dataset.v);
    show();
  }));
  show();
  // the save allows 20 UTF-16 units; WebKit's maxlength counts emoji as one
  const field = (id: string) => box.querySelector<HTMLInputElement>(`#${id}`)!.value.trim().slice(0, 20);
  // Return on the iPad keyboard only closes it: the game starts with the Start button, after the figure is made
  box.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } }));
  return new Promise((ok) => {
    box.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault(); box.remove();
      ok({ farmName: field('farm-name') || t.farmNameDefault, avatar: { ...avatar, name: field('player-name') || DATA.avatar.name } });
    });
    box.querySelector('[data-a=no]')!.addEventListener('click', () => { box.remove(); ok(null); });
  });
}

const slotTitle = (slot: Slot) => slot.kind === 'save' ? esc(slot.save.name) : slot.kind === 'empty' ? t.slotEmpty : (slot.reason === 'newer' ? t.slotNewer : t.slotBroken);

export function showStart() {
  const slots = Array.from({ length: SLOTS }, (_, i) => readSlot(i));
  const $ = screen(`
    <canvas id="farm" aria-hidden="true"></canvas>
    <main class="start">
      <h1 class="plaque">${t.title}</h1>
      <div class="slots">${slots.map((slot, i) => `
        <section class="slot ${slot.kind}" aria-label="${t.slot(i + 1)}">
          <h2>${slotTitle(slot)}</h2>
          <p>${slot.kind === 'save' ? t.slotInfo(slot.save.state.day, slot.save.state.money) : '&nbsp;'}</p>
          ${slot.kind === 'save' ? `<button type="button" data-do="resume" data-slot="${i}">${t.resumeGame}</button>` : ''}
          <button type="button" data-do="new" data-slot="${i}" class="${slot.kind === 'save' ? 'small' : ''}">${t.newGame}</button>
          <span class="file-buttons">
            ${slot.kind === 'save' ? `<button type="button" class="small" data-do="export" data-slot="${i}">${t.exportSave}</button>` : ''}
            <button type="button" class="small" data-do="import" data-slot="${i}">${t.importSave}</button>
          </span>
        </section>`).join('')}
      </div>
      <input id="import-file" type="file" accept=".json,application/json" hidden>
      <button id="show-credits" class="small corner" type="button">${t.credits}</button>
    </main>
    <p id="toast" class="toast" role="status" hidden></p>
    ${creditsSheet()}`);
  const say = (text: string) => { const el = $('toast'); el.textContent = text; el.hidden = false; setTimeout(() => { el.hidden = true; }, 3000); };
  // overwriting a slot always asks first, so a save is never wiped by accident; the slot is read again here,
  // because another tab may have saved into it since this screen showed it
  const mayOverwrite = (i: number, yes: string) => {
    const slot = readSlot(i);
    return slot.kind === 'empty' ? Promise.resolve(true) : ask(slot.kind === 'save' ? t.overwrite(slot.save.name) : t.overwriteBroken, yes);
  };
  let importInto = 0;
  $('import-file').addEventListener('change', async () => {
    const input = $<HTMLInputElement>('import-file'), file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const parsed = parseSave(await file.text());
    if (!parsed.ok) return say(parsed.reason === 'newer' ? t.importNewer : t.importInvalid);
    if (!(await mayOverwrite(importInto, t.yesLoad))) return;
    if (!writeSlot(importInto, parsed.save)) return say(t.saveFailed);
    showStart();
  });
  app.querySelectorAll<HTMLButtonElement>('[data-do]').forEach((b) => b.addEventListener('click', async () => {
    const i = Number(b.dataset.slot), slot = slots[i];
    if (b.dataset.do === 'resume' && slot.kind === 'save') { game.resume(slot.save.state, i, slot.save.name); showFarm(); }
    if (b.dataset.do === 'new' && (await mayOverwrite(i, t.yesNew))) {
      const made = await askNewGame();
      if (made) { game.start(Date.now() % 100000, i, made.farmName, made.avatar); showFarm(true); }
    }
    if (b.dataset.do === 'export' && slot.kind === 'save') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(slot.save, null, 2)], { type: 'application/json' }));
      a.download = `hufgeklapper-${slot.save.name.replace(/[^\p{L}\p{N}]+/gu, '-')}-tag-${slot.save.state.day}.json`;
      a.click();
      // iPad Safari asks before it saves; the file must still be there when the child says yes
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    }
    if (b.dataset.do === 'import') { importInto = i; $<HTMLInputElement>('import-file').click(); }
  }));
  $('show-credits').addEventListener('click', () => { $('credits').hidden = false; });
  $('close-credits').addEventListener('click', () => { $('credits').hidden = true; });
  const farm = startFarm($<HTMLCanvasElement>('farm'));
  leave = () => { farm.then((f) => f.stop()); };
}

/** The top bar: money, day, sleep and the menu. */
function topBar() {
  return `
    <header class="topbar">
      <span class="stat farm-name">${esc(game.name())}</span>
      <span class="stat" id="money"><img class="icon" src="${icon('coin')}" alt="">${t.money(game.get().money)}</span>
      <span class="stat" id="hay"><img class="icon" src="${icon('feed')}" alt="">${t.hay(game.get().feed)}</span>
      <span class="stat" id="day">${t.day(game.get().day)}</span>
      <span class="spacer"></span>
      <button id="sleep" type="button"><img class="icon" src="${icon('moon')}" alt="">${t.sleep}</button>
      <button id="menu" type="button">${t.menu}</button>
    </header>
    <section id="menu-sheet" class="overlay" hidden>
      <div class="sheet menu">
        <button id="resume" type="button">${t.resume}</button>
        <button id="player" type="button">${t.playerCard}</button>
        <button id="to-start" type="button">${t.toStart}</button>
      </div>
    </section>
    <section id="player-card" class="overlay" hidden><div class="sheet ask player-card"></div></section>
    <div id="night" class="night" hidden><p></p></div>
    <section id="morning" class="overlay" hidden><div class="sheet ask"></div></section>
    <p id="toast" class="toast" role="status" hidden></p>`;
}

function wireTopBar($: ReturnType<typeof screen>, onChange: () => void) {
  $('sleep').addEventListener('click', () => {
    const night = $('night');
    night.querySelector('p')!.textContent = t.goodNight;
    night.hidden = false;
    setTimeout(() => {
      game.dispatch({ type: 'sleep' });
      night.querySelector('p')!.textContent = t.day(game.get().day);
      setTimeout(() => { night.hidden = true; morning(game.get().night); }, 900);
    }, 900);
  });
  // the morning summary: one short line per piece of news, then on with the day
  const nameOf = (id?: string) => esc(game.get().horses.find((h) => h.id === id)?.name ?? '');
  const line = (n: News) => n.kind === 'sick' ? t.newsSick(nameOf(n.horse)) : n.kind === 'rested' ? t.newsRested(nameOf(n.horse))
    : n.kind === 'hayLow' ? t.newsHayLow : n.kind === 'noHay' ? t.newsNoHay : '';
  function morning(news: News[]) {
    if (!news.length) return;
    const lines = [...new Set(news.filter((n) => n.kind !== 'bill').map(line))]; // "no hay" comes once per horse; say it once
    const bill = game.get().bill;
    if (bill.length) lines.push(`<b>${t.billTitle}</b> ${bill.map((e) => `${t.billWhat[e.what]} ${t.euros(e.amount)}`).join(' · ')}`);
    const box = $('morning');
    box.firstElementChild!.innerHTML = `<h2>${t.morning}</h2>${lines.map((l) => `<p>${l}</p>`).join('')}<button type="button">${t.morningGo}</button>`;
    box.hidden = false;
    box.querySelector('button')!.addEventListener('click', () => { box.hidden = true; });
  }
  $('menu').addEventListener('click', () => { $('menu-sheet').hidden = false; });
  $('resume').addEventListener('click', () => { $('menu-sheet').hidden = true; });
  $('to-start').addEventListener('click', showStart);
  // the player card: the figure, its name and the badges earned
  $('player').addEventListener('click', () => {
    const s = game.get(), card = $('player-card');
    card.firstElementChild!.innerHTML = `<h2>${t.playerCard}</h2><canvas class="preview" width="40" height="32" aria-hidden="true"></canvas>
      <p class="player-name"></p><h3>${t.badges}</h3>
      ${s.badges ? `<p class="badge"><img class="rosette" src="${icon('rosette')}" alt="">${t.badgeName}</p>` : `<p>${t.noBadges}</p>`}
      <button type="button" id="close-card">${t.close}</button>`;
    card.querySelector('.player-name')!.textContent = s.avatar.name;
    const g = card.querySelector('canvas')!.getContext('2d')!;
    drawKid(g, avatarKid(s.avatar), 11, 30, 'S'); drawKid(g, avatarKid(s.avatar), 29, 30, 'E');
    $('menu-sheet').hidden = true; card.hidden = false;
    $('close-card').addEventListener('click', () => { card.hidden = true; });
  });
  const unsubscribe = game.subscribe(() => {
    $('money').lastChild!.textContent = t.money(game.get().money);
    $('day').textContent = t.day(game.get().day);
    $('hay').lastChild!.textContent = t.hay(game.get().feed);
    onChange();
  });
  let timer = 0;
  const toast = (text: string) => {
    const el = $('toast');
    el.textContent = text; el.hidden = false;
    clearTimeout(timer); timer = window.setTimeout(() => { el.hidden = true; }, 2600);
  };
  game.onSaveFailed(() => toast(t.saveFailed));
  // the same slot played in another tab: this one goes back to the start rather than overwrite newer progress
  const elsewhere = (e: StorageEvent) => { if (e.key === slotKey(game.slot())) showStart(); };
  addEventListener('storage', elsewhere);
  return { unsubscribe: () => { unsubscribe(); removeEventListener('storage', elsewhere); }, toast };
}

/** Oma Hanne says something in her speech bubble; resolves when the child taps "Alles klar!". */
function omaSays(text: string): Promise<void> {
  const box = document.createElement('section');
  box.className = 'overlay talk';
  box.innerHTML = `<div class="sheet bubble"><img src="${omaPortrait()}" alt="${t.omaHanne}"><p aria-live="polite"></p><button type="button">${t.gotIt}</button></div>`;
  app.append(box);
  box.querySelector('p')!.textContent = text; // after attaching, so screen readers hear it
  return new Promise((done) => box.querySelector('button')!.addEventListener('click', () => { box.remove(); done(); }));
}

/** The first time the child opens a feature, Oma Hanne explains it in a sentence or two. */
async function explain(what: Feature) {
  if (game.get().explained.includes(what)) return;
  await omaSays(t.explain[what]);
  game.dispatch({ type: 'explained', what });
}

let goalsOpen = true; // the goal list is open until the child folds it away
let hintAway = ''; // the hint the child closed; it stays away until another one is due

/** The farm map; with `intro`, Oma Hanne first hands the farm over in a few speech bubbles. */
export function showFarm(intro = false) {
  const $ = screen(`<canvas id="farm" aria-label="${t.title}"></canvas><div id="labels" class="labels" hidden></div>${topBar()}
    <section id="shop" class="overlay" hidden><div class="sheet ask shop"></div></section>
    <section id="lesson" class="overlay" hidden><div class="sheet ask"></div></section>
    <aside class="goals"><button type="button" id="goals-toggle"></button><ul id="goal-list"></ul></aside>
    <aside id="hint" class="hint" hidden><img src="${omaPortrait()}" alt="${t.omaHanne}"><p role="status"></p>
      <button type="button" id="hint-close" aria-label="${t.closeHint}">×</button></aside>
    <section id="intro" class="overlay talk" hidden><div class="sheet bubble"><img src="${omaPortrait()}" alt="${t.omaHanne}"><p aria-live="polite"></p>
      <button type="button" id="intro-next">${t.next}</button></div></section>`);
  if (intro) {
    const s = game.get(), lines = t.intro(s.avatar.name, s.horses.map((h) => h.name));
    let i = 0;
    const say = () => { $('intro').querySelector('p')!.textContent = lines[i]; };
    $('intro-next').addEventListener('click', () => { if (++i < lines.length) say(); else $('intro').hidden = true; });
    say();
    $('intro').hidden = false;
  }
  const tap = (target: string) => {
    const s = game.get();
    if (target === 'stall') showStable();
    else if (target === 'board') explain('board').then(showShop);
    else if (target === 'arena') explain('arena').then(arena);
    else if (target === 'pasture') bar.toast(t.pasture);
    else if (target === 'feed') explain('store').then(showStore);
    else if (!canBuild(s)) bar.toast(t.freePlot);
    else if (s.built.stalls) showStable(); // the Offenstall is part of the stable
    else build('stalls', t.buildStalls(DATA.build.stalls.cost), t.builtStalls);
  };
  const bar = wireTopBar($, () => { if (!$('shop').hidden) shop(); pupils(); guide(); });
  /** The goal list (open or folded) and Oma Hanne's hint for now, at most one. */
  function guide() {
    const s = game.get(), list = goals(s), done = list.filter((g) => g.done).length;
    $('goals-toggle').textContent = t.goalsTitle(done, list.length);
    $('goals-toggle').setAttribute('aria-expanded', String(goalsOpen));
    $('goal-list').hidden = !goalsOpen;
    $('goal-list').innerHTML = list.map((g) => `<li class="${g.done ? 'done' : ''}">${t.goalText[g.id](g.need)}${g.need > 1 ? ` <span>${g.have}/${g.need}</span>` : ''}</li>`).join('')
      + (allGoalsDone(s) && list.length ? `<li class="all">${t.allGoals[s.stage]}</li>` : '')
      + (canInspect(s) ? `<li class="all"><button type="button" id="inspect">${t.startInspection}</button></li>`
        : s.stage === 'kleinerHof' && allGoalsDone(s) ? `<li class="all">${t.inspectionTomorrow}</li>` : '');
    $('goal-list').querySelector('#inspect')?.addEventListener('click', showInspection);
    const h = hint(s), name = (id: string) => s.horses.find((x) => x.id === id)?.name ?? '';
    const text = !h ? '' : h.kind === 'hay' ? t.hints.hay : t.hints[h.kind](name(h.horse));
    if (!text) hintAway = ''; // a closed hint comes back the next time it is due
    $('hint').hidden = !text || text === hintAway;
    if ($('hint').querySelector('p')!.textContent !== text) $('hint').querySelector('p')!.textContent = text; // read out once, not on every change
  }
  $('goals-toggle').addEventListener('click', () => { goalsOpen = !goalsOpen; guide(); });
  $('hint-close').addEventListener('click', () => { hintAway = $('hint').querySelector('p')!.textContent!; guide(); });
  guide();
  /** The arena: a lesson for the first waiting pupil, jumping practice, and the riding badge or, once passed, the show. */
  function arena() {
    const sheet = $('lesson'), s = game.get(), wait = badgeWaits(s), show = showWaits(s);
    const showWhy = show === 'notToday' ? t.showWaits.notToday(nextShowDay(s)) : show === 'money' ? t.showWaits.money(DATA.shows.classes.E.fee) : show && t.showWaits[show];
    sheet.firstElementChild!.innerHTML = `<h2>${t.places.arena}</h2>
      <button type="button" id="give-lesson">${t.giveLesson}</button><button type="button" id="practise">${t.practiseJumping}</button>
      ${wait?.why === 'passed' ? `<button type="button" id="show"${show ? ' disabled aria-describedby="show-why"' : ''}>${t.show}</button>${showWhy ? `<p class="oma" id="show-why">${showWhy}</p>` : ''}`
        : `<button type="button" id="badge"${wait ? ' disabled aria-describedby="badge-why"' : ''}>${t.ridingBadge}</button>
      ${wait ? `<p class="oma" id="badge-why">${wait.why === 'practise' ? t.badgeWaits.practise(wait.rounds) : t.badgeWaits[wait.why]}</p>` : ''}`}
      ${s.stage === 'reitschule' && !s.built.arena ? `<button type="button" id="upgrade">${t.upgradeArena(DATA.build.arena.cost)}</button>` : ''}
      <button type="button" id="close-lesson">${t.close}</button>`;
    sheet.querySelector('#badge')?.addEventListener('click', showBadge);
    sheet.querySelector('#upgrade')?.addEventListener('click', () => build('arena', t.upgradeArena(DATA.build.arena.cost), t.builtArena));
    sheet.querySelector('#show')?.addEventListener('click', enterShow);
    $('give-lesson').addEventListener('click', () => {
      const p = game.get().pupils[0];
      if (p) chooseHorse(p); else { sheet.hidden = true; bar.toast(t.noPupils); }
    });
    $('practise').addEventListener('click', () => pickHorse(t.whichHorse, (id) => showJumping(id)));
    $('close-lesson').addEventListener('click', () => { sheet.hidden = true; });
    sheet.hidden = false;
  }
  /**
   * A show: the class first, once a horse may start higher than E (each class says why not, if it can't), then the horse.
   * While only E is open, straight to the horse, with a word on what practice opens.
   */
  function enterShow() {
    const s = game.get(), C = DATA.shows.classes, ride = (c: ShowClass, title: string, note?: string) =>
      pickHorse(title, (id) => showJumping(id, 'show', c), (h) => (classWaits(s, h, c) === 'skill' ? t.notSkilled : null), note);
    if (SHOW_CLASSES.slice(1).every((c) => classShut(s, c) === 'skill')) return ride('E', t.showEnter(C.E.fee), t.classesLater);
    const sheet = $('lesson');
    sheet.firstElementChild!.innerHTML = `<h2>${t.whichClass}</h2><p class="oma">${t.classesHow}</p>
      ${SHOW_CLASSES.map((c) => {
        const w = classShut(s, c);
        return `<button type="button" data-class="${c}"${w ? ' disabled' : ''}>${t.showClass(c, C[c].fee, C[c].prizes[0])}${w ? ` · ${t.classWaits[w]}` : ''}</button>`;
      }).join('')}
      <button type="button" id="close-lesson">${t.close}</button>`;
    sheet.querySelectorAll<HTMLButtonElement>('[data-class]').forEach((b) => b.addEventListener('click', () => {
      const c = b.dataset.class as ShowClass;
      ride(c, t.showEnterClass(c, C[c].fee));
    }));
    $('close-lesson').addEventListener('click', () => { sheet.hidden = true; });
  }
  /** Pick a horse for a jumping round; each one too tired, resting or sick (or not allowed, by `not`) says so. */
  function pickHorse(title: string, go: (id: string) => void, not?: (h: Horse) => string | null, note?: string) {
    const sheet = $('lesson');
    sheet.firstElementChild!.innerHTML = `<h2>${title}</h2>${note ? `<p class="oma">${note}</p>` : ''}
      ${game.get().horses.map((h) => {
        const tired = cantWork(h, DATA.jumping.energy), why = tired ? t.cantWork[tired] : not?.(h);
        return `<button type="button" data-horse="${h.id}"${why ? ' disabled' : ''}>${esc(h.name)}${why ? ` · ${why}` : ''}</button>`;
      }).join('')}
      <button type="button" id="close-lesson">${t.close}</button>`;
    sheet.querySelectorAll<HTMLButtonElement>('[data-horse]').forEach((b) => b.addEventListener('click', () => go(b.dataset.horse!)));
    $('close-lesson').addEventListener('click', () => { sheet.hidden = true; });
  }
  /** A pupil wants a lesson: pick a horse; each shows how well it fits, or why it can't. */
  function chooseHorse(p: Pupil) {
    const s = game.get(), sheet = $('lesson');
    sheet.firstElementChild!.innerHTML = `<h2>${t.pupilWants(esc(p.name))}</h2>
      <p>${t.pupilKind(p.size === 'small', p.level === 'advanced')}</p>
      ${s.horses.map((h) => {
        const why = cantWork(h, DATA.lessons.energy);
        return `<button type="button" data-horse="${h.id}"${why ? ' disabled' : ''}>${esc(h.name)} · ${why ? t.cantWork[why] : t.fits[fit(p, h)]}</button>`;
      }).join('')}
      <button type="button" id="close-lesson">${t.close}</button>`;
    sheet.querySelectorAll<HTMLButtonElement>('[data-horse]').forEach((b) => b.addEventListener('click', () => {
      const before = game.get(), i = before.horses.findIndex((h) => h.id === b.dataset.horse), h = before.horses[i];
      const { pay, happy } = lessonOutcome(p, h);
      sheet.hidden = true;
      game.dispatch({ type: 'lesson', pupil: p.id, horse: h.id });
      if (game.get().lessonsGiven === before.lessonsGiven) return; // the Sim said no (the pupil or horse changed meanwhile)
      const repaid = before.debt - game.get().debt;
      bar.toast(t.lessonRuns(p.name, h.name));
      farm.then((f) => f.lesson(i, pupilKid(p))).then(() => bar.toast(t.lessonDone(p.name, mood(happy), pay, repaid)));
    }));
    $('close-lesson').addEventListener('click', () => { sheet.hidden = true; });
    sheet.hidden = false;
  }
  /** The notice board: buy hay (on credit when the money is short) and borrow from the bank. */
  function shop() {
    const s = game.get();
    $('shop').firstElementChild!.innerHTML = `<h2>${t.shopTitle}</h2>
      ${s.debt ? `<p>${t.owe(s.debt)}</p>` : ''}
      ${s.badges ? `<p class="calendar">${t.nextShow(nextShowDay(s), nextShowDay(s) === s.day)}</p>` : ''}
      ${s.money < DATA.vet.cost && canLoan(s) ? `<button type="button" id="loan">${t.loan(DATA.loan.amount)}</button><p class="oma">${t.omaLoan}</p>` : ''}
      ${s.stage === 'reitschule' ? `<h3>${t.market}</h3>${s.market.length ? s.market.map((o) => {
        const full = s.horses.length >= stalls(s), poor = s.money < o.price;
        return `<button type="button" data-offer="${o.id}"${full || poor ? ' disabled' : ''}>${t.offer(esc(o.name), o.look.build === 'pony', BREEDS[o.breed].label, COATS[o.look.coat].label, o.price)}${!full && poor ? ` · ${t.tooExpensive}` : ''}</button>`;
      }).join('') + (s.horses.length >= stalls(s) ? `<p class="oma">${s.built.stalls ? t.stallsFull : t.noStall}</p>` : '') : `<p>${t.marketEmpty}</p>`}` : ''}
      <button type="button" id="close-shop">${t.close}</button>`;
    $('shop').querySelectorAll<HTMLButtonElement>('[data-offer]').forEach((b) => b.addEventListener('click', () => {
      const o = game.get().market.find((x) => x.id === b.dataset.offer);
      if (!o) return;
      game.dispatch({ type: 'buyHorse', offer: o.id });
      if (game.get().horses.some((h) => h.id === o.id)) { showFarm(); omaSays(t.boughtHorse(o.name)); } // the new horse joins the herd on the map
    }));
    $('shop').querySelector('#loan')?.addEventListener('click', () => { game.dispatch({ type: 'loan' }); bar.toast(t.lent(DATA.loan.amount)); });
    $('close-shop').addEventListener('click', () => { $('shop').hidden = true; });
  }
  function showShop() { shop(); $('shop').hidden = false; }
  /** Builds on a plot after asking: the price and what it brings, or why not now; the map shows it at once. */
  function build(what: 'stalls' | 'arena', label: string, built: string) {
    const sheet = $('lesson'), why = buildWaits(game.get(), what);
    sheet.firstElementChild!.innerHTML = `<p>${t.brings[what]}</p><button type="button" id="do-build"${why ? ' disabled aria-describedby="build-why"' : ''}>${label}</button>
      ${why ? `<p class="oma" id="build-why">${t.buildWaits[why]}</p>` : ''}<button type="button" id="close-lesson">${t.close}</button>`;
    $('do-build').addEventListener('click', () => { game.dispatch({ type: 'build', what }); showFarm(); omaSays(built); });
    $('close-lesson').addEventListener('click', () => { sheet.hidden = true; });
    sheet.hidden = false;
  }
  // labels on the places: [id, world x, world y]
  const board = PROPS.find(([n]) => n === 'board')!;
  const places: [string, number, number][] = [
    ...PLOTS.map((p): [string, number, number] => {
      const b = bounds(p);
      return [p.id, (b.x0 + b.x1) / 2, p.id === 'stall' ? b.y1 - 20 : p.id === 'arena' ? b.y1 - 4 : (b.y0 + b.y1) / 2];
    }),
    ['board', board[1], board[2] - 36],
  ];
  const labels = $('labels');
  labels.innerHTML = places.map(([id, x, y]) => `<button class="label" type="button" data-place="${id}" data-x="${x}" data-y="${y}">${id === 'free' && game.get().built.stalls ? t.shelter : t.places[id] ?? id}</button>`).join('')
    + '<span id="pupils"></span>';
  labels.querySelectorAll<HTMLButtonElement>('[data-place]').forEach((b) => b.addEventListener('click', () => tap(b.dataset.place!)));
  /** Puts every label over its world point, centred (set here, not with a CSS transform: WebKit then misses taps on it). */
  const place = () => farm.then((f) => {
    labels.hidden = false; // shown once placed, not stacked in a corner while the farm loads
    const placed: HTMLElement[] = [];
    labels.querySelectorAll<HTMLElement>('[data-x]').forEach((el) => {
      const p = f.toScreen(Number(el.dataset.x), Number(el.dataset.y));
      let left = p.left - el.offsetWidth / 2, top = p.top - el.offsetHeight / 2;
      // labels grow with the interface, the map with the screen: one that would overlap a placed one moves below it
      for (const o of placed) {
        const ol = parseFloat(o.style.left), ot = parseFloat(o.style.top);
        if (left < ol + o.offsetWidth && ol < left + el.offsetWidth && top < ot + o.offsetHeight && ot < top + el.offsetHeight) top = ot + o.offsetHeight + 2;
      }
      el.style.left = `${left}px`; el.style.top = `${top}px`;
      placed.push(el);
    });
  });
  const spots = waitingSpots(PLOTS.find((p) => p.building === 'arena')!);
  /** The waiting pupils, on the map and as name labels above their heads; which horses are on the pasture. */
  function pupils() {
    const waiting = game.get().pupils.slice(0, spots.length);
    $('pupils').innerHTML = waiting.map((p, i) =>
      `<button class="label pupil" type="button" data-pupil="${p.id}" data-x="${spots[i][0]}" data-y="${spots[i][1] - 34}">${esc(p.name)}</button>`).join('');
    $('pupils').querySelectorAll<HTMLButtonElement>('[data-pupil]').forEach((b) => b.addEventListener('click', () => {
      const p = game.get().pupils.find((x) => x.id === b.dataset.pupil);
      if (p) explain('arena').then(() => chooseHorse(p));
    }));
    // sick horses, and those resting after the vet, stay in the stable, off the pasture
    const inStall = game.get().horses.flatMap((h, i) => (isSick(h) || h.rest ? [i] : []));
    farm.then((f) => { f.setPupils(waiting.map(pupilKid)); f.setAway(inStall); });
    place();
  }
  const farm = startFarm($<HTMLCanvasElement>('farm'), {
    herd: game.get().horses.map((h) => h.look), canter: false, onTap: tap, onLayout: place, plots: farmPlots(game.get()),
  });
  pupils();
  leave = () => { bar.unsubscribe(); farm.then((f) => f.stop()); };
}

/** A jumping round: practice, the badge's round (after its quiz), or a show. */
function showJumping(id: string, kind: 'train' | 'badge' | 'show' = 'train', showClass: ShowClass = 'E') {
  const h = game.get().horses.find((x) => x.id === id)!;
  const $ = screen(`<canvas id="jumping" aria-label="${kind === 'show' ? t.showClassName(showClass) : kind === 'badge' ? t.ridingBadge : t.practiseJumping}"></canvas>
    <section id="jump-start" class="overlay talk"><div class="sheet bubble"><img src="${omaPortrait()}" alt="${t.omaHanne}"><p>${t.jumpHow(h.look.build === 'pony')}</p>
      <div class="answers"><button type="button" id="jump-go">${t.go}</button><button type="button" id="jump-leave">${t.back}</button></div></div></section>
    <p id="jump-hud" class="jump-hud" aria-live="off"></p>
    <section id="jump-end" class="overlay" hidden><div class="sheet ask"><p role="status"></p><button type="button" id="jump-back">${t.toFarm}</button></div></section>`);
  // practice and the riding badge ride the E course, a show its class's
  const course = courseFor(kind, showClass), allowed = timeAllowed(course);
  const hud = (r: Round) => { $('jump-hud').textContent = t.jumpHud(Math.min(r.next + 1, course.jumps.length), course.jumps.length, r.faults, Math.floor(r.t), allowed); };
  const round = startJumping($<HTMLCanvasElement>('jumping'), {
    look: h.look, kid: avatarKid(game.get().avatar), course, window: jumpWindow(h), judge: (o) => takeOff(h, o), onChange: hud,
  });
  hud(newRound(course));
  // on the arena a tap is "Hopp!" (the scene); on a keyboard the space bar is too, unless a button has the focus
  const key = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || e.target instanceof HTMLButtonElement) return;
    e.preventDefault(); round.then((r) => r.hopp());
  };
  addEventListener('keydown', key);
  // two fingers on the arena must not zoom the page (iPadOS pinches even over touch-action: none)
  const noZoom = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', noZoom);
  $('jump-go').addEventListener('click', async () => { // once: a second click (or the space bar) must not ride it again
    $('jump-start').hidden = true;
    const faults = await (await round).run(), end = $('jump-end');
    if (kind === 'show') {
      // the podium: the first three on their steps, then everyone with their points
      const s = game.get(), { table, rank, prize } = showResult(s, s.horses.find((x) => x.id === id)!, faults, s.avatar.name, showClass);
      game.dispatch({ type: 'show', horse: id, faults, showClass });
      if (game.get().lastShowDay !== s.day) return showFarm(); // the Sim said no: no podium for a show not ridden
      const row = (r: ShowRow) => `<b>${esc(r.rider)}</b><span>${esc(r.horse)}</span>`;
      end.querySelector('p')!.insertAdjacentHTML('beforebegin', `<h2>${t.podium}</h2>
        <div class="podium">${[1, 0, 2].map((i) => table[i] ? `<div class="step p${i + 1}${table[i].you ? ' you' : ''}">${row(table[i])}<i>${i + 1}</i></div>` : '').join('')}</div>
        <ol class="ranking">${table.map((r) => `<li${r.you ? ' class="you"' : ''}>${row(r)} · ${t.points(r.score)}</li>`).join('')}</ol>`);
      end.querySelector('p')!.textContent = t.showPlace(rank, prize);
    } else if (kind === 'badge') {
      game.dispatch({ type: 'badge', horse: id, faults });
      const passed = game.get().badges >= 1;
      // the ceremony: the big rosette over the congratulations
      if (passed) end.querySelector('p')!.insertAdjacentHTML('beforebegin', `<img class="rosette big" src="${icon('rosette')}" alt="${t.badgeName}">`);
      end.querySelector('p')!.textContent = passed ? t.badgePassed : t.badgeFailed;
    } else {
      const practising = badgeWaits(game.get())?.why === 'practise';
      game.dispatch({ type: 'train', horse: id, faults });
      // Oma Hanne points to the badge once the practice is enough
      const ready = practising && !badgeWaits(game.get()) ? ` ${t.badgeReady}` : '';
      end.querySelector('p')!.textContent = (faults ? t.jumpFaults(faults, h.name) : t.jumpClear(h.name)) + ready;
    }
    end.hidden = false;
  }, { once: true });
  $('jump-back').addEventListener('click', () => showFarm());
  $('jump-leave').addEventListener('click', () => showFarm());
  leave = () => { removeEventListener('keydown', key); document.removeEventListener('gesturestart', noZoom); round.then((r) => r.stop()); };
}

/**
 * Riding badge 1: Oma Hanne asks five care questions (the answers in turn order, the right one not always first),
 * then the player picks a horse for the jumping round.
 */
function showBadge() {
  quizScreen('oma', t.badgeIntro, t.quiz, (picked, ui) => {
    game.dispatch({ type: 'badgeQuiz', answers: picked });
    const s = game.get(), right = quizScore(picked);
    if (s.badgeQuizDay !== s.day) return ui.end(t.quizFailed(right));
    ui.say(t.quizDone(right));
    ui.buttons(game.get().horses.map((h) => {
      const why = cantWork(h, DATA.jumping.energy);
      return `<button type="button" data-horse="${h.id}"${why ? ' disabled' : ''}>${esc(h.name)}${why ? ` · ${t.cantWork[why]}` : ''}</button>`;
    }).join('') + `<button type="button" data-back>${t.back}</button>`, (b) => (b.dataset.horse ? showJumping(b.dataset.horse, 'badge') : showFarm()));
  });
}

/** The farm inspection: Frau Berger asks five questions; enough right ones make the farm a Reitschule. */
function showInspection() {
  quizScreen('inspector', t.inspectionIntro, t.inspectionQuiz, (picked, ui) => {
    game.dispatch({ type: 'inspection', answers: picked });
    ui.end(game.get().stage === 'reitschule' ? t.inspectionPassed : t.inspectionFailed(quizScore(picked)));
  });
}

/**
 * A quiz in a speech bubble over the farm: the speaker asks each question (the answers in turn order, so the right
 * one, first in the data, moves around), says right or wrong, then hands the chosen answers to `done`.
 */
function quizScreen(who: 'oma' | 'inspector', intro: string, questions: { q: string; a: { text: string; icon?: Parameters<typeof icon>[0] }[] }[],
  done: (picked: number[], ui: { say: (text: string) => void; buttons: (html: string, on: (b: HTMLButtonElement) => void) => void; end: (text: string) => void }) => void) {
  const $ = screen(`<canvas id="farm" aria-hidden="true"></canvas>
    <section class="overlay talk"><div class="sheet bubble"><img src="${portrait(who)}" alt="${who === 'oma' ? t.omaHanne : t.inspector}"><p aria-live="polite"></p>
      <div class="answers"></div></div></section>`);
  const farm = startFarm($<HTMLCanvasElement>('farm'), { herd: game.get().horses.map((h) => h.look), canter: false, plots: farmPlots(game.get()) });
  leave = () => { farm.then((f) => f.stop()); };
  const say = $('farm').nextElementSibling!.querySelector('p')!, answers = $('farm').nextElementSibling!.querySelector<HTMLElement>('.answers')!;
  const picked: number[] = [];
  const buttons = (html: string, on: (b: HTMLButtonElement) => void) => {
    answers.innerHTML = html;
    answers.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => on(b)));
    // new buttons land where the old ones were: a quick second tap must not answer the next question unread
    answers.inert = true;
    setTimeout(() => { answers.inert = false; answers.querySelector('button')?.focus(); }, 400);
  };
  const next = (go: () => void) => buttons(`<button type="button">${t.next}</button>`, go);
  function ask(i: number) {
    if (i === questions.length) return done(picked, {
      say: (text) => { say.textContent = text; }, buttons,
      end: (text) => { say.textContent = text; buttons(`<button type="button">${t.toFarm}</button>`, () => showFarm()); },
    });
    const q = questions[i], order = q.a.map((_, k) => (k + i) % q.a.length);
    say.textContent = q.q;
    buttons(order.map((k) => `<button type="button" data-a="${k}">${q.a[k].icon ? `<img class="icon" src="${icon(q.a[k].icon!)}" alt="">` : ''}${q.a[k].text}</button>`).join(''), (b) => {
      picked.push(Number(b.dataset.a)); // shown right or wrong here; the Sim scores the answers itself
      say.textContent = b.dataset.a === '0' ? t.quizRight : t.quizWrong(q.a[0].text);
      next(() => ask(i + 1));
    });
  }
  say.textContent = intro;
  next(() => ask(0));
}

/** The farm's plots as built: the shelter on the free plot, the arena's upgrade, the Reitschule's pennants. */
const farmPlots = (s: State): Plot[] => PLOTS.map((p) => p.id === 'free' && s.built.stalls ? { ...p, building: 'shelter' }
  : p.id === 'arena' ? { ...p, level: s.built.arena, flags: s.stage === 'reitschule' } : p);

/** One need as icon + bar; the bar is green, yellow or red by how full it is. */
const needBar = (h: Horse, n: (typeof NEEDS)[number], withLabel = false) => {
  const v = h.needs[n], level = v >= 60 ? 'good' : v >= 30 ? 'low' : 'bad';
  return `<div class="need" title="${t.needs[n]}"><img class="icon" src="${icon(n)}" alt="${t.needs[n]}">${withLabel ? `<span>${t.needs[n]}</span>` : ''}
    <span class="bar ${level}" role="meter" aria-label="${t.needs[n]}" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100"><i style="width:${v}%"></i></span></div>`;
};

export function showStable() {
  const s = game.get();
  const $ = screen(`<canvas id="stable" aria-hidden="true"></canvas><div id="boxes" hidden></div>${topBar()}
    <button id="to-farm" class="corner" type="button">${t.toFarm}</button>
    <section id="card" class="overlay" hidden></section>`);
  const boxes = $('boxes');
  explain('stable');
  const render = () => {
    const st = game.get();
    boxes.innerHTML = Array.from({ length: stalls(st) }, (_, i) => {
      const h = st.horses[i];
      return h
        ? `<div class="box" data-box="${i}"><button class="nameplate${isSick(h) ? ' sick' : ''}" type="button" data-horse="${h.id}">${esc(h.name)}</button>
            <button class="horse-hit" type="button" data-horse="${h.id}" aria-label="${esc(h.name)}"></button>
            <div class="needs">${NEEDS.map((n) => needBar(h, n)).join('')}</div></div>`
        : `<div class="box" data-box="${i}"><span class="nameplate empty">${t.freeStall}</span></div>`;
    }).join('');
    boxes.querySelectorAll<HTMLButtonElement>('[data-horse]').forEach((b) => b.addEventListener('click', () => showCard(b.dataset.horse!)));
    place();
  };
  const bar = wireTopBar($, render);
  $('to-farm').addEventListener('click', () => showFarm());
  const scene = startStable($<HTMLCanvasElement>('stable'), { horses: s.horses.map((h) => h.look), stalls: stalls(s), onLayout: () => place() });
  function place() {
    scene.then((sc) => {
      boxes.querySelectorAll<HTMLElement>('.box').forEach((el, i) => {
        const b = sc.box(i);
        el.style.left = `${b.left}px`; el.style.width = `${b.width}px`;
        el.style.setProperty('--door', `${b.doorTop}px`); el.style.setProperty('--below', `${b.below}px`); el.style.setProperty('--top', `${b.horseTop}px`);
      });
      boxes.hidden = false; // shown once placed, not stacked in a corner while the scene loads
    });
  }
  function showCard(id: string) {
    const h = game.get().horses.find((x) => x.id === id)!, card = $('card');
    card.innerHTML = `<div class="sheet horse-card">
      <canvas id="portrait" width="96" height="72"></canvas>
      <form id="rename" class="rename"><h2>${esc(h.name)}</h2><button type="button" id="rename-start" class="small">${t.rename}</button></form>
      <p>${BREEDS[h.breed].label} · ${COATS[h.look.coat].label}</p>
      ${NEEDS.map((n) => needBar(h, n, true)).join('')}
      <div class="need"><img class="icon" src="${icon('energy')}" alt=""><span>${t.jumping}</span><span class="bar skill"><i style="width:${h.skills.jumping}%"></i></span></div>
      <p class="status ${isSick(h) ? 'sick' : ''}">${isSick(h) ? t.sick(esc(h.name)) : h.rest ? t.resting(esc(h.name)) : t.healthy(esc(h.name))}</p>
      ${!isSick(h) ? '' : canPayVet(game.get()) ? `<button id="vet" type="button">${t.callVet(DATA.vet.cost)}</button>` : `<p>${t.vetTooExpensive(DATA.vet.cost)} ${t.askBank}</p>`}
      <button id="care" type="button">${t.care}</button>
      <button id="close-card" type="button">${t.close}</button></div>`;
    card.hidden = false;
    horseSheet(h.look, 'idle').then((sheet) => $<HTMLCanvasElement>('portrait').getContext('2d')!.drawImage(sheet, 128 + 16, 30, 96, 72, 0, 0, 96, 72));
    $('close-card').addEventListener('click', () => { card.hidden = true; });
    $('care').addEventListener('click', () => showCare(h.id));
    card.querySelector('#vet')?.addEventListener('click', () => { game.dispatch({ type: 'vet', horse: h.id }); showCard(h.id); });
    // a name of its own: the field replaces the heading; the Sim says no to an empty or taken name
    $('rename-start').addEventListener('click', () => {
      const form = $<HTMLFormElement>('rename');
      form.innerHTML = `<input id="horse-name" maxlength="${DATA.horseName.max}" autocomplete="off" enterkeyhint="done" aria-label="${t.newName}">
        <button type="submit" class="small">${t.done}</button><p class="oma" id="rename-why" hidden>${t.nameTaken}</p>`;
      const field = $<HTMLInputElement>('horse-name');
      field.value = h.name; field.focus(); field.select();
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = field.value.trim();
        if (name && name !== h.name) game.dispatch({ type: 'rename', horse: h.id, name });
        if (name && game.get().horses.find((x) => x.id === h.id)!.name !== name) { $('rename-why').hidden = false; return; }
        render(); showCard(h.id); // the nameplate and the card show the new name
      });
    });
  }
  render();
  leave = () => { bar.unsubscribe(); scene.then((sc) => sc.stop()); };
}

/** The feed store: the bales in stock as a stack, how long they last, and buying hay (on credit when money is short). */
export function showStore() {
  const $ = screen(`<canvas id="store" aria-hidden="true"></canvas>${topBar()}
    <aside class="sheet store-panel"><h2>${t.places.feed}</h2><p id="stock" role="status"></p><h3>${t.buyHay}</h3><div id="packs" class="answers"></div>
      <p class="oma" id="credit" hidden>${t.omaCredit}</p><button type="button" id="to-farm">${t.toFarm}</button></aside>`);
  const scene = startStore($<HTMLCanvasElement>('store'), { bales: game.get().feed });
  const render = () => {
    const s = game.get();
    $('stock').textContent = t.stock(s.feed, hayNights(s));
    $('packs').innerHTML = DATA.hayPacks.map((p, i) => `<button type="button" data-pack="${i}">${hayOnCredit(s, i) ? t.hayPackCredit(p.bales, p.price) : t.hayPack(p.bales, p.price)}</button>`).join('');
    $('credit').hidden = !DATA.hayPacks.some((_, i) => hayOnCredit(s, i));
    $('packs').querySelectorAll<HTMLButtonElement>('[data-pack]').forEach((b) => b.addEventListener('click', () => {
      game.dispatch({ type: 'buyHay', pack: Number(b.dataset.pack) });
      bar.toast(t.bought(DATA.hayPacks[Number(b.dataset.pack)].bales));
    }));
    scene.then((sc) => sc.set(s.feed)); // the bales just bought drop onto the stack
  };
  const bar = wireTopBar($, render);
  $('to-farm').addEventListener('click', () => showFarm());
  render();
  leave = () => { bar.unsubscribe(); scene.then((sc) => sc.stop()); };
}

/** Caring for one horse: a close-up with four tools; each finished gesture is a care action in the Sim. */
export function showCare(id: string) {
  const h = game.get().horses.find((x) => x.id === id)!;
  const $ = screen(`<canvas id="care-scene" aria-hidden="true"></canvas>${topBar()}
    <h2 class="care-title">${t.careTitle(esc(h.name))}</h2>
    <p id="how" class="how"></p>
    <nav class="tools">${CARE.map((c) => `<span class="tool">
      <button type="button" data-tool="${c}" aria-pressed="false"><img class="icon" src="${icon(c)}" alt="">${t.tools[c]}</button>
      <button type="button" class="small quick" data-quick="${c}" hidden>${t.quickCare}</button></span>`).join('')}
    </nav>
    <button id="to-stable" class="corner" type="button">${t.toStable}</button>`);
  const bar = wireTopBar($, () => tools());
  explain('care');
  const scene = startCare($<HTMLCanvasElement>('care-scene'), {
    look: h.look, dirt: (100 - h.needs.clean) / 100, cared: h.cared,
    onDone: (what) => { game.dispatch({ type: 'care', horse: id, what }); bar.toast(t.doneCare[what](h.name)); tools(); },
  });
  // what this horse already had today comes from the Sim (once a day each)
  const cared = () => game.get().horses.find((x) => x.id === id)!.cared;
  let current: Care = 'groom';
  function pick(what: Care) {
    if (what === 'feed' && !canFeed(game.get())) return bar.toast(t.noHayLeft);
    current = what;
    scene.then((sc) => sc.setTool(what));
    $('how').textContent = t.how[what];
    tools();
  }
  function tools() {
    const s = game.get();
    app.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => {
      const c = b.dataset.tool as Care;
      b.setAttribute('aria-pressed', String(c === current));
      b.classList.toggle('done', cared().includes(c));
    });
    app.querySelectorAll<HTMLButtonElement>('[data-quick]').forEach((b) => {
      const c = b.dataset.quick as Care;
      b.hidden = cared().includes(c) || !canQuickCare(s, c) || (c === 'feed' && !canFeed(s));
    });
  }
  app.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.tool as Care)));
  app.querySelectorAll<HTMLButtonElement>('[data-quick]').forEach((b) => b.addEventListener('click', () => {
    const what = b.dataset.quick as Care;
    game.dispatch({ type: 'care', horse: id, what, quick: true });
    scene.then((sc) => sc.skip(what));
    bar.toast(t.doneCare[what](h.name)); tools();
  }));
  $('to-stable').addEventListener('click', showStable);
  pick('groom');
  leave = () => { bar.unsubscribe(); scene.then((sc) => sc.stop()); };
}
