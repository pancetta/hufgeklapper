/**
 * The screens: start, farm map, stable, and the horse card. Each screen fills #app and stops its scene when the
 * next one starts. Screens only show the Sim state and send actions; the rules live in src/sim/.
 */
import credits from '../credits.json';
import { game } from '../game';
import { horseSheet } from '../horses/compose';
import { BREEDS, COATS } from '../horses/look';
import { startFarm } from '../scene';
import { bounds } from '../scene/buildings';
import { PLOTS, PROPS } from '../scene/farm';
import { startStable } from '../scene/stable';
import { canBuild, type Horse, isSick, NEEDS, stalls } from '../sim/state';
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

export function showStart() {
  const $ = screen(`
    <canvas id="farm" aria-hidden="true"></canvas>
    <main class="start">
      <h1 class="plaque">${t.title}</h1>
      <button id="start" type="button">${t.start}</button>
      <button id="show-credits" class="small corner" type="button">${t.credits}</button>
    </main>
    ${creditsSheet()}`);
  $('start').addEventListener('click', () => { game.start(Date.now() % 100000); showFarm(); });
  $('show-credits').addEventListener('click', () => { $('credits').hidden = false; });
  $('close-credits').addEventListener('click', () => { $('credits').hidden = true; });
  const farm = startFarm($<HTMLCanvasElement>('farm'));
  leave = () => { farm.then((f) => f.stop()); };
}

/** The top bar: money, day, sleep and the menu. */
function topBar() {
  return `
    <header class="topbar">
      <span class="stat" id="money"><img class="icon" src="${icon('coin')}" alt="">${t.money(game.get().money)}</span>
      <span class="stat" id="day">${t.day(game.get().day)}</span>
      <span class="spacer"></span>
      <button id="sleep" type="button"><img class="icon" src="${icon('moon')}" alt="">${t.sleep}</button>
      <button id="menu" type="button">${t.menu}</button>
    </header>
    <section id="menu-sheet" class="overlay" hidden>
      <div class="sheet menu">
        <button id="resume" type="button">${t.resume}</button>
        <button id="to-start" type="button">${t.toStart}</button>
      </div>
    </section>
    <div id="night" class="night" hidden><p></p></div>
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
      setTimeout(() => { night.hidden = true; }, 900);
    }, 900);
  });
  $('menu').addEventListener('click', () => { $('menu-sheet').hidden = false; });
  $('resume').addEventListener('click', () => { $('menu-sheet').hidden = true; });
  $('to-start').addEventListener('click', showStart);
  const unsubscribe = game.subscribe(() => {
    $('money').lastChild!.textContent = t.money(game.get().money);
    $('day').textContent = t.day(game.get().day);
    onChange();
  });
  let timer = 0;
  const toast = (text: string) => {
    const el = $('toast');
    el.textContent = text; el.hidden = false;
    clearTimeout(timer); timer = window.setTimeout(() => { el.hidden = true; }, 2600);
  };
  return { unsubscribe, toast };
}

export function showFarm() {
  const $ = screen(`<canvas id="farm" aria-label="${t.title}"></canvas><div id="labels" class="labels" hidden></div>${topBar()}`);
  const tap = (target: string) => {
    const s = game.get();
    if (target === 'stall') showStable();
    else if (target === 'board') bar.toast(t.board);
    else if (target === 'arena') bar.toast(t.arena);
    else if (target === 'pasture') bar.toast(t.pasture);
    else if (target === 'feed') bar.toast(t.feedStore(s.feed));
    else if (!canBuild(s)) bar.toast(t.freePlot);
  };
  const bar = wireTopBar($, () => {});
  // labels on the places: [id, world x, world y]
  const board = PROPS.find(([n]) => n === 'board')!;
  const places: [string, number, number][] = [
    ...PLOTS.map((p): [string, number, number] => {
      const b = bounds(p);
      return [p.id, (b.x0 + b.x1) / 2, p.id === 'stall' ? b.y1 - 20 : (b.y0 + b.y1) / 2];
    }),
    ['board', board[1], board[2] - 36],
  ];
  const labels = $('labels');
  labels.innerHTML = places.map(([id]) => `<button class="label" type="button" data-place="${id}">${t.places[id] ?? id}</button>`).join('');
  labels.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => tap(b.dataset.place!)));
  const farm = startFarm($<HTMLCanvasElement>('farm'), {
    herd: game.get().horses.map((h) => h.look), canter: false, onTap: tap,
    onLayout: () => farm.then((f) => {
      labels.hidden = false; // shown once placed, not stacked in a corner while the farm loads
      places.forEach(([id, x, y]) => {
        const el = labels.querySelector<HTMLElement>(`[data-place="${id}"]`)!, p = f.toScreen(x, y);
        // centred on the place (set here, not with a CSS transform: WebKit then misses taps on it)
        el.style.left = `${p.left - el.offsetWidth / 2}px`; el.style.top = `${p.top - el.offsetHeight / 2}px`;
      });
    }),
  });
  leave = () => { bar.unsubscribe(); farm.then((f) => f.stop()); };
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
        ? `<div class="box" data-box="${i}"><button class="nameplate" type="button" data-horse="${h.id}">${esc(h.name)}</button>
            <button class="horse-hit" type="button" data-horse="${h.id}" aria-label="${esc(h.name)}"></button>
            <div class="needs">${NEEDS.map((n) => needBar(h, n)).join('')}</div></div>`
        : `<div class="box" data-box="${i}"><span class="nameplate empty">${t.freeStall}</span></div>`;
    }).join('');
    boxes.querySelectorAll<HTMLButtonElement>('[data-horse]').forEach((b) => b.addEventListener('click', () => showCard(b.dataset.horse!)));
    place();
  };
  const bar = wireTopBar($, render);
  $('to-farm').addEventListener('click', showFarm);
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
      <p class="status ${isSick(h) ? 'sick' : ''}">${isSick(h) ? t.sick(esc(h.name)) : t.healthy(esc(h.name))}</p>
      <button id="close-card" type="button">${t.close}</button></div>`;
    card.hidden = false;
    horseSheet(h.look, 'idle').then((sheet) => $<HTMLCanvasElement>('portrait').getContext('2d')!.drawImage(sheet, 128 + 16, 30, 96, 72, 0, 0, 96, 72));
    $('close-card').addEventListener('click', () => { card.hidden = true; });
  }
  render();
  leave = () => { bar.unsubscribe(); scene.then((sc) => sc.stop()); };
}
