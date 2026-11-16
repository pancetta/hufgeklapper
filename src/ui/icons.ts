/** Tiny pixel icons (our own drawing), turned into image URLs once. */
import type { Care, Need } from '../sim/state';

// small bitmaps (most 7×7); each letter is a colour from PALETTE, '.' is transparent
const ICONS: Record<Need | Care | 'coin' | 'moon' | 'helmet' | 'rosette', string[]> = {
  fed: ['...g...', '..gg...', '.rrrrr.', 'rrrrrwr', 'rrrrrrr', 'rrrrrrr', '.rrrrr.'], // an apple
  clean: ['...y...', '...y...', '..yyy..', 'yyywyyy', '..yyy..', '...y...', '...y...'], // a sparkle
  happy: ['.pp.pp.', 'ppwpppp', 'ppppppp', 'ppppppp', '.ppppp.', '..ppp..', '...p...'], // a heart
  energy: ['....yy.', '...yy..', '..yy...', '.yyyyy.', '...yy..', '..yy...', '.yy....'], // a lightning bolt
  health: ['..rrr..', '..rwr..', 'rrrwrrr', 'rwwwwwr', 'rrrwrrr', '..rwr..', '..rrr..'], // a cross
  coin: ['.yyyyy.', 'yyoooyy', 'yoyyyoy', 'yoyyyoy', 'yoyyyoy', 'yyoooyy', '.yyyyy.'],
  moon: ['..yyy..', '.yyy...', 'yyy....', 'yyy....', 'yyy....', '.yyy...', '..yyy..'],
  groom: ['.......', 'bbbbbbb', 'bbbbbbb', 'wwwwwww', 'w.w.w.w', 'w.w.w.w', '.......'], // a brush
  hooves: ['....nn.', '.....n.', '....n..', '...n...', '..n....', '.n.....', 'n......'], // a hoof pick
  feed: ['.......', 'yoyyoy.', 'yyoyyoy', 'oyyoyyo', 'yyoyyoy', 'yoyyoy.', '.......'], // a hay bale
  helmet: ['.......', '..kkk..', '.kwkkk.', 'kwkkkkk', 'kkkkkkk', 'kkkkkkk', '....kkk'], // a riding helmet
  // the riding badge: a blue rosette with a golden middle and two red ribbons
  rosette: ['...uuuuu...', '.uuUUUUUuu.', '.uUUyyyUUu.', 'uuUyyyyyUuu', 'uUUyyoyyUUu', 'uUUyyoyyUUu', 'uuUyyyyyUuu', '.uUUyyyUUu.',
    '.uuUUUUUuu.', '...uuuuu...', '...rr.rr...', '..rr...rr..', '..rr...rr..', '.rr.....rr.'],
  muck: ['n.n.n..', 'n.n.n..', 'nnnnn..', '..n....', '..n....', '..n....', '..n....'], // a pitchfork
};
const PALETTE: Record<string, string> = { r: '#e0483e', g: '#4c9a2a', w: '#fff6e0', y: '#f5c542', o: '#c98a1e', p: '#f06292', b: '#8a5530', n: '#9aa3ad', k: '#2b2b3a', u: '#3d6fd9', U: '#7ec8ff' };

const urls = new Map<string, string>();
export function icon(name: keyof typeof ICONS) {
  let url = urls.get(name);
  if (!url) {
    const c = document.createElement('canvas');
    c.width = ICONS[name][0].length; c.height = ICONS[name].length;
    const g = c.getContext('2d')!;
    ICONS[name].forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = PALETTE[ch]; g.fillRect(x, y, 1, 1); } }));
    url = c.toDataURL();
    urls.set(name, url);
  }
  return url;
}
