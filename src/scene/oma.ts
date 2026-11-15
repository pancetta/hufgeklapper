/**
 * Portraits for speech bubbles (our own pixel art), drawn once and outlined like the LPC figures.
 * Oma Hanne: grey hair in a bun, round glasses, rosy cheeks, a green cardigan over a white blouse with a brooch.
 * The inspector ("Prüferin"): brown hair, a blue jacket, no glasses.
 */
const W = 30, H = 32, OUTLINE = '#2a1a10';
const SKIN = '#f0c8a8', SKIN_DARK = '#d9a886', BLOUSE = '#fbf6ea';
const LOOKS = {
  oma: { hair: ['#d6d6de', '#a6a6b6', '#f2f2f6'], top: ['#4f8a4a', '#3a6a38', '#6aa862'], bun: true, glasses: true },
  inspector: { hair: ['#6a4126', '#4a2c18', '#8a5a3a'], top: ['#2f4f9a', '#203a73', '#4a6fc0'], bun: false, glasses: false },
};
const portraits = new Map<string, string>();

function paint(who: keyof typeof LOOKS) {
  const L = LOOKS[who], [HAIR, HAIR_DARK, HAIR_LIGHT] = L.hair, [CARDIGAN, CARDIGAN_DARK, CARDIGAN_LIGHT] = L.top;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const px = (color: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
  const disc = (color: string, cx: number, cy: number, rx: number, ry: number) => {
    for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(1 - (y / (ry + 0.5)) ** 2)); px(color, cx - w, cy + y, w * 2 + 1, 1); }
  };
  // shoulders in the cardigan, the blouse's collar and a brooch
  disc(CARDIGAN, 15, 31, 13, 6);
  px(CARDIGAN_LIGHT, 4, 28, 3, 1); px(CARDIGAN_LIGHT, 3, 29, 3, 2);
  px(CARDIGAN_DARK, 22, 29, 5, 3);
  px(BLOUSE, 12, 24, 7, 3); px(BLOUSE, 13, 27, 5, 1);
  px(CARDIGAN_DARK, 15, 27, 1, 5); // the cardigan's opening
  px('#f2c14e', 18, 28, 2, 2); px('#fff3b0', 18, 28); // brooch
  // neck and face
  px(SKIN_DARK, 13, 21, 5, 3);
  disc(SKIN, 15, 15, 7, 7);
  // hair: a soft wave around the face and the bun on top
  disc(HAIR, 15, 9, 8, 4);
  px(HAIR, 7, 9, 2, 7); px(HAIR, 22, 9, 2, 7);
  if (L.bun) { disc(HAIR, 15, 3, 4, 3); px(HAIR_LIGHT, 13, 1, 3, 1); px(HAIR_DARK, 12, 5, 7, 1); }
  px(HAIR_LIGHT, 10, 7, 4, 1); px(HAIR_LIGHT, 17, 8, 3, 1); px(HAIR_DARK, 8, 12, 1, 3); px(HAIR_DARK, 22, 12, 1, 3);
  // ears with pearl earrings
  px(SKIN_DARK, 7, 15, 1, 2); px(SKIN_DARK, 23, 15, 1, 2); px('#ffffff', 7, 17); px('#ffffff', 23, 17);
  // round glasses with a shine, kind eyes behind them
  const FRAME = '#8a5230';
  for (const ex of [10, 17]) {
    if (L.glasses) { px(FRAME, ex, 13, 4, 1); px(FRAME, ex, 16, 4, 1); px(FRAME, ex - 1, 14, 1, 2); px(FRAME, ex + 4, 14, 1, 2); px('#eef6fb', ex, 14, 4, 2); }
    px(OUTLINE, ex, 15); px(OUTLINE, ex + 1, 14, 2, 1); px(OUTLINE, ex + 3, 15); // smiling eyes, curved like ^
    px('#ffffff', ex + 3, 14);
  }
  if (L.glasses) px(FRAME, 14, 14, 3, 1); // the bridge
  // rosy cheeks, a nose and a smile
  px('#f29a9a', 9, 17, 2, 1); px('#f29a9a', 20, 17, 2, 1);
  px(SKIN_DARK, 15, 17, 1, 1);
  px('#a0505a', 13, 19, 1, 1); px('#a0505a', 14, 20, 3, 1); px('#a0505a', 17, 19, 1, 1);
  // a dark outline around everything
  const d = g.getImageData(0, 0, W, H), a = (x: number, y: number) => d.data[(y * W + x) * 4 + 3];
  g.fillStyle = OUTLINE;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (!a(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H && a(x + dx, y + dy))) g.fillRect(x, y, 1, 1);
  return c.toDataURL();
}

/** A portrait as an image URL, for an <img> scaled up with pixelated rendering. */
export function portrait(who: keyof typeof LOOKS = 'oma') {
  let url = portraits.get(who);
  if (!url) portraits.set(who, (url = paint(who)));
  return url;
}
export const omaPortrait = () => portrait('oma');
