/** Tiny pixel icons (our own drawing), turned into image URLs once. */
import type { Need } from '../sim/state';

// 7×7 bitmaps; each letter is a colour from PALETTE, '.' is transparent
const ICONS: Record<Need | 'coin' | 'moon', string[]> = {
  fed: ['...g...', '..gg...', '.rrrrr.', 'rrrrrwr', 'rrrrrrr', 'rrrrrrr', '.rrrrr.'], // an apple
  clean: ['...y...', '...y...', '..yyy..', 'yyywyyy', '..yyy..', '...y...', '...y...'], // a sparkle
  happy: ['.pp.pp.', 'ppwpppp', 'ppppppp', 'ppppppp', '.ppppp.', '..ppp..', '...p...'], // a heart
  energy: ['....yy.', '...yy..', '..yy...', '.yyyyy.', '...yy..', '..yy...', '.yy....'], // a lightning bolt
  health: ['..rrr..', '..rwr..', 'rrrwrrr', 'rwwwwwr', 'rrrwrrr', '..rwr..', '..rrr..'], // a cross
  coin: ['.yyyyy.', 'yyoooyy', 'yoyyyoy', 'yoyyyoy', 'yoyyyoy', 'yyoooyy', '.yyyyy.'],
  moon: ['..yyy..', '.yyy...', 'yyy....', 'yyy....', 'yyy....', '.yyy...', '..yyy..'],
};
const PALETTE: Record<string, string> = { r: '#e0483e', g: '#4c9a2a', w: '#fff6e0', y: '#f5c542', o: '#c98a1e', p: '#f06292' };

const urls = new Map<string, string>();
export function icon(name: keyof typeof ICONS) {
  let url = urls.get(name);
  if (!url) {
    const c = document.createElement('canvas');
    c.width = c.height = 7;
    const g = c.getContext('2d')!;
    ICONS[name].forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = PALETTE[ch]; g.fillRect(x, y, 1, 1); } }));
    url = c.toDataURL();
    urls.set(name, url);
  }
  return url;
}
