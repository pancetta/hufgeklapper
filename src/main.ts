import './style.css';
import credits from './credits.json';
import { fitPixels } from './pixel';
import { startFarm } from './scene';
import { t } from './strings';

const base = import.meta.env.BASE_URL;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${({ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' })[c]};`);

const app = document.querySelector<HTMLElement>('#app')!;
app.innerHTML = `
  <canvas id="farm" aria-hidden="true"></canvas>
  <main class="start">
    <h1 class="plaque">${t.title}</h1>
    <div class="actions">
      <button id="start" type="button">${t.start}</button>
      <p id="soon" class="note" hidden>${t.comingSoon}</p>
    </div>
    <button id="show-credits" class="small" type="button">${t.credits}</button>
  </main>
  <section id="credits" class="credits" hidden aria-labelledby="credits-title">
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
  </section>
  <p class="rotate">${t.rotate}</p>`;

const $ = <T extends HTMLElement>(id: string) => app.querySelector<T>(`#${id}`)!;
$('start').addEventListener('click', () => { $('start').hidden = true; $('soon').hidden = false; });
$('show-credits').addEventListener('click', () => { $('credits').hidden = false; });
$('close-credits').addEventListener('click', () => { $('credits').hidden = true; });

function fit() {
  document.documentElement.style.setProperty('--px', `${fitPixels(innerWidth, innerHeight).scale}px`);
}
addEventListener('resize', fit);
fit();
startFarm($<HTMLCanvasElement>('farm'));
