/**
 * The screens: start, farm map, stable, and the horse card. Each screen fills #app and stops its scene when the
 * next one starts. Screens only show the Sim state and send actions; the rules live in src/sim/.
 */
import credits from '../credits.json';
import { game } from '../game';
import { horseSheet } from '../horses/compose';
import { BREEDS, COATS } from '../horses/look';
import { startFarm } from '../scene';
import { bounds, waitingSpots } from '../scene/buildings';
import { avatarKid, HAIR, HAIR_STYLES, JACKET, pupilKid, SKIN } from '../riders/look';
import { drawKid } from '../scene/kids';
import { startJumping } from '../scene/jumping';
import { omaPortrait } from '../scene/oma';
import { PLOTS, PROPS } from '../scene/farm';
import { startStable } from '../scene/stable';
import { parseSave } from '../sim/save';
import { DATA } from '../sim/data';
import { startCare } from '../scene/care';
import { type Avatar, badgeWaits, quizScore, nextShowDay, showResult, type ShowRow, showWaits, CARE, canBuild, canFeed, canLoan, canPayVet, canQuickCare, cantWork, type Care, fit, hayOnCredit, type Horse, isSick, jumpWindow, lessonOutcome, missed, mood, NEEDS, type News, type Pupil, stalls, takeOff } from '../sim/state';
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

/** The farm map; with `intro`, Oma Hanne first hands the farm over in a few speech bubbles. */
export function showFarm(intro = false) {
  const $ = screen(`<canvas id="farm" aria-label="${t.title}"></canvas><div id="labels" class="labels" hidden></div>${topBar()}
    <section id="shop" class="overlay" hidden><div class="sheet ask shop"></div></section>
    <section id="lesson" class="overlay" hidden><div class="sheet ask"></div></section>
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
    else if (target === 'board') showShop();
    else if (target === 'arena') arena();
    else if (target === 'pasture') bar.toast(t.pasture);
    else if (target === 'feed') bar.toast(t.feedStore(s.feed));
    else if (!canBuild(s)) bar.toast(t.freePlot);
  };
  const bar = wireTopBar($, () => { if (!$('shop').hidden) shop(); pupils(); });
  /** The arena: a lesson for the first waiting pupil, jumping practice, and the riding badge or, once passed, the show. */
  function arena() {
    const sheet = $('lesson'), s = game.get(), wait = badgeWaits(s), show = showWaits(s);
    const showWhy = show === 'notToday' ? t.showWaits.notToday(nextShowDay(s)) : show === 'money' ? t.showWaits.money(DATA.shows.fee) : show && t.showWaits[show];
    sheet.firstElementChild!.innerHTML = `<h2>${t.places.arena}</h2>
      <button type="button" id="give-lesson">${t.giveLesson}</button><button type="button" id="practise">${t.practiseJumping}</button>
      ${wait?.why === 'passed' ? `<button type="button" id="show"${show ? ' disabled aria-describedby="show-why"' : ''}>${t.show}</button>${showWhy ? `<p class="oma" id="show-why">${showWhy}</p>` : ''}`
        : `<button type="button" id="badge"${wait ? ' disabled aria-describedby="badge-why"' : ''}>${t.ridingBadge}</button>
      ${wait ? `<p class="oma" id="badge-why">${wait.why === 'practise' ? t.badgeWaits.practise(wait.rounds) : t.badgeWaits[wait.why]}</p>` : ''}`}
      <button type="button" id="close-lesson">${t.close}</button>`;
    sheet.querySelector('#badge')?.addEventListener('click', showBadge);
    sheet.querySelector('#show')?.addEventListener('click', () => pickHorse(t.showEnter(DATA.shows.fee), (id) => showJumping(id, 'show')));
    $('give-lesson').addEventListener('click', () => {
      const p = game.get().pupils[0];
      if (p) chooseHorse(p); else { sheet.hidden = true; bar.toast(t.noPupils); }
    });
    $('practise').addEventListener('click', () => pickHorse(t.whichHorse, (id) => showJumping(id)));
    $('close-lesson').addEventListener('click', () => { sheet.hidden = true; });
    sheet.hidden = false;
  }
  /** Pick a horse for a jumping round; each one too tired, resting or sick says so. */
  function pickHorse(title: string, go: (id: string) => void) {
    const sheet = $('lesson');
    sheet.firstElementChild!.innerHTML = `<h2>${title}</h2>
      ${game.get().horses.map((h) => {
        const why = cantWork(h, DATA.jumping.energy);
        return `<button type="button" data-horse="${h.id}"${why ? ' disabled' : ''}>${esc(h.name)}${why ? ` · ${t.cantWork[why]}` : ''}</button>`;
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
      <p>${t.inStore(s.feed)}${s.debt ? ` · ${t.owe(s.debt)}` : ''}</p>
      ${s.badges ? `<p class="calendar">${t.nextShow(nextShowDay(s), nextShowDay(s) === s.day)}</p>` : ''}
      <h3>${t.buyHay}</h3>
      ${DATA.hayPacks.map((p, i) => `<button type="button" data-pack="${i}">${hayOnCredit(s, i) ? t.hayPackCredit(p.bales, p.price) : t.hayPack(p.bales, p.price)}</button>`).join('')}
      ${DATA.hayPacks.some((_, i) => hayOnCredit(s, i)) ? `<p class="oma">${t.omaCredit}</p>` : ''}
      ${s.money < DATA.vet.cost && canLoan(s) ? `<button type="button" id="loan">${t.loan(DATA.loan.amount)}</button><p class="oma">${t.omaLoan}</p>` : ''}
      <button type="button" id="close-shop">${t.close}</button>`;
    $('shop').querySelectorAll<HTMLButtonElement>('[data-pack]').forEach((b) => b.addEventListener('click', () => {
      game.dispatch({ type: 'buyHay', pack: Number(b.dataset.pack) });
      bar.toast(t.bought(DATA.hayPacks[Number(b.dataset.pack)].bales));
    }));
    $('shop').querySelector('#loan')?.addEventListener('click', () => { game.dispatch({ type: 'loan' }); bar.toast(t.lent(DATA.loan.amount)); });
    $('close-shop').addEventListener('click', () => { $('shop').hidden = true; });
  }
  function showShop() { shop(); $('shop').hidden = false; }
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
  labels.innerHTML = places.map(([id, x, y]) => `<button class="label" type="button" data-place="${id}" data-x="${x}" data-y="${y}">${t.places[id] ?? id}</button>`).join('')
    + '<span id="pupils"></span>';
  labels.querySelectorAll<HTMLButtonElement>('[data-place]').forEach((b) => b.addEventListener('click', () => tap(b.dataset.place!)));
  /** Puts every label over its world point, centred (set here, not with a CSS transform: WebKit then misses taps on it). */
  const place = () => farm.then((f) => {
    labels.hidden = false; // shown once placed, not stacked in a corner while the farm loads
    labels.querySelectorAll<HTMLElement>('[data-x]').forEach((el) => {
      const p = f.toScreen(Number(el.dataset.x), Number(el.dataset.y));
      el.style.left = `${p.left - el.offsetWidth / 2}px`; el.style.top = `${p.top - el.offsetHeight / 2}px`;
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
      if (p) chooseHorse(p);
    }));
    // sick horses, and those resting after the vet, stay in the stable, off the pasture
    const inStall = game.get().horses.flatMap((h, i) => (isSick(h) || h.rest ? [i] : []));
    farm.then((f) => { f.setPupils(waiting.map(pupilKid)); f.setAway(inStall); });
    place();
  }
  const farm = startFarm($<HTMLCanvasElement>('farm'), {
    herd: game.get().horses.map((h) => h.look), canter: false, onTap: tap, onLayout: place,
  });
  pupils();
  leave = () => { bar.unsubscribe(); farm.then((f) => f.stop()); };
}

/** A jumping round: practice, the badge's round (after its quiz), or a show. */
function showJumping(id: string, kind: 'train' | 'badge' | 'show' = 'train') {
  const h = game.get().horses.find((x) => x.id === id)!;
  const $ = screen(`<canvas id="jumping" aria-label="${kind === 'show' ? t.show : kind === 'badge' ? t.ridingBadge : t.practiseJumping}"></canvas>
    <section id="jump-start" class="overlay talk"><div class="sheet bubble"><img src="${omaPortrait()}" alt="${t.omaHanne}"><p>${t.jumpHow(h.look.build === 'pony')}</p>
      <div class="answers"><button type="button" id="jump-go">${t.go}</button><button type="button" id="jump-leave">${t.back}</button></div></div></section>
    <section id="jump-end" class="overlay" hidden><div class="sheet ask"><p role="status"></p><button type="button" id="jump-back">${t.toFarm}</button></div></section>`);
  const round = startJumping($<HTMLCanvasElement>('jumping'), {
    look: h.look, kid: avatarKid(game.get().avatar), jumps: DATA.jumping.jumps, window: jumpWindow(h), takeOff: (o) => takeOff(h, o), missed: (o) => missed(h, o),
  });
  // pointerdown, not click: the take-off timing should not wait for the finger to lift
  $('jumping').addEventListener('pointerdown', () => round.then((r) => r.tap()));
  $('jump-go').addEventListener('click', async () => {
    $('jump-start').hidden = true;
    const faults = await (await round).run(), end = $('jump-end');
    if (kind === 'show') {
      // the podium: the first three on their steps, then everyone with their points
      const s = game.get(), { table, rank, prize } = showResult(s, s.horses.find((x) => x.id === id)!, faults, s.avatar.name);
      game.dispatch({ type: 'show', horse: id, faults });
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
  });
  $('jump-back').addEventListener('click', () => showFarm());
  $('jump-leave').addEventListener('click', () => showFarm());
  leave = () => { round.then((r) => r.stop()); };
}

/**
 * Riding badge 1: Oma Hanne asks five care questions (the answers in turn order, the right one not always first),
 * then the player picks a horse for the jumping round.
 */
function showBadge() {
  const $ = screen(`<canvas id="farm" aria-hidden="true"></canvas>
    <section class="overlay talk"><div class="sheet bubble"><img src="${omaPortrait()}" alt="${t.omaHanne}"><p aria-live="polite"></p>
      <div class="answers"></div></div></section>`);
  const farm = startFarm($<HTMLCanvasElement>('farm'), { herd: game.get().horses.map((h) => h.look), canter: false });
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
    if (i === t.quiz.length) return quizDone();
    const q = t.quiz[i], order = q.a.map((_, k) => (k + i) % q.a.length); // rotate, so the right answer moves around
    say.textContent = q.q;
    buttons(order.map((k) => `<button type="button" data-a="${k}">${q.a[k].icon ? `<img class="icon" src="${icon(q.a[k].icon!)}" alt="">` : ''}${q.a[k].text}</button>`).join(''), (b) => {
      const right = b.dataset.a === '0'; // shown to the child; the Sim scores the answers itself
      picked.push(Number(b.dataset.a));
      say.textContent = right ? t.quizRight : t.quizWrong(q.a[0].text);
      next(() => ask(i + 1));
    });
  }
  function quizDone() {
    game.dispatch({ type: 'badgeQuiz', answers: picked });
    const s = game.get(), right = quizScore(picked);
    if (s.badgeQuizDay !== s.day) {
      say.textContent = t.quizFailed(right);
      return buttons(`<button type="button">${t.toFarm}</button>`, () => showFarm());
    }
    say.textContent = t.quizDone(right);
    buttons(game.get().horses.map((h) => {
      const why = cantWork(h, DATA.jumping.energy);
      return `<button type="button" data-horse="${h.id}"${why ? ' disabled' : ''}>${esc(h.name)}${why ? ` · ${t.cantWork[why]}` : ''}</button>`;
    }).join('') + `<button type="button" data-back>${t.back}</button>`, (b) => (b.dataset.horse ? showJumping(b.dataset.horse, 'badge') : showFarm()));
  }
  say.textContent = t.badgeIntro;
  next(() => ask(0));
}

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
      <h2>${esc(h.name)}</h2>
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
  }
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
