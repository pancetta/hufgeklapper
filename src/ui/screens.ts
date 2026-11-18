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
import { courseFor } from '../sim/courses';
import { newRound, type Round, timeAllowed } from '../sim/round';
import { omaPortrait, portrait } from '../scene/oma';
import { PLOTS, PROPS, WORLD } from '../scene/farm';
import { startStable } from '../scene/stable';
import { startStore } from '../scene/store';
import { parseSave } from '../sim/save';
import { DATA } from '../sim/data';
import { startCare } from '../scene/care';
import { startRoutine } from '../scene/routine';
import { startCrossCountry } from '../scene/xc';
import { startPasture } from '../scene/pasture';
import { newXcRound, PACES, type Pace, type XcRound, xcCourse } from '../sim/xc';
import { finished, GESTURE, nextStep, type Spot, STEPS, type StepId, type Thing, THINGS, tryStep, WALK } from '../sim/routine';
import { allGoalsDone, type Avatar, badgeWaits, buildWaits, canInspect, type State, type Feature, goals, hint, quizScore, scope, topClass, fitsNone, lessonChoices, nextShowDay, showResult, classShut, classWaits, SHOW_CLASSES, type ShowClass, type ShowRow, showWaits, CARE, canBuild, canFeed, canLoan, canRepay, canPayVet, canQuickCare, hayNights, cantWork, type Care, hayOnCredit, hayWaits, type Horse, isSick, jumpWindow, lessonOutcome, mood, NEEDS, type News, type Pupil, stalls, takeOff, holdNeed, faultWhy, dayMoney, type Entry, atLeast, nextStage, own, gameOver, xcScope, xcWindow, xcDrain, gained, noRoom, pasture, grazing, badge2Waits, nextXcShowDay, xcShowWaits, xcClassShut, xcClassWaits, salePrice, saleWaits, saleAdvice, answerOrder, bestRider } from '../sim/state';
import { readSlot, type Slot, slotKey, SLOTS, writeSlot } from '../slots';
import { t } from '../strings';
import { icon } from './icons';

const app = document.querySelector<HTMLElement>('#app')!;
const base = import.meta.env.BASE_URL;
const howList = (lines: string[]) => lines.map((l) => `<li>${l}</li>`).join('');
/**
 * The whole screen without Safari's bars (#89): the Fullscreen API where the browser has it (iPadOS Safari does, for
 * any element), else a tip to start the game from the Home Screen. Nothing when it already runs from there.
 */
const fullscreen = {
  standalone: () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
  api: () => { const d = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }; return d.requestFullscreen ? () => d.requestFullscreen().catch(() => {}) : d.webkitRequestFullscreen ? () => d.webkitRequestFullscreen!() : null; },
  on: () => !!(document.fullscreenElement || (document as { webkitFullscreenElement?: Element }).webkitFullscreenElement),
  /** Into the whole screen (Safari's own button leads out again); a refusal just does nothing. */
  enter() { try { this.api()?.(); } catch { /* refused: nothing happens */ } },
  /** The button (or the Home Screen tip) for a screen; empty when already standalone or in the whole screen. */
  html: (id: string) => fullscreen.standalone() || fullscreen.on() ? '' : fullscreen.api() ? `<button id="${id}" type="button" class="small">${t.fullscreen}</button>` : `<p class="tip">${t.homeScreenTip}</p>`,
};

/** A horse as a card on the notice board (#102): its picture, name, price big, short facts, why not; `label` says it all. */
const horseCard = (data: string, label: string, shut: unknown, name: string, price: string, facts: string[], why: string) =>
  `<button type="button" class="market-card" ${data} aria-label="${label}"${shut ? ' disabled' : ''}><canvas width="96" height="72" aria-hidden="true"></canvas>
    <b>${name}</b><span class="price">${price}</span>${facts.map((f) => `<small>${f}</small>`).join('')}${why ? `<small class="why">${why}</small>` : ''}</button>`;
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
/** A short message at the bottom, lifted above every button it would cover there (#123): the tools, the corners. */
function popUp(el: HTMLElement, text: string) {
  el.textContent = text; el.hidden = false; el.style.bottom = '';
  for (let i = 0; i < 4; i++) { // a row of buttons, maybe another above it
    const r = el.getBoundingClientRect(), hit = [...app.querySelectorAll('button')].map((b) => b.getBoundingClientRect())
      .filter((b) => b.width && b.top < r.bottom && b.bottom > r.top && b.left < r.right && b.right > r.left);
    if (!hit.length) return;
    el.style.bottom = `${innerHeight - Math.min(...hit.map((b) => b.top)) + 6}px`;
  }
}

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
        <div class="look-row" role="group" aria-label="${t.looks.skin}"><span>${t.looks.skin}</span>${swatches('skin', SKIN)}</div>
        <div class="look-row" role="group" aria-label="${t.looks.hair}"><span>${t.looks.hair}</span>${HAIR_STYLES.map((h) =>
          `<button type="button" class="style" data-k="hair" data-v="${h}">${t.hairStyles[h]}</button>`).join('')}</div>
        <div class="look-row" role="group" aria-label="${t.looks.hairColor}"><span>${t.looks.hairColor}</span>${swatches('hairColor', HAIR)}</div>
        <div class="look-row" role="group" aria-label="${t.looks.jacket}"><span>${t.looks.jacket}</span>${swatches('jacket', JACKET)}</div>
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
          <p>${slot.kind === 'save' ? (gameOver(slot.save.state) ? t.lostFarm : t.slotInfo(slot.save.state.day, slot.save.state.money, slot.save.state.debt)) : '&nbsp;'}</p>
          ${slot.kind === 'save' && !gameOver(slot.save.state) ? `<button type="button" data-do="resume" data-slot="${i}">${t.resumeGame}</button>` : ''}
          <button type="button" data-do="new" data-slot="${i}" class="${slot.kind === 'save' ? 'small' : ''}">${t.newGame}</button>
          <span class="file-buttons">
            ${slot.kind === 'save' ? `<button type="button" class="small" data-do="export" data-slot="${i}">${t.exportSave}</button>` : ''}
            <button type="button" class="small" data-do="import" data-slot="${i}">${t.importSave}</button>
          </span>
        </section>`).join('')}
      </div>
      <input id="import-file" type="file" accept=".json,application/json" hidden>
      <button id="show-credits" class="small corner" type="button">${t.credits}</button>
      <div class="full-screen">${fullscreen.html('fullscreen')}</div>
    </main>
    <p id="toast" class="toast" role="status" hidden></p>
    ${creditsSheet()}`);
  const say = (text: string) => { const el = $('toast'); popUp(el, text); setTimeout(() => { el.hidden = true; }, 3000); };
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
  app.querySelector('#fullscreen')?.addEventListener('click', () => fullscreen.enter());
  $('close-credits').addEventListener('click', () => { $('credits').hidden = true; });
  const farm = startFarm($<HTMLCanvasElement>('farm'));
  leave = () => { farm.then((f) => f.stop()); };
}

/** The top bar: money, day, sleep and the menu; `busy`: what going to bed now would leave unfinished, asked first. */
function topBar(busy = '') {
  return `
    <header class="topbar">
      <span class="stat farm-name">${esc(game.name())}</span>
      <span class="stat" id="money"><img class="icon" src="${icon('coin')}" alt="">${t.money(game.get().money)}</span>
      <button type="button" class="stat debt" id="debt" aria-label="${t.debtLabel(game.get().debt)}" title="${t.debtLabel(game.get().debt)}"${game.get().debt ? '' : ' hidden'}>${t.debt(game.get().debt)}</button>
      <span class="stat" id="hay"><img class="icon" src="${icon('feed')}" alt="">${t.hay(game.get().feed)}</span>
      <span class="stat" id="day">${t.day(game.get().day)}</span>
      <span class="spacer"></span>
      <button id="sleep" type="button"${busy ? ` data-busy="${esc(busy)}"` : ''}><img class="icon" src="${icon('moon')}" alt="">${t.sleep}</button>
      <button id="menu" type="button">${t.menu}</button>
    </header>
    <section id="menu-sheet" class="overlay" hidden>
      <div class="sheet menu">
        <button id="resume" type="button">${t.resume}</button>
        <button id="player" type="button">${t.playerCard}</button>
        ${fullscreen.html('menu-fullscreen')}
        <button id="to-start" type="button">${t.toStart}</button>
      </div>
    </section>
    <section id="player-card" class="overlay" hidden><div class="sheet ask player-card"></div></section>
    <div id="night" class="night" hidden><p></p></div>
    <section id="morning" class="overlay" hidden><div class="sheet ask"></div></section>
    <p id="toast" class="toast" role="status" hidden></p>`;
}

function wireTopBar($: ReturnType<typeof screen>, onChange: () => void) {
  $('sleep').addEventListener('click', async () => {
    const busy = $('sleep').dataset.busy;
    if (busy && !(await ask(busy, t.sleepAnyway))) return;
    // the farm diary first: today's money as bars and which horses got better (#78), then good night
    const day = dayMoney(game.get().today), better = game.get().horses.filter((h) => own(h) && gained(h).some((g) => g > 0));
    const money = day.income.length + day.costs.length + day.debts.length > 0;
    if (!money && !better.length && busy) return goodNight(); // asked already, nothing to tell: straight to bed
    const most = Math.max(...[...day.income, ...day.costs, ...day.debts].map((r) => Math.abs(r.amount)));
    const bar = (kind: string) => (r: { what: Entry['what']; amount: number }) => `<div class="diary-row"><span>${t.billWhat[r.what]}</span>
      <span class="diary-bar ${kind}"><i style="width:${Math.max(4, Math.round((Math.abs(r.amount) / most) * 100))}%"></i></span><b>${t.euros(r.amount)}</b></div>`;
    const box = $('morning');
    box.firstElementChild!.className = 'sheet ask diary';
    box.firstElementChild!.innerHTML = `<h2>${t.diaryTitle(game.get().day)}</h2>
      ${day.income.length ? `<h3>${t.diaryIn}</h3>${day.income.map(bar('in')).join('')}` : ''}
      ${day.costs.length ? `<h3>${t.diaryOut}</h3>${day.costs.map(bar('out')).join('')}` : ''}
      ${day.debts.length ? `<h3>${t.diaryDebts}</h3>${day.debts.map(bar('debt')).join('')}` : ''}
      ${money ? `<p class="diary-total">${t.diaryTotal(day.total, game.get().money)}</p>` : ''}
      ${better.length ? `<h3>${t.diaryBetter}</h3>${better.map((h) => `<p class="diary-line">${t.diaryGain(esc(h.name), ...gained(h))}</p>`).join('')}` : ''}
      ${!money && !better.length ? `<p>${t.sleepAsk}</p>` : ''}
      <button type="button" id="good-night">${t.goodNight}</button><button type="button" id="stay-up">${t.cancel}</button>`;
    box.hidden = false;
    // going to bed can always be called off (#125)
    $('good-night').addEventListener('click', () => { box.hidden = true; goodNight(); });
    $('stay-up').addEventListener('click', () => { box.hidden = true; });
  });
  function goodNight() {
    const night = $('night');
    night.querySelector('p')!.textContent = t.goodNight;
    night.hidden = false;
    setTimeout(() => {
      game.dispatch({ type: 'sleep' });
      night.querySelector('p')!.textContent = t.day(game.get().day);
      setTimeout(() => { night.hidden = true; morning(game.get().night); }, 900);
    }, 900);
  }
  // the morning summary: one short line per piece of news, then on with the day
  const nameOf = (id?: string) => esc(game.get().horses.find((h) => h.id === id)?.name ?? '');
  const line = (n: News) => n.kind === 'sick' ? t.newsSick(nameOf(n.horse)) : n.kind === 'rested' ? t.newsRested(nameOf(n.horse))
    : n.kind === 'hayLow' ? t.newsHayLow : n.kind === 'noHay' ? t.newsNoHay
    : n.kind === 'staffUnpaid' ? t.newsStaffUnpaid : n.kind === 'omaHelped' ? t.newsOmaHelped : n.kind === 'lastWarning' ? t.newsLastWarning(n.count ?? 0)
    : n.kind === 'boarderLeft' ? t.newsBoarderLeft(esc(n.owner ?? ''), esc(n.horse ?? '')) : '';
  function morning(news: News[]) {
    if (gameOver(game.get())) return showGameOver(); // the farm is lost: no morning any more
    if (!news.length) return;
    const lines = [...new Set(news.map(line).filter(Boolean))]; // "no hay" comes once per horse; say it once; the money was in the diary
    if (!lines.length) return;
    const box = $('morning');
    box.firstElementChild!.className = 'sheet ask';
    box.firstElementChild!.innerHTML = `<h2>${t.morning}</h2>${lines.map((l) => `<p>${l}</p>`).join('')}<button type="button">${t.morningGo}</button>`;
    box.hidden = false;
    box.querySelector('button')!.addEventListener('click', () => { box.hidden = true; });
  }
  $('debt').addEventListener('click', payBack);
  /** Paying debt back by hand (#121): asked first, as much as there is money for. */
  async function payBack() {
    const s = game.get(), pay = canRepay(s);
    if (!pay) return toast(t.repayNoMoney(s.debt));
    if (!(await ask(t.repayAsk(s.debt, pay), t.repay(pay)))) return;
    game.dispatch({ type: 'repay' });
    toast(t.repaid(pay, game.get().debt));
  }
  $('menu').addEventListener('click', () => { $('menu-sheet').hidden = false; });
  $('resume').addEventListener('click', () => { $('menu-sheet').hidden = true; });
  $('menu-sheet').querySelector('#menu-fullscreen')?.addEventListener('click', () => { $('menu-sheet').hidden = true; fullscreen.enter(); });
  $('to-start').addEventListener('click', showStart);
  // the player card: the figure, its name and the badges earned
  $('player').addEventListener('click', () => {
    const s = game.get(), card = $('player-card');
    card.firstElementChild!.innerHTML = `<h2>${t.playerCard}</h2><canvas class="preview" width="40" height="32" aria-hidden="true"></canvas>
      <p class="player-name"></p><h3>${t.badges}</h3>
      ${s.badges ? `<p class="badge"><img class="rosette" src="${icon('rosette')}" alt="">${t.badgeName}</p>` : `<p>${t.noBadges}</p>`}
      ${s.badges >= 2 ? `<p class="badge"><img class="rosette" src="${icon('rosette')}" alt="">${t.badge2Name}</p>` : ''}
      <button type="button" id="close-card">${t.close}</button>`;
    card.querySelector('.player-name')!.textContent = s.avatar.name;
    const g = card.querySelector('canvas')!.getContext('2d')!;
    drawKid(g, avatarKid(s.avatar), 11, 30, 'S'); drawKid(g, avatarKid(s.avatar), 29, 30, 'E');
    $('menu-sheet').hidden = true; card.hidden = false;
    $('close-card').addEventListener('click', () => { card.hidden = true; });
  });
  const unsubscribe = game.subscribe(() => {
    $('money').lastChild!.textContent = t.money(game.get().money);
    $('debt').hidden = !game.get().debt;
    $('debt').textContent = t.debt(game.get().debt);
    $('debt').setAttribute('aria-label', t.debtLabel(game.get().debt));
    $('debt').title = t.debtLabel(game.get().debt);
    $('day').textContent = t.day(game.get().day);
    $('hay').lastChild!.textContent = t.hay(game.get().feed);
    onChange();
  });
  let timer = 0;
  const toast = (text: string) => {
    const el = $('toast');
    popUp(el, text);
    clearTimeout(timer); timer = window.setTimeout(() => { el.hidden = true; }, 2600);
  };
  game.onSaveFailed(() => toast(t.saveFailed));
  // the same slot played in another tab: this one goes back to the start rather than overwrite newer progress
  const elsewhere = (e: StorageEvent) => { if (e.key === slotKey(game.slot())) showStart(); };
  addEventListener('storage', elsewhere);
  return { unsubscribe: () => { unsubscribe(); removeEventListener('storage', elsewhere); }, toast, payBack };
}

/**
 * The horses not on the farm map's pasture: the sick and resting ones are in the stable, and the map's pasture shows
 * only as many as its first field holds (#79) — the others graze on the paddocks of the pasture screen, so the map
 * never looks crowded.
 */
function offMapPasture(horses: Horse[]) {
  let places = 0;
  return horses.flatMap((h, i) => {
    if (isSick(h) || h.rest) return [i];
    places += DATA.pasture.need[h.look.build];
    return places > DATA.pasture.start ? [i] : [];
  });
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

/** The farm is lost (a second dead end lasted too long): Oma Hanne says so over the farm; then to the start. */
function showGameOver() {
  const $ = screen(`<canvas id="farm" aria-hidden="true"></canvas>
    <section class="overlay talk"><div class="sheet bubble"><img src="${omaPortrait()}" alt="${t.omaHanne}">
      <h2>${t.gameOverTitle}</h2><p>${t.gameOverText}</p><div class="answers"><button type="button" id="lost-start">${t.toStart}</button></div></div></section>`);
  const farm = startFarm($<HTMLCanvasElement>('farm'), { herd: [], canter: false, plots: farmPlots(game.get()) });
  $('lost-start').addEventListener('click', showStart);
  leave = () => { farm.then((f) => f.stop()); };
}

/** The farm map; with `intro`, Oma Hanne first hands the farm over in a few speech bubbles. */
export function showFarm(intro = false) {
  if (gameOver(game.get())) return showGameOver();
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
    else if (target === 'pasture') showPasture();
    else if (target === 'xc') { if (s.badges < 1) bar.toast(t.xcLater); else fields(); }
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
        : nextStage(s) && allGoalsDone(s) ? `<li class="all">${t.inspectionTomorrow}</li>` : '');
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
  /** Out to the fields (#73–#75): cross-country practice, and riding badge 2 (or why not yet), once passed the shows. */
  function fields() {
    const sheet = $('lesson'), s = game.get(), w = badge2Waits(s), show = w?.why === 'passed' && xcShowWaits(s);
    const showWhy = show === 'notToday' ? t.xcShowWaits.notToday(nextXcShowDay(s)) : show === 'money' ? t.showWaits.money(DATA.xcShows.classes.E.fee) : '';
    sheet.firstElementChild!.innerHTML = `<h2>${t.places.xc}</h2><button type="button" id="xc-practise">${t.practiseXc}</button>
      ${w?.why === 'passed' ? `<button type="button" id="xc-show"${show ? ' disabled aria-describedby="xc-show-why"' : ''}>${t.xcShow}</button>${showWhy ? `<p class="oma" id="xc-show-why">${showWhy}</p>` : ''}`
        : `<button type="button" id="badge2"${w ? ' disabled aria-describedby="badge2-why"' : ''}>${t.badge2Name}</button>
      ${w ? `<p class="oma" id="badge2-why">${w.why === 'practise' ? t.badge2Practise(w.rounds) : t.badge2Waits[w.why]}</p>` : ''}`}
      <button type="button" id="close-lesson">${t.close}</button>`;
    $('xc-practise').addEventListener('click', () => pickHorse(t.whichHorseXc, (id) => showCrossCountry(id), undefined, undefined, DATA.crossCountry.energy, 'crossCountry'));
    sheet.querySelector('#badge2')?.addEventListener('click', () => pickHorse(t.whichHorseBadge2, badge2Exam, undefined, undefined, DATA.badge2.energy, 'crossCountry'));
    sheet.querySelector('#xc-show')?.addEventListener('click', () => enterShow(true));
    $('close-lesson').addEventListener('click', () => { sheet.hidden = true; });
    sheet.hidden = false;
  }
  /** The arena: a lesson for the first waiting pupil, jumping practice, and the riding badge or, once passed, the show. */
  function arena() {
    const sheet = $('lesson'), s = game.get(), wait = badgeWaits(s), show = showWaits(s);
    const showWhy = show === 'notToday' ? t.showWaits.notToday(nextShowDay(s)) : show === 'money' ? t.showWaits.money(DATA.shows.classes.E.fee) : show && t.showWaits[show];
    sheet.firstElementChild!.innerHTML = `<h2>${t.places.arena}</h2>
      <button type="button" id="give-lesson">${t.giveLesson}</button><button type="button" id="practise">${t.practiseJumping}</button>
      ${wait?.why === 'passed' ? `<button type="button" id="show"${show ? ' disabled aria-describedby="show-why"' : ''}>${t.show}</button>${showWhy ? `<p class="oma" id="show-why">${showWhy}</p>` : ''}`
        : `<button type="button" id="badge"${wait ? ' disabled aria-describedby="badge-why"' : ''}>${t.ridingBadge}</button>
      ${wait ? `<p class="oma" id="badge-why">${wait.why === 'practise' ? t.badgeWaits.practise(wait.rounds) : t.badgeWaits[wait.why]}</p>` : ''}`}
      ${atLeast(s, 'reitschule') && !s.built.arena ? `<button type="button" id="upgrade">${t.upgradeArena(DATA.build.arena.cost)}</button>` : ''}
      <button type="button" id="close-lesson">${t.close}</button>`;
    sheet.querySelector('#badge')?.addEventListener('click', showBadge);
    sheet.querySelector('#upgrade')?.addEventListener('click', () => build('arena', t.upgradeArena(DATA.build.arena.cost), t.builtArena));
    sheet.querySelector('#show')?.addEventListener('click', () => enterShow());
    $('give-lesson').addEventListener('click', () => {
      const p = game.get().pupils[0];
      if (p) chooseHorse(p); else { sheet.hidden = true; bar.toast(t.noPupils); }
    });
    $('practise').addEventListener('click', () => pickHorse(t.whichHorse, (id) => showJumping(id)));
    $('close-lesson').addEventListener('click', () => { sheet.hidden = true; });
    sheet.hidden = false;
  }
  /**
   * A show, jumping or cross-country (`xc`, #75): the class first, once a horse may start higher than E (each class says
   * why not, if it can't), then the horse. While only E is open, straight to the horse, with a word on what practice opens.
   */
  function enterShow(xc = false) {
    const s = game.get(), C = xc ? DATA.xcShows.classes : DATA.shows.classes, shut = xc ? xcClassShut : classShut, T = xc ? t.xcShows : t.jumpShows;
    const ride = (c: ShowClass, title: string, note?: string) => pickHorse(title, (id) => (xc ? showCrossCountry(id, undefined, c) : showJumping(id, 'show', c)),
      (h) => ({ skill: T.notSkilled, scope: T.notScope, money: null, ok: null })[(xc ? xcClassWaits : classWaits)(s, h, c) ?? 'ok'], note, xc ? DATA.crossCountry.energy : undefined, xc ? 'crossCountry' : 'jumping');
    if (SHOW_CLASSES.slice(1).every((c) => shut(s, c) === 'skill' || shut(s, c) === 'scope')) return ride('E', T.enter(C.E.fee), T.classesLater);
    const sheet = $('lesson');
    sheet.firstElementChild!.innerHTML = `<h2>${T.whichClass}</h2><p class="oma">${T.classesHow}</p>
      ${SHOW_CLASSES.map((c) => {
        const w = shut(s, c);
        return `<button type="button" data-class="${c}"${w ? ' disabled' : ''}>${t.showClass(c, C[c].fee, C[c].prizes[0])}${w ? ` · ${T.classWaits[w]}` : ''}</button>`;
      }).join('')}
      <button type="button" id="close-lesson">${t.close}</button>`;
    sheet.querySelectorAll<HTMLButtonElement>('[data-class]').forEach((b) => b.addEventListener('click', () => {
      const c = b.dataset.class as ShowClass;
      ride(c, t.showEnterClass(c, C[c].fee));
    }));
    $('close-lesson').addEventListener('click', () => { sheet.hidden = true; });
  }
  /**
   * Pick a horse for a ride: each says how good it is at it and how fresh, or why it can't go (too tired, resting,
   * sick, or not allowed by `not`); the best one is marked, like the lesson's pick (#101).
   */
  function pickHorse(title: string, go: (id: string) => void, not?: (h: Horse) => string | null, note?: string, energy: number = DATA.jumping.energy, what: 'jumping' | 'crossCountry' = 'jumping') {
    const sheet = $('lesson'), xc = what === 'crossCountry';
    const best = bestRider(game.get().horses, what, energy, not);
    sheet.firstElementChild!.innerHTML = `<h2>${title}</h2>${note ? `<p class="oma">${note}</p>` : ''}
      ${game.get().horses.filter(own).map((h) => {
        const tired = cantWork(h, energy), why = tired ? t.cantWork[tired] : not?.(h);
        const line = why ?? t.pickLine(xc ? t.crossCountry : t.jumping, h.skills[what], xc ? xcScope(h) : scope(h), h.needs.energy >= 70);
        return `<button type="button" class="choice${h.id === best ? ' best' : ''}" data-horse="${h.id}"${why ? ' disabled' : ''}><b>${esc(h.name)}${h.id === best ? ` <i>★ ${t.bestChoice}</i>` : ''}</b><small>${line}</small></button>`;
      }).join('')}
      <button type="button" id="close-lesson">${t.close}</button>`;
    sheet.querySelectorAll<HTMLButtonElement>('[data-horse]').forEach((b) => b.addEventListener('click', () => go(b.dataset.horse!)));
    $('close-lesson').addEventListener('click', () => { sheet.hidden = true; });
    sheet.hidden = false; // open from the arena's sheet, or on its own (the way out to the fields)
  }
  /** A pupil wants a lesson: pick a horse; each shows how well it fits, or why it can't. */
  function chooseHorse(p: Pupil) {
    const s = game.get(), sheet = $('lesson');
    // the first time no horse is the right one, Oma Hanne says which fits whom
    if (!s.explained.includes('fit') && fitsNone(p, s.horses.filter(own))) { explain('fit').then(() => chooseHorse(p)); return; }
    sheet.firstElementChild!.innerHTML = `<h2>${t.pupilWants(esc(p.name))}</h2>
      <p>${t.pupilKind(p.size === 'small', p.level === 'advanced')}</p>
      ${lessonChoices(p, s.horses.filter(own)).every((c) => c.why) ? `<p class="oma">${t.noHorseFree(esc(p.name))}</p>` : ''}
      ${lessonChoices(p, s.horses.filter(own)).map((c) => {
        // why it fits or not, in words, then how the lesson would go; the best horse is marked
        const name = esc(p.name);
        const how = c.why ? t.cantWork[c.why] : [t.fitWhy(name, c.fit), ...(c.unkempt ? [t.needsCare] : []), t.wouldBe(name, c.mood, c.pay)].join(' · ');
        return `<button type="button" class="choice${c.best ? ' best' : ''}" data-horse="${c.horse.id}"${c.why ? ' disabled' : ''}><b>${esc(c.horse.name)}${c.best ? ` <i>★ ${t.bestChoice}</i>` : ''}</b><small>${how}</small></button>`;
      }).join('')}
      <button type="button" id="send-home">${t.sendHome(esc(p.name))}</button><button type="button" id="close-lesson">${t.close}</button>`;
    $('send-home').addEventListener('click', () => { sheet.hidden = true; game.dispatch({ type: 'sendHome', pupil: p.id }); bar.toast(t.sentHome(p.name)); });
    sheet.querySelectorAll<HTMLButtonElement>('[data-horse]').forEach((b) => b.addEventListener('click', () => {
      // the pupil may get the horse ready step by step (the care course) and ride it there
      const id = b.dataset.horse!, horse = game.get().horses.find((h) => h.id === id)!;
      sheet.firstElementChild!.innerHTML = `<p>${t.routineAsk(esc(p.name), esc(horse.name))}</p><div class="answers">
        <button type="button" id="routine-yes">${t.routineYes}</button><button type="button" id="routine-no">${t.routineNo}</button><button type="button" id="routine-other">${t.back}</button></div>`;
      $('routine-yes').addEventListener('click', () => showRoutine(id, p));
      $('routine-no').addEventListener('click', () => give(id));
      $('routine-other').addEventListener('click', () => chooseHorse(p));
    }));
    /** The lesson on the farm map, as before the care course. */
    const give = (id: string) => {
      const before = game.get(), i = before.horses.findIndex((h) => h.id === id), h = before.horses[i];
      const { pay, happy } = lessonOutcome(p, h);
      sheet.hidden = true;
      game.dispatch({ type: 'lesson', pupil: p.id, horse: h.id });
      if (game.get().lessonsGiven === before.lessonsGiven) return; // the Sim said no (the pupil or horse changed meanwhile)
      const repaid = before.debt - game.get().debt;
      bar.toast(t.lessonRuns(p.name, h.name));
      farm.then((f) => f.lesson(i, pupilKid(p))).then(() => bar.toast(t.lessonDone(p.name, mood(happy), pay, repaid)));
    };
    $('close-lesson').addEventListener('click', () => { sheet.hidden = true; });
    sheet.hidden = false;
  }
  /** The notice board: the debt, the show calendar, the bank when money is short, and the horse market. */
  function shop() {
    const s = game.get();
    $('shop').firstElementChild!.innerHTML = `<h2>${t.shopTitle}</h2>
      ${!s.debt && !s.badges && !(s.money < DATA.vet.cost && canLoan(s)) && !atLeast(s, 'reitschule') ? `<p>${t.boardEmpty}</p>` : ''}
      ${s.debt ? `<p>${t.owe(s.debt)}</p>${canRepay(s) ? `<button type="button" id="repay">${t.repay(canRepay(s))}</button>` : ''}` : ''}
      ${s.badges ? `<p class="calendar">${t.nextShow(nextShowDay(s), nextShowDay(s) === s.day)}</p>` : ''}
      ${s.badges >= 2 ? `<p class="calendar">${t.nextXcShow(nextXcShowDay(s), nextXcShowDay(s) === s.day)}</p>` : ''}
      ${s.money < DATA.vet.cost && canLoan(s) ? `<button type="button" id="loan">${t.loan(DATA.loan.amount)}</button><p class="oma">${t.omaLoan}</p>` : ''}
      ${atLeast(s, 'pensionsstall') ? pension(s) : ''}
      ${atLeast(s, 'reitschule') ? `<h3>${t.market}</h3>${s.market.length ? `<div class="market-cards">${s.market.map((o) => {
        // a card per offer, the horse drawn (#102); each says why it can't come: no stall, no room on the pasture (a
        // big horse takes two places), no money
        const room = noRoom(s, o.look.build), poor = s.money < o.price, why = room === 'pasture' ? t.pastureFullShort : !room && poor ? t.tooExpensive : '';
        const all = `${t.offer(esc(o.name), o.look.build === 'pony', BREEDS[o.breed].label, COATS[o.look.coat].label, o.price)} · ${t.jumpsUpTo(topClass(o))} · ${t.needsPlaces(DATA.pasture.need[o.look.build])}${why ? ` · ${why}` : ''}`;
        return horseCard(`data-offer="${o.id}"`, all, room || poor, esc(o.name), t.money(o.price), [t.offerKind(o.look.build === 'pony', BREEDS[o.breed].label), t.jumpsUpTo(topClass(o)), t.needsPlaces(DATA.pasture.need[o.look.build])], why);
      }).join('')}</div>` : `<p>${t.marketEmpty}</p>`}` : ''}
      ${roomNote(s, [...(atLeast(s, 'reitschule') ? s.market : []), ...(atLeast(s, 'pensionsstall') ? s.boardOffers : [])])}
      ${atLeast(s, 'reitschule') ? `<h3>${t.sellTitle}</h3><div class="market-cards">${s.horses.filter(own).map((h) => {
        // each own horse with its price, or why it stays (the last one, a part-boarder rides it, sick)
        const why = saleWaits(s, h), line = t.sellLine(esc(h.name), salePrice(h));
        return horseCard(`data-sell="${h.id}"`, why ? `${line} · ${t.saleWaits[why]}` : line, !!why, esc(h.name), t.money(salePrice(h)), [BREEDS[h.breed].label], why ? t.saleWaits[why] : '');
      }).join('')}</div>` : ''}
      <button type="button" id="close-shop">${t.close}</button>`;
    // each card's horse, drawn from its look (the side view, as on the horse card)
    $('shop').querySelectorAll<HTMLCanvasElement>('.market-card canvas').forEach((c) => {
      const b = c.closest('button')!, look = (b.dataset.offer ? s.market.find((o) => o.id === b.dataset.offer) : s.horses.find((h) => h.id === b.dataset.sell))?.look;
      if (look) horseSheet(look, 'idle').then((sheet) => c.getContext('2d')!.drawImage(sheet, 128 + 16, 30, 96, 72, 0, 0, 96, 72));
    });
    $('shop').querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((b) => b.addEventListener('click', () => sell(b.dataset.sell!)));
    $('shop').querySelectorAll<HTMLButtonElement>('[data-offer]').forEach((b) => b.addEventListener('click', () => {
      const o = game.get().market.find((x) => x.id === b.dataset.offer);
      if (!o) return;
      game.dispatch({ type: 'buyHorse', offer: o.id });
      if (game.get().horses.some((h) => h.id === o.id)) { showFarm(); omaSays(t.boughtHorse(o.name)); } // the new horse joins the herd on the map
    }));
    $('shop').querySelector('#loan')?.addEventListener('click', async () => {
      if (!(await ask(t.debtWarn(DATA.loan.amount, game.get().debt + DATA.loan.amount), t.debtYesLoan))) return; // never into debt without a warning (#122)
      game.dispatch({ type: 'loan' }); bar.toast(t.lent(DATA.loan.amount));
    });
    $('shop').querySelector('#repay')?.addEventListener('click', () => bar.payBack());
    // the Pensionsstall: grooms, boarders, a rider; the screen redraws itself on every change (wireTopBar)
    $('shop').querySelector('#hire')?.addEventListener('click', () => game.dispatch({ type: 'hire' }));
    $('shop').querySelector('#fire')?.addEventListener('click', () => game.dispatch({ type: 'fire' }));
    $('shop').querySelectorAll<HTMLButtonElement>('[data-board]').forEach((b) => b.addEventListener('click', () => game.dispatch({ type: 'board', offer: b.dataset.board! })));
    $('shop').querySelector('#part')?.addEventListener('click', () => game.dispatch({ type: 'partBoard' }));
    $('close-shop').addEventListener('click', () => {
      $('shop').hidden = true;
      // a new groom or a boarder's horse: the map shows them at once
      const now = game.get();
      if (now.staff !== shopFrom.staff || now.horses.map((h) => h.id).join() !== shopFrom.horses) showFarm(); // ids: a sale then a boarder keeps the count
    });
  }
  /** Before a horse goes (#85): Oma Hanne's word on it and the price, then yes or back to the board. */
  function sell(id: string) {
    const s = game.get(), h = s.horses.find((x) => x.id === id);
    if (!h) return shop();
    const price = salePrice(h), name = esc(h.name);
    $('shop').firstElementChild!.innerHTML = `<h2>${t.sellAsk(name)}</h2><p class="oma">${t.saleAdvice[saleAdvice(s, h)](name, price)}</p>
      <div class="answers"><button type="button" id="sell-yes">${t.sellYes(price)}</button><button type="button" id="sell-no">${t.back}</button></div>`;
    $('sell-yes').addEventListener('click', () => {
      game.dispatch({ type: 'sell', horse: id });
      if (!game.get().horses.some((x) => x.id === id)) bar.toast(t.sold(h.name, price, s.debt - game.get().debt));
      shop();
    });
    $('sell-no').addEventListener('click', shop);
  }
  let shopFrom = { staff: 0, horses: '' };
  function showShop() { shopFrom = { staff: game.get().staff, horses: game.get().horses.map((h) => h.id).join() }; shop(); $('shop').hidden = false; }
  /** The notice board's Pensionsstall part: hire or let go a groom, take a boarder into a free stall, a rider for a horse. */
  /** Once, under the offers: what stands in the way of one of them — the stalls, or the pasture with a word on enlarging it. */
  function roomNote(s: State, offers: { look: Horse['look'] }[]) {
    const why = offers.map((o) => noRoom(s, o.look.build)).find(Boolean);
    if (why === 'stall') return `<p class="oma">${s.built.stalls ? t.stallsFull : t.noStall}</p>`;
    return why === 'pasture' ? `<p class="oma">${buildWaits(s, 'pasture') === 'built' ? t.pastureBiggest : t.pastureFull}</p>` : '';
  }
  function pension(s: State) {
    const S = DATA.staff, offer = s.partOffer, horse = offer && s.horses.find((h) => h.id === offer.horse);
    return `<h3>${t.staffTitle}</h3>
      ${s.staff ? `<p>${t.hired(S.names.slice(0, s.staff).join(' und '), s.staff > 1)}</p><button type="button" id="fire" class="small">${t.fire(S.names[s.staff - 1])}</button>` : ''}
      ${s.staff < S.names.length ? `<button type="button" id="hire">${t.hire(S.names[s.staff], S.wage, S.horses)}</button>` : ''}
      <h3>${t.boardersTitle}</h3>
      ${s.boardOffers.length ? s.boardOffers.map((o) => { const room = noRoom(s, o.look.build); return `<button type="button" data-board="${o.id}"${room ? ' disabled' : ''}>${t.boardOffer(esc(o.owner), esc(o.name), BREEDS[o.breed].label, o.pay)} · ${t.needsPlaces(DATA.pasture.need[o.look.build])}${room === 'pasture' ? ` · ${t.pastureFullShort}` : ''}</button>`; }).join('')
        : `<p>${t.noBoarders}</p>`}
      ${offer && horse ? `<h3>${t.partTitle}</h3><p>${t.partOffer(esc(offer.rider), esc(horse.name), offer.pay)}</p><button type="button" id="part">${t.partYes}</button>` : ''}`;
  }
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
    ['xc', WORLD.width - 60, 14 * 32 + 14], // where the lane leaves the farm (kept on the screen, see place)
  ];
  const labels = $('labels');
  labels.innerHTML = places.map(([id, x, y]) => `<button class="label" type="button" data-place="${id}" data-x="${x}" data-y="${y}">${id === 'free' && game.get().built.stalls ? t.shelter : id === 'pasture' ? t.pastureLabel(grazing(game.get()), pasture(game.get())) : t.places[id] ?? id}</button>`).join('')
    + '<span id="pupils"></span>';
  labels.querySelectorAll<HTMLButtonElement>('[data-place]').forEach((b) => b.addEventListener('click', () => tap(b.dataset.place!)));
  /** Puts every label over its world point, centred (set here, not with a CSS transform: WebKit then misses taps on it). */
  const place = () => farm.then((f) => {
    labels.hidden = false; // shown once placed, not stacked in a corner while the farm loads
    const placed: HTMLElement[] = [];
    labels.querySelectorAll<HTMLElement>('[data-x]').forEach((el) => {
      const p = f.toScreen(Number(el.dataset.x), Number(el.dataset.y));
      // on the screen even where the map runs on past its edge (the lane out to the fields)
      let left = Math.max(8, Math.min(innerWidth - el.offsetWidth - 8, p.left - el.offsetWidth / 2)), top = Math.max(8, Math.min(innerHeight - el.offsetHeight - 8, p.top - el.offsetHeight / 2));
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
    farm.then((f) => { f.setPupils(waiting.map(pupilKid)); f.setAway(offMapPasture(game.get().horses)); });
    place();
  }
  const farm = startFarm($<HTMLCanvasElement>('farm'), {
    herd: game.get().horses.map((h) => h.look), canter: false, onTap: tap, onLayout: place, plots: farmPlots(game.get()), staff: game.get().staff,
  });
  pupils();
  leave = () => { bar.unsubscribe(); farm.then((f) => f.stop()); };
}

/** A jumping round: practice, the badge's round (after its quiz), or a show. */
function showJumping(id: string, kind: 'train' | 'badge' | 'show' = 'train', showClass: ShowClass = 'E') {
  const h = game.get().horses.find((x) => x.id === id)!;
  const $ = screen(`<canvas id="jumping" aria-label="${kind === 'show' ? t.showClassName(showClass) : kind === 'badge' ? t.ridingBadge : t.practiseJumping}"></canvas>
    <section id="jump-start" class="overlay talk"><div class="sheet bubble"><img src="${omaPortrait()}" alt="${t.omaHanne}"><ul class="rules"></ul>
      <div class="answers"><button type="button" id="jump-go">${t.go}</button><button type="button" id="jump-leave">${t.back}</button></div></div></section>
    <p id="jump-hud" class="jump-hud" aria-live="off"></p><p id="jump-tip" class="jump-tip" role="status" hidden></p>
    <button type="button" id="jump-quit" class="small corner left" hidden>${t.routineLeave}</button>
    <section id="jump-end" class="overlay" hidden><div class="sheet ask"><p role="status"></p><button type="button" id="jump-back">${t.toFarm}</button></div></section>`);
  // each round its own course: from the day and the practice so far (the same again after a reload)
  const s0 = game.get(), course = courseFor(kind, showClass, s0.day * 1009 + s0.trainings * 31 + s0.badgeFailedDay), allowed = timeAllowed(course);
  const hud = (r: Round) => { $('jump-hud').textContent = t.jumpHud(Math.min(r.next + 1, course.jumps.length), course.jumps.length, r.faults, Math.floor(r.t), allowed); };
  // higher classes need momentum: how long this horse needs the finger held before letting go (0: a tap)
  const need = holdNeed(h, course.hold ?? 0), tip = $('jump-tip');
  $('jump-start').querySelector('ul')!.innerHTML = howList(t.jumpHow(h.look.build === 'pony', !!need)); // with momentum: Oma explains the hold, not the tap
  let waitTip = '', knockTimer = 0;
  const round = startJumping($<HTMLCanvasElement>('jumping'), {
    look: h.look, kid: avatarKid(game.get().avatar), course, window: jumpWindow(h), hold: need, judge: (o, held) => takeOff(h, o, held, need), onChange: hud,
    onWaiting: (w) => { waitTip = w ? t.drawTip(w, h.look.build === 'pony') : ''; if (!knockTimer) { tip.hidden = !w; tip.textContent = waitTip; } },
    // a knocked pole: say why for a moment (too soon, too late, not enough momentum), then back to any waiting tip
    onKnock: (o, held) => {
      tip.textContent = t.knock[faultWhy(h, o, held, need)]; tip.hidden = false;
      clearTimeout(knockTimer);
      knockTimer = window.setTimeout(() => { knockTimer = 0; tip.textContent = waitTip; tip.hidden = !waitTip; }, 1800);
    },
  });
  hud(newRound(course));
  // on the arena a tap is "Hopp!" (the scene); on a keyboard the space bar is too, unless a button has the focus
  // held down for momentum like a finger: the take-off when it is let go
  let spaceAt = 0;
  const key = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || e.target instanceof HTMLButtonElement) return;
    e.preventDefault();
    if (e.type === 'keydown') { if (!e.repeat) spaceAt = performance.now(); return; }
    const held = (performance.now() - spaceAt) / 1000;
    round.then((r) => r.hopp(held));
  };
  addEventListener('keydown', key);
  addEventListener('keyup', key);
  // two fingers on the arena must not zoom the page (iPadOS pinches even over touch-action: none)
  const noZoom = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', noZoom);
  $('jump-go').addEventListener('click', async () => { // once: a second click (or the space bar) must not ride it again
    $('jump-start').hidden = true;
    $('jump-quit').hidden = false;
    const faults = await (await round).run(), end = $('jump-end');
    $('jump-quit').hidden = true;
    clearTimeout(knockTimer); tip.hidden = true; // no tip over the result
    if (kind === 'show') {
      // the podium: the first three on their steps, then everyone with their points
      const s = game.get(), { table, rank, prize } = showResult(s, s.horses.find((x) => x.id === id)!, faults, s.avatar.name, showClass);
      game.dispatch({ type: 'show', horse: id, faults, showClass });
      if (game.get().lastShowDay !== s.day) return showFarm(); // the Sim said no: no podium for a show not ridden
      podium(end, table);
      end.querySelector('p')!.textContent = `${t.showPlace(rank, prize)} ${t.skillNow(t.jumping, h.skills.jumping, scope(h))}`; // a show doesn't train: where the horse stands
    } else if (kind === 'badge') {
      game.dispatch({ type: 'badge', horse: id, faults });
      const passed = game.get().badges >= 1;
      // the ceremony: the big rosette over the congratulations
      if (passed) end.querySelector('p')!.insertAdjacentHTML('beforebegin', `<img class="rosette big" src="${icon('rosette')}" alt="${t.badgeName}">`);
      end.querySelector('p')!.textContent = `${passed ? t.badgePassed : t.badgeFailed} ${t.skillNow(t.jumping, h.skills.jumping, scope(h))}`;
    } else {
      const practising = badgeWaits(game.get())?.why === 'practise';
      game.dispatch({ type: 'train', horse: id, faults });
      // Oma Hanne points to the badge once the practice is enough
      const ready = practising && !badgeWaits(game.get()) ? ` ${t.badgeReady}` : '';
      const now = game.get().horses.find((x) => x.id === id)!.skills.jumping; // how much it grew, out of what it can reach
      const top = h.skills.jumping >= scope(h); // already at the breed's limit: no 'better' to say
      end.querySelector('p')!.textContent = `${faults ? t.jumpFaults(faults, h.name) : top ? t.cleanRound : t.jumpClear(h.name)} ${t.skillGain(t.jumping, now - h.skills.jumping, now, scope(h))}${ready}`;
    }
    end.hidden = false;
  }, { once: true });
  $('jump-back').addEventListener('click', () => showFarm());
  $('jump-leave').addEventListener('click', () => showFarm());
  // stopping: before the first way back to the farm (nothing ridden, nothing paid); after it, asked, the round is given up
  $('jump-quit').addEventListener('click', async () => {
    const r = await round;
    if (!r.started()) return showFarm(); // nothing ridden yet: just back, nothing to ask
    if (!(await ask(t.jumpQuitSure, t.jumpQuitYes))) return;
    if (!$('jump-quit').hidden) r.quit(); // the round may have ended while asked: then its result stays
  });
  leave = () => { removeEventListener('keydown', key); removeEventListener('keyup', key); document.removeEventListener('gesturestart', noZoom); round.then((r) => r.stop()); };
}

/** The podium over a show's result: the first three on their steps, then everyone with their points. */
function podium(end: HTMLElement, table: ShowRow[]) {
  const row = (r: ShowRow) => `<b>${esc(r.rider)}</b><span>${esc(r.horse)}</span>`;
  end.querySelector('p')!.insertAdjacentHTML('beforebegin', `<h2>${t.podium}</h2>
    <div class="podium">${[1, 0, 2].map((i) => table[i] ? `<div class="step p${i + 1}${table[i].you ? ' you' : ''}">${row(table[i])}<i>${i + 1}</i></div>` : '').join('')}</div>
    <ol class="ranking">${table.map((r) => `<li${r.you ? ' class="you"' : ''}>${row(r)} · ${t.points(r.score)}</li>`).join('')}</ol>`);
}

/**
 * Riding badge 1: Oma Hanne asks five care questions (the answers shuffled per day, the right one not always first),
 * then the player picks a horse for the jumping round.
 */
function showBadge() {
  quizScreen('oma', t.badgeIntro, t.quiz, (picked, ui) => {
    game.dispatch({ type: 'badgeQuiz', answers: picked });
    const s = game.get(), right = quizScore(picked);
    if (s.badgeQuizDay !== s.day) return ui.end(t.quizFailed(right));
    ui.say(t.quizDone(right));
    ui.buttons(game.get().horses.filter(own).map((h) => {
      const why = cantWork(h, DATA.jumping.energy);
      return `<button type="button" data-horse="${h.id}"${why ? ' disabled' : ''}>${esc(h.name)}${why ? ` · ${t.cantWork[why]}` : ''}</button>`;
    }).join('') + `<button type="button" data-back>${t.back}</button>`, (b) => (b.dataset.horse ? showJumping(b.dataset.horse, 'badge') : showFarm()));
  });
}

/** The farm inspection: Frau Berger asks five questions; enough right ones make the farm a Reitschule. */
function showInspection() {
  // the first inspection makes a Reitschule, the second a Pensionsstall: each with its own questions
  const before = game.get().stage, second = before === 'reitschule';
  quizScreen('inspector', second ? t.inspectionIntro2 : t.inspectionIntro, second ? t.inspectionQuiz2 : t.inspectionQuiz, (picked, ui) => {
    game.dispatch({ type: 'inspection', answers: picked });
    ui.end(game.get().stage !== before ? (second ? t.inspectionPassed2 : t.inspectionPassed) : t.inspectionFailed(quizScore(picked)));
  });
}

/**
 * A quiz in a speech bubble over the farm: the speaker asks each question (the answers shuffled per day by
 * answerOrder, so the right one, first in the data, moves around), says right or wrong, then hands the chosen answers to `done`.
 */
function quizScreen(who: 'oma' | 'inspector', intro: string, questions: { q: string; a: { text: string }[] }[],
  done: (picked: number[], ui: { say: (text: string) => void; buttons: (html: string, on: (b: HTMLButtonElement) => void) => void; end: (text: string) => void }) => void) {
  const $ = screen(`<canvas id="farm" aria-hidden="true"></canvas>
    <section class="overlay talk"><div class="sheet bubble"><img src="${portrait(who)}" alt="${who === 'oma' ? t.omaHanne : t.inspector}"><p aria-live="polite"></p>
      <div class="answers"></div></div></section>`);
  const farm = startFarm($<HTMLCanvasElement>('farm'), { herd: game.get().horses.map((h) => h.look), canter: false, plots: farmPlots(game.get()) });
  farm.then((f) => f.setAway(offMapPasture(game.get().horses)));
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
    const q = questions[i], order = answerOrder(q.a.length, game.get().day * 31 + i * 7 + 3);
    say.textContent = q.q;
    buttons(order.map((k) => `<button type="button" data-a="${k}">${q.a[k].text}</button>`).join(''), (b) => {
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
  : p.id === 'arena' ? { ...p, level: s.built.arena, flags: atLeast(s, 'reitschule') } : p);

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
    <button id="compare" class="corner left" type="button">${t.compare}</button>
    <section id="card" class="overlay" hidden></section>`);
  const boxes = $('boxes');
  explain('stable');
  const render = () => {
    const st = game.get();
    boxes.innerHTML = Array.from({ length: stalls(st) }, (_, i) => {
      const h = st.horses[i];
      return h
        ? `<div class="box" data-box="${i}"><button class="nameplate${isSick(h) ? ' sick' : ''}${h.owner ? ' guest' : ''}" type="button" data-horse="${h.id}">${esc(h.name)}</button>
            <button class="horse-hit" type="button" data-horse="${h.id}" aria-label="${esc(h.name)}"></button>
            <div class="needs">${NEEDS.map((n) => needBar(h, n, stalls(st) <= 3)).join('')}</div></div>`
        : `<div class="box" data-box="${i}"><span class="nameplate empty">${t.freeStall}</span></div>`;
    }).join('');
    boxes.querySelectorAll<HTMLButtonElement>('[data-horse]').forEach((b) => b.addEventListener('click', () => showCard(b.dataset.horse!)));
    place();
  };
  const bar = wireTopBar($, render);
  $('to-farm').addEventListener('click', () => showFarm());
  // all own horses side by side: both skills against their breed's limit, and this week's gain
  $('compare').addEventListener('click', () => {
    const card = $('card'), mine = game.get().horses.filter(own);
    const row = (name: string, value: number, max: number, week: number, kind: string) => `<div class="need"><span>${name}</span><span class="bar skill ${kind}" style="--scope:${max}%"><i style="width:${value}%"></i></span><small>${t.thisWeek(week, value >= max)}</small></div>`;
    card.innerHTML = `<div class="sheet compare"><h2>${t.compareTitle}</h2><p class="oma">${t.compareHow}</p>
      ${mine.map((h) => { const [j, x] = gained(h, 7); return `<section><h3>${esc(h.name)} <small>${BREEDS[h.breed].label}</small></h3>
        ${row(t.jumping, h.skills.jumping, scope(h), j, 'jump')}${row(t.crossCountry, h.skills.crossCountry, xcScope(h), x, 'xc')}</section>`; }).join('')}
      <button type="button" id="close-card">${t.close}</button></div>`;
    card.hidden = false;
    $('close-card').addEventListener('click', () => { card.hidden = true; });
  });
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
    // two columns: the horse and how it is on the left, what it can do and what to do on the right
    card.innerHTML = `<div class="sheet horse-card"><div class="col">
      <canvas id="portrait" width="96" height="72"></canvas>
      <form id="rename" class="rename"><h2>${esc(h.name)}</h2>${h.owner ? '' : `<button type="button" id="rename-start" class="small">${t.rename}</button>`}</form>
      <p>${BREEDS[h.breed].label} · ${COATS[h.look.coat].label}</p>
      ${h.owner ? `<p>${t.ownedBy(esc(h.owner.name), h.owner.pay)}</p>${h.owner.unhappy ? `<p class="status sick">${t.boarderUnhappy(esc(h.owner.name))}</p>` : ''}` : ''}
      ${h.rider ? `<p>${t.riddenBy(esc(h.rider.name), h.rider.pay)}</p><button type="button" id="end-part" class="small">${t.endPart}</button>` : ''}
      ${NEEDS.map((n) => needBar(h, n, true)).join('')}
      <p class="status ${isSick(h) ? 'sick' : ''}">${isSick(h) ? t.sick(esc(h.name)) : h.rest ? t.resting(esc(h.name)) : t.healthy(esc(h.name))}</p>
      </div><div class="col">
      <div class="need"><img class="icon" src="${icon('energy')}" alt=""><span>${t.jumping}</span><span class="bar skill jump" style="--scope:${scope(h)}%"><i style="width:${h.skills.jumping}%"></i></span></div>
      <div class="need"><img class="icon" src="${icon('energy')}" alt=""><span>${t.crossCountry}</span><span class="bar skill xc" style="--scope:${xcScope(h)}%"><i style="width:${h.skills.crossCountry}%"></i></span></div>
      ${own(h) ? progressChart(h) : ''}
      <p>${t.canReach(topClass(h))}</p>
      ${!isSick(h) ? '' : canPayVet(game.get()) ? `<button id="vet" type="button">${t.callVet(DATA.vet.cost)}</button>` : `<p>${t.vetTooExpensive(DATA.vet.cost)} ${t.askBank}</p>`}
      <button id="care" type="button">${t.care}</button>
      ${own(h) ? `<button id="routine" type="button"${cantWork(h, DATA.routine.energy) ? ' disabled' : ''}>${t.routine}</button>${cantWork(h, DATA.routine.energy) ? `<p class="status">${t.routineCant} ${t.cantWork[cantWork(h, DATA.routine.energy)!]}</p>` : ''}` : ''}
      <button id="close-card" type="button">${t.close}</button></div></div>`;
    card.hidden = false;
    horseSheet(h.look, 'idle').then((sheet) => $<HTMLCanvasElement>('portrait').getContext('2d')!.drawImage(sheet, 128 + 16, 30, 96, 72, 0, 0, 96, 72));
    $('close-card').addEventListener('click', () => { card.hidden = true; });
    $('care').addEventListener('click', () => showCare(h.id));
    card.querySelector('#routine')?.addEventListener('click', () => showRoutine(h.id));
    card.querySelector('#vet')?.addEventListener('click', () => { game.dispatch({ type: 'vet', horse: h.id }); showCard(h.id); });
    // ending a part-board asks once more: the rider won't come back
    card.querySelector('#end-part')?.addEventListener('click', (e) => {
      const b = e.currentTarget as HTMLButtonElement;
      if (b.dataset.sure) { game.dispatch({ type: 'endPartBoard', horse: h.id }); showCard(h.id); } else { b.dataset.sure = '1'; b.textContent = t.endPartSure; }
    });
    // a name of its own: the field replaces the heading; the Sim says no to an empty or taken name
    card.querySelector('#rename-start')?.addEventListener('click', () => {
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
    $('packs').innerHTML = DATA.hayPacks.map((p, i) => {
      const why = hayWaits(s, i);
      return `<button type="button" class="choice" data-pack="${i}"${why ? ' disabled' : ''}><b>${hayOnCredit(s, i) ? t.hayPackCredit(p.bales, p.price) : t.hayPack(p.bales, p.price)}</b>${why ? `<small>${t.hayWaits[why]}</small>` : ''}</button>`;
    }).join('');
    $('credit').hidden = !DATA.hayPacks.some((_, i) => hayOnCredit(s, i) && !hayWaits(s, i));
    $('packs').querySelectorAll<HTMLButtonElement>('[data-pack]').forEach((b) => b.addEventListener('click', async () => {
      const i = Number(b.dataset.pack), s = game.get(), price = DATA.hayPacks[i].price;
      if (hayOnCredit(s, i) && !(await ask(t.debtWarn(price, s.debt + price), t.debtYesHay))) return; // never into debt without a warning (#122)
      game.dispatch({ type: 'buyHay', pack: i });
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

/**
 * The care course (#72): the horse got ready step by step, led at a walk on the arena, the lesson (the pupil's, if
 * there is one), and everything put away. The Sim says which step a thing on a place is, or what must come first;
 * Oma Hanne says it at the top.
 */
function showRoutine(id: string, pupil?: Pupil, exam?: (wrong: number) => void) {
  const s0 = game.get(), h = s0.horses.find((x) => x.id === id)!, kid = pupil ? pupilKid(pupil) : avatarKid(s0.avatar);
  const $ = screen(`<canvas id="routine" aria-label="${t.routineTitle(esc(h.name))}"></canvas>${topBar(t.sleepBusy(h.name))}
    <h2 class="care-title">${t.routineTitle(esc(h.name))}</h2>
    <p id="say" class="how" role="status"></p>
    <div class="routine-bar"><span id="count"></span>${exam ? '' : `<button id="tip" type="button" class="small">${t.routineTip}</button>`}<button id="leave" type="button" class="small">${t.routineLeave}</button></div>
    <div id="spot-names" class="spot-names" aria-hidden="true"></div><div id="spot-hint" class="spot-hint" hidden></div>
    <nav class="tools things">${THINGS.map((th) => `<button type="button" data-thing="${th}" aria-pressed="false">${t.things[th]}</button>`).join('')}</nav>
    <section id="ride" class="overlay ride" hidden></section>
    <section id="routine-end" class="overlay" hidden><div class="sheet ask"><p role="status"></p><button type="button" id="routine-back">${pupil ? t.toFarm : t.toStable}</button></div></section>`);
  const back = () => (pupil || exam ? showFarm() : showStable());
  // in the exam (riding badge 2) the wrong steps count, and the child sees them
  const count = () => { $('count').textContent = t.routineCount(done.length, STEPS.length) + (exam ? ` · ${t.badge2Mistakes(wrong, DATA.badge2.maxWrong)}` : ''); };
  // a night's sleep ends the course: the pupil and the day it was for are gone
  const bar = wireTopBar($, () => { if (game.get().day !== s0.day) back(); });
  let done: StepId[] = [], wrong = 0, thing: Thing = 'hand';
  const missed = new Set<string>(); // the same wrong tap again is no new mistake
  const say = (text: string) => { $('say').textContent = text; };
  const scene = startRoutine($<HTMLCanvasElement>('routine'), { look: h.look, kid, straps: DATA.routine.straps[h.breed], onTap: (at) => tap(at) });
  const HORSE: Spot[] = ['head', 'neck', 'body', 'belly', 'legs', 'tail'];
  // a name plate on every place (#124), following the scene's places as they move (the box door, a new screen size)
  const spots = () => JSON.parse($('routine').dataset.spots ?? '{}') as Partial<Record<Spot, string>>, xy = (p: string) => p.split(',').map(Number);
  function names() {
    const sp = spots();
    $('spot-names').innerHTML = (Object.keys(t.spots) as Spot[]).filter((p) => sp[p]).map((p) => {
      const [x, y] = xy(sp[p]!);
      return `<span style="left:${Math.min(x, innerWidth - 60)}px;top:${y}px">${t.spots[p]}</span>`;
    }).join('');
    hint(hinted);
  }
  new MutationObserver(names).observe($('routine'), { attributes: true, attributeFilter: ['data-spots'] });
  // the step a tip is about: its thing below and its place in the picture light up, until it is done (not in the exam)
  let hinted: StepId | null = null;
  function hint(id: StepId | null) {
    hinted = exam ? null : id;
    const s = STEPS.find((x) => x.id === hinted), at = s && spots()[s.at];
    app.querySelectorAll<HTMLButtonElement>('[data-thing]').forEach((b) => b.classList.toggle('lit', b.dataset.thing === s?.thing));
    const el = $('spot-hint');
    el.hidden = !at;
    if (at) { const [x, y] = xy(at); el.style.left = `${x}px`; el.style.top = `${y}px`; }
  }
  function pick(th: Thing) {
    thing = th;
    app.querySelectorAll<HTMLButtonElement>('[data-thing]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.thing === th)));
    scene.then((sc) => sc.cancel());
  }
  async function tap(at: Spot) {
    const r = tryStep(done, thing, at);
    // a pat with the hand is never wrong
    if (thing === 'hand' && HORSE.includes(at) && ('first' in r || ('why' in r && r.why === 'none'))) return say(t.routinePet(h.name));
    if ('first' in r) {
      // anything else out of turn is: Oma says what comes first, and why
      if (!missed.has(`${thing}:${at}`)) { missed.add(`${thing}:${at}`); wrong++; count(); }
      const why = t.routineWhy[r.why];
      if (exam) return wrong > DATA.badge2.maxWrong ? end() : say(why ?? t.badge2NotYet); // the exam gives no "what comes first"; too many: over at once
      hint(r.first);
      return say(`${why ? `${why} ` : ''}${t.routineFirst(t.steps[r.first], thingOf(r.first))}`);
    }
    if ('why' in r && r.why === 'none') hint(nextStep(done));
    if ('why' in r) return say(r.why === 'done' ? t.routineAgain : t.routineNone);
    const kind = GESTURE[r.step];
    if (kind) {
      say(kind === 'brush' ? t.routineBrush(t.steps[r.step]) : t.routineTaps(t.steps[r.step]));
      // brushing counts over the step's whole part, wherever it began (the neck is body too)
      if (!(await (await scene).gesture(kind, kind === 'brush' ? STEPS.find((x) => x.id === r.step)!.at : at))) return say('');
    }
    complete(r.step);
  }
  function complete(step: StepId) {
    done = [...done, step];
    hint(null);
    scene.then((sc) => sc.set(done));
    say(`✓ ${t.steps[step]}`);
    count();
    if (step === 'toArena') lead();
    if (finished(done)) end();
  }
  /** Leading the horse a round at a walk on the arena, then the lesson (the pupil's pays), then back in the aisle. */
  async function lead() {
    const box = $('ride'), before = game.get();
    box.innerHTML = `<canvas id="jumping" aria-label="${t.steps.ride}"></canvas><p id="jump-tip" class="jump-tip" role="status">${t.routineLead(esc(h.name))}</p>`;
    box.hidden = false;
    const tip = $('jump-tip'), gear = { helmet: true, vest: true, gloves: true };
    const round = await startJumping($<HTMLCanvasElement>('jumping'), {
      look: { ...h.look, saddle: true, blanket: h.look.blanket ?? '#3d6fd9' }, kid, gear, lead: true, course: WALK, window: 0, hold: 0, judge: () => 'early',
      onWaiting: (w) => { if (w === 'more') { tip.textContent = t.drawTip(w, h.look.build === 'pony'); tip.hidden = false; } else if (!w) tip.hidden = true; },
    });
    await round.run();
    round.stop();
    box.innerHTML = `<div class="sheet bubble"><img src="${omaPortrait()}" alt="${t.omaHanne}"><p>${pupil ? t.routineLessonPupil(esc(pupil.name)) : t.routineLesson}</p>
      <div class="answers"><button type="button" id="lesson-done">${t.next}</button></div></div>`;
    $('lesson-done').addEventListener('click', () => {
      box.hidden = true; box.innerHTML = '';
      if (pupil) {
        const { happy } = lessonOutcome(pupil, h);
        game.dispatch({ type: 'lesson', pupil: pupil.id, horse: id, prepared: wrong });
        const after = game.get(), paid = [...after.today].reverse().find((e) => e.what === 'lesson');
        if (after.lessonsGiven > before.lessonsGiven && paid) bar.toast(t.lessonDone(pupil.name, mood(happy), paid.amount, before.debt - after.debt));
      }
      complete('ride');
      say(t.routineBack);
    }, { once: true });
  }
  function end() {
    if (exam && wrong > DATA.badge2.maxWrong) return exam(wrong); // failed before the end: no care done, no walk
    const opening = badge2Waits(game.get())?.why === 'routine';
    game.dispatch({ type: 'routine', horse: id, wrong, ride: !pupil });
    if (exam) return exam(wrong);
    const sheet = $('routine-end');
    // Oma points to riding badge 2 if this care course was what it still needed
    sheet.querySelector('p')!.textContent = t.routineDone(h.name, !wrong) + (opening && !badge2Waits(game.get()) ? ` ${t.badge2Ready}` : '');
    sheet.hidden = false;
  }
  app.querySelectorAll<HTMLButtonElement>('[data-thing]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.thing as Thing)));
  const thingOf = (id: StepId) => t.things[STEPS.find((x) => x.id === id)!.thing ?? 'hand'];
  $('tip')?.addEventListener('click', () => { const n = nextStep(done); if (n) { say(t.routineNext(t.steps[n], thingOf(n))); hint(n); } });
  // stopping asks once more: everything done so far is lost
  $('leave').addEventListener('click', (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = exam ? t.badge2LeaveSure : t.routineLeaveSure; return; }
    if (exam) { game.dispatch({ type: 'badge2', horse: id, wrong: DATA.badge2.maxWrong + 1, faults: null }); return omaSays(t.badge2Left).then(() => showFarm()); } // stopping the exam fails it for today
    back();
  });
  $('routine-back').addEventListener('click', back);
  say(exam ? t.badge2Course(h.name, DATA.badge2.maxWrong) : pupil ? t.routineIntroPupil(pupil.name, h.name) : t.routineIntro(h.name));
  count();
  pick('hand');
  leave = () => { bar.unsubscribe(); scene.then((sc) => sc.stop()); };
}

/**
 * Cross-country practice (#73): Oma Hanne explains, then the ride from the side. The pace buttons pick Schritt, Trab or
 * Galopp; a tap on the land is "Hopp!". The round ends with how it went; the horse trains its cross-country skill.
 */
function showCrossCountry(id: string, examWrong?: number, show?: ShowClass) {
  const exam = examWrong !== undefined; // riding badge 2's second part (#74); `show`: a cross-country show's class (#75)
  const s0 = game.get(), h = s0.horses.find((x) => x.id === id)!, pony = h.look.build === 'pony';
  // a new track each ride (the skill grows); a show's the same all day, longer and higher by class
  const course = show ? xcCourse(s0.day * 1013 + 7, show) : xcCourse(s0.day * 1013 + h.skills.crossCountry * 31 + 1), [lo, hi] = course.optimum, N = course.obstacles.length;
  const rule = exam ? t.badge2Xc(DATA.badge2.maxFaults) : show ? t.xcShowRule(show, N) : '';
  const $ = screen(`<canvas id="xc" aria-label="${show ? t.xcShows.name(show) : t.crossCountry}"></canvas>
    <section id="xc-start" class="overlay talk"><div class="sheet bubble"><img src="${omaPortrait()}" alt="${t.omaHanne}"><div>${rule ? `<p><b>${rule}</b></p>` : ''}<ul class="rules">${howList(t.xcHow(pony))}</ul></div>
      <div class="answers"><button type="button" id="xc-go">${t.go}</button>${exam ? '' : `<button type="button" id="xc-leave">${t.back}</button>`}</div></div></section>
    <p id="xc-hud" class="jump-hud" aria-live="off"></p><p id="xc-tip" class="jump-tip" role="status" hidden></p>
    <div class="xc-breath"><span>${t.stamina}</span><span class="bar"><i id="xc-breath"></i></span></div>
    <nav class="tools paces">${PACES.map((p) => `<button type="button" data-pace="${p}" aria-pressed="${p === 'trot'}">${t.paces[p]}</button>`).join('')}</nav>
    <section id="xc-end" class="overlay" hidden><div class="sheet ask"><p role="status"></p><button type="button" id="xc-back">${t.toFarm}</button></div></section>`);
  let tipTimer = 0, tiredSaid = false, warned = -1;
  const tip = $('xc-tip'), say = (text: string) => { tip.textContent = text; tip.hidden = false; clearTimeout(tipTimer); tipTimer = window.setTimeout(() => { tip.hidden = true; }, 2500); };
  const hud = (r: XcRound) => {
    // how the time goes so far: ahead of or behind the target time for this part of the track
    const part = Math.min(1, r.s / course.length), tempo = r.s < 20 ? '' : ` · ${t.xcTempo[r.t < lo * part - 2 ? 'fast' : r.t > hi * part + 2 ? 'slow' : 'ok']}`;
    $('xc-hud').textContent = t.xcHud(Math.min(r.next + 1, N), N, r.faults, Math.floor(r.t), lo, hi) + (exam ? t.badge2HudMax(DATA.badge2.maxFaults) : '') + tempo;
    $('xc-breath').style.width = `${Math.round(r.stamina * 100)}%`;
    if (r.stamina < DATA.crossCountry.tired && !tiredSaid && tip.hidden) { tiredSaid = true; say(t.xcTired(pony)); } // not over a warning
    if (r.stamina > DATA.crossCountry.tired + 0.1) tiredSaid = false;
    // water or a ditch ahead at a gallop: Oma calls out once
    const o = course.obstacles[r.next];
    if (o && (o.kind === 'water' || o.kind === 'ditch') && o.at - r.s < 16 && o.at - r.s > 0 && r.pace === 'gallop' && warned !== r.next) { warned = r.next; say(t.xcAhead[o.kind]); }
  };
  const ride = startCrossCountry($<HTMLCanvasElement>('xc'), {
    look: h.look, kid: avatarKid(s0.avatar), course, window: xcWindow(h, show), drain: xcDrain(h), stamina: h.needs.energy / 100,
    // too fast at water or a ditch, or too slow to jump: the horse comes again at a trot
    onChange: hud, onRefuse: (why) => { say(t.xcRefused[why]); if (why !== 'late') pick('trot'); },
  });
  hud(newXcRound(h.needs.energy / 100));
  const pick = (p: Pace) => {
    ride.then((r) => r.setPace(p));
    app.querySelectorAll<HTMLButtonElement>('[data-pace]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pace === p)));
  };
  app.querySelectorAll<HTMLButtonElement>('[data-pace]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.pace as Pace)));
  // the space bar is "Hopp!" too, unless a button has the focus; two fingers must not zoom the page
  const key = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); ride.then((r) => r.hopp()); } };
  const noZoom = (e: Event) => e.preventDefault();
  addEventListener('keydown', key);
  document.addEventListener('gesturestart', noZoom);
  $('xc-go').addEventListener('click', async () => {
    $('xc-start').hidden = true;
    const end = await (await ride).run(), faults = end.faults;
    clearTimeout(tipTimer); tip.hidden = true;
    const p = $('xc-end').querySelector('p')!;
    if (show) {
      const s = game.get(), { table, rank, prize } = showResult(s, s.horses.find((x) => x.id === id)!, faults, s.avatar.name, show, true);
      game.dispatch({ type: 'xcShow', horse: id, faults, showClass: show });
      if (game.get().lastXcShowDay !== s.day) return showFarm(); // the Sim said no: no podium for a show not ridden
      podium($('xc-end').firstElementChild as HTMLElement, table);
      p.textContent = `${t.showPlace(rank, prize)} ${t.xcTime(end.t, lo, hi)} ${t.skillNow(t.crossCountry, h.skills.crossCountry, xcScope(h))}`; // a show doesn't train
    } else if (exam) {
      // the badge's round: passed or another try tomorrow; the rosette for a pass
      game.dispatch({ type: 'badge2', horse: id, wrong: examWrong, faults });
      const passed = game.get().badges >= 2;
      if (passed) p.insertAdjacentHTML('beforebegin', `<img class="rosette big" src="${icon('rosette')}" alt="${t.badge2Name}">`);
      p.textContent = passed ? t.badge2Passed : `${t.badge2Failed(faults, DATA.badge2.maxFaults)} ${t.xcTime(end.t, lo, hi)}`;
    } else {
      const practising = badge2Waits(game.get())?.why === 'practise';
      game.dispatch({ type: 'xcTrain', horse: id, faults });
      const now = game.get().horses.find((x) => x.id === id)!.skills.crossCountry, grew = t.skillGain(t.crossCountry, now - h.skills.crossCountry, now, xcScope(h));
      // Oma Hanne points to riding badge 2 once the practice is enough
      const ready = practising && !badge2Waits(game.get()) ? ` ${t.badge2Ready}` : '';
      p.textContent = (faults ? `${t.xcFaults(faults, h.name)} ${t.xcTime(end.t, lo, hi)} ${grew}` : `${h.skills.crossCountry >= xcScope(h) ? t.xcCleanTop : t.xcClear(h.name)} ${grew}`) + ready;
    }
    $('xc-end').hidden = false;
  }, { once: true });
  $('xc-back').addEventListener('click', () => showFarm());
  $('xc-leave')?.addEventListener('click', () => showFarm());
  leave = () => { clearTimeout(tipTimer); removeEventListener('keydown', key); document.removeEventListener('gesturestart', noZoom); ride.then((r) => r.stop()); };
}

/**
 * A horse's progress over the last days (#78): one line per discipline, its breed's limit as a dashed line, and what
 * the last 7 days brought. Plain SVG in the game's colours, sized with the card.
 */
function progressChart(h: Horse) {
  // days from the left (two weeks ago) to the right (today); a young horse's line starts where its log does; the
  // height goes up to the higher of its two limits, so a round's step shows
  const D = DATA.progress.days, pts = [...h.log, [h.skills.jumping, h.skills.crossCountry]], W = 200, H = 64, top = Math.max(scope(h), xcScope(h), 1);
  const x = (i: number) => Math.round(4 + ((D + 1 - pts.length + i) * (W - 8)) / D), y = (v: number) => Math.round(H - 4 - (v * (H - 8)) / top);
  const line = (k: 0 | 1) => pts.map((p, i) => `${x(i)},${y(p[k])}`).join(' ');
  const limit = (v: number, c: string) => `<line x1="4" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="${c}" stroke-width="2" stroke-dasharray="4 3"/>`;
  const days = Array.from({ length: D + 1 }, (_, i) => `<line x1="${x(i - (D + 1 - pts.length))}" x2="${x(i - (D + 1 - pts.length))}" y1="${H - 4}" y2="${H}" stroke="#7f4d2b"/>`).join('');
  const [j, xc] = gained(h, 7);
  return `<div class="progress"><h3>${t.progressTitle(D)}</h3>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t.weekGain(j, xc)}" shape-rendering="crispEdges">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#efe6d0"/>${days}${limit(scope(h), '#3c9a3c')}${limit(xcScope(h), '#3d6fd9')}
      <polyline points="${line(0)}" fill="none" stroke="#3c9a3c" stroke-width="5"/><polyline points="${line(1)}" fill="none" stroke="#3d6fd9" stroke-width="2"/>
    </svg>
    <p class="axis"><span>${t.chartFrom}</span><span>${t.chartToday}</span></p>
    <p class="legend"><span class="jump">■ ${t.jumping}</span> <span class="xc">■ ${t.crossCountry}</span> <span>${t.chartLimits}</span></p><p>${t.weekGain(j, xc)}</p></div>`;
}

/**
 * The pasture (#79): every horse of the farm grazing, how many places they take of how many there are (a pony 1, a
 * big horse 2), and land to add, step by step from the Reitschule on.
 */
function showPasture() {
  const s = game.get(), why = buildWaits(s, 'pasture'), P = DATA.build.pasture;
  const $ = screen(`<canvas id="pasture" aria-hidden="true"></canvas>${topBar()}
    <aside class="pasture-panel"><h2>${t.pastureTitle}</h2><p id="use" role="status">${t.pastureUse(grazing(s), pasture(s))}${grazing(s) > pasture(s) ? ` – ${t.pastureCrowded}` : ''}</p>
      <button type="button" id="grow" class="choice"${why ? ' disabled' : ''}><b>${t.pastureGrow(P.places, P.cost)}</b>${why ? `<small>${t.pastureWaits[why]}</small>` : ''}</button><button type="button" id="to-farm">${t.toFarm}</button>
      <p class="oma">${t.pastureHow}</p></aside>`);
  const scene = startPasture($<HTMLCanvasElement>('pasture'), { herd: s.horses.map((h) => h.look), built: s.built.pasture, max: P.max });
  const bar = wireTopBar($, () => { if (game.get().day !== s.day) showPasture(); }); // a new morning: money and horses may have changed
  $('grow').addEventListener('click', () => {
    game.dispatch({ type: 'build', what: 'pasture' });
    if (game.get().built.pasture > s.built.pasture) { showPasture(); omaSays(t.pastureGrown); } // the new fence on the picture
  });
  $('to-farm').addEventListener('click', () => showFarm());
  leave = () => { bar.unsubscribe(); scene.then((sc) => sc.stop()); };
}

/**
 * Riding badge 2 (#74): the care course without tips, its wrong steps counted; too many and it is over for today,
 * else on to the cross-country round, which decides.
 */
function badge2Exam(id: string) {
  showRoutine(id, undefined, (wrong) => {
    if (wrong > DATA.badge2.maxWrong) {
      game.dispatch({ type: 'badge2', horse: id, wrong, faults: null });
      return omaSays(t.badge2CourseFailed).then(() => showFarm());
    }
    return omaSays(t.badge2CourseDone(wrong)).then(() => showCrossCountry(id, wrong));
  });
}
