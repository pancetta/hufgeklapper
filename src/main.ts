import './style.css';
import { fitPixels } from './pixel';
import { t } from './strings';

const app = document.querySelector<HTMLElement>('#app')!;
app.innerHTML = `
  <main class="start">
    <h1>${t.title}</h1>
    <button id="start" type="button">${t.start}</button>
    <p id="soon" hidden>${t.comingSoon}</p>
  </main>
  <p class="rotate">${t.rotate}</p>`;

const start = app.querySelector<HTMLButtonElement>('#start')!;
start.addEventListener('click', () => {
  start.hidden = true;
  app.querySelector<HTMLElement>('#soon')!.hidden = false;
});

function fit() {
  document.documentElement.style.setProperty('--px', `${fitPixels(innerWidth, innerHeight).scale}px`);
}
addEventListener('resize', fit);
fit();
