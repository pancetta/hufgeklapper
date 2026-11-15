import './style.css';
import { showHorseDebug } from './horses/debug';
import { fitPixels } from './pixel';
import { showStart } from './ui/screens';

function fit() {
  document.documentElement.style.setProperty('--px', `${fitPixels(innerWidth, innerHeight).scale}px`);
}
addEventListener('resize', fit);
fit();

if (new URLSearchParams(location.search).get('debug') === 'pferde') showHorseDebug(document.querySelector('#app')!);
else showStart();
