import './style.css';
import { showHorseDebug } from './horses/debug';
import { fitPixels } from './pixel';
import { t } from './strings';
import { showStart } from './ui/screens';

function fit() {
  document.documentElement.style.setProperty('--px', `${fitPixels(innerWidth, innerHeight).scale}px`);
}
addEventListener('resize', fit);
fit();

if (new URLSearchParams(location.search).get('debug') === 'pferde') showHorseDebug(document.querySelector('#app')!);
else showStart();

// offline and from the home screen: the service worker keeps the game (only in the build, not while developing)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const updating = !!navigator.serviceWorker.controller; // a worker already ran this page: a new one is an update
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updating) return;
    const note = Object.assign(document.createElement('p'), { className: 'toast', textContent: t.newVersion });
    note.setAttribute('role', 'status');
    document.body.append(note);
    setTimeout(() => note.remove(), 6000);
  });
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => { /* no offline play, the game still runs */ });
}
