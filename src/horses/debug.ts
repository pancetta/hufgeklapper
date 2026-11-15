/** Hidden page (?debug=pferde) that shows the horse looks side by side, for checking the art. */
import { horseSheet } from './compose';
import { BREEDS, breedLook, COATS, type Coat, FACE_LABELS, type Face, LEG_LABELS, type Legs, type Look, MANE_LABELS, type Mane } from './look';

const BLANKETS = ['#d94f3d', '#3d6fd9', '#43a047', '#f2c14e', '#b05ec9'];

function cell(look: Look, label: string) {
  const fig = document.createElement('figure');
  const c = document.createElement('canvas');
  c.width = 96; c.height = 72;
  c.style.cssText = 'width:192px;height:144px;image-rendering:pixelated';
  // the side view (west) of the idle sheet, cropped to the horse
  horseSheet(look, 'idle').then((s) => c.getContext('2d')!.drawImage(s, 128 + 16, 30, 96, 72, 0, 0, 96, 72));
  fig.append(c, Object.assign(document.createElement('figcaption'), { textContent: label }));
  return fig;
}

function row(title: string, cells: HTMLElement[]) {
  const s = document.createElement('section');
  s.append(Object.assign(document.createElement('h2'), { textContent: title }), ...cells);
  return s;
}

export function showHorseDebug(root: HTMLElement) {
  document.body.style.cssText = 'overflow:auto;background:#7aa65a;user-select:text';
  root.innerHTML = '<style>section{display:flex;flex-wrap:wrap;gap:8px;padding:8px 16px}h2{width:100%;margin:8px 0 0;font:600 18px system-ui}figure{margin:0;background:#8fbf6a;border-radius:4px;text-align:center;font:13px system-ui}</style>';
  const coats = Object.keys(COATS) as Coat[];
  for (const build of ['pony', 'horse'] as const)
    root.append(row(build === 'pony' ? 'Ponys' : 'Pferde', coats.map((coat) => cell({ build, coat }, COATS[coat].label))));
  root.append(
    row('Abzeichen', (Object.keys(FACE_LABELS) as Face[]).map((face) => cell({ build: 'pony', coat: 'fuchs', face }, FACE_LABELS[face]))),
    row('Beine', (Object.keys(LEG_LABELS) as Legs[]).map((legs) => cell({ build: 'horse', coat: 'rappe', legs }, LEG_LABELS[legs]))),
    row('Mähne', (Object.keys(MANE_LABELS) as Mane[]).map((mane) => cell({ build: 'pony', coat: 'brauner', mane }, MANE_LABELS[mane]))),
    row('Zubehör', [cell({ build: 'pony', coat: 'schimmel', saddle: true, blanket: BLANKETS[0] }, 'Sattel'),
      ...BLANKETS.map((b) => cell({ build: 'horse', coat: 'falbe', blanket: b }, `Decke ${b}`))]),
    row('Rassen', (Object.keys(BREEDS) as (keyof typeof BREEDS)[]).map((b) => cell(breedLook(b), BREEDS[b].label))),
  );
}
