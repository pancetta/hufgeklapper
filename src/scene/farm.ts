/**
 * The farm seen from above (16-bit RPG view): terrain, buildings, fences and props as data.
 * Coordinates are world pixels; every drawable has a foot point (x, y) on the ground, and drawables are
 * painted in order of that foot y, so what stands lower on the screen is in front.
 * Every plot fits the 590×410 view around FOCUS, the smallest an iPad in landscape shows (tested).
 */
import type { Plot } from './buildings';
import type { Rect } from './draw';

export const WORLD = { width: 896, height: 576 };

// 28 × 18 cells of 32px of landscape: '.' grass, m meadow with flowers, p dirt path, w water.
// Buildings bring their own ground (an arena its sand), see buildings.ts.
export const MAP = [
  '............................',
  '............................',
  '.......mmm..................',
  '......mmmm.wwww.............',
  '.......mmm.wwww..........mm.',
  '...........wwww.........mmm.',
  '.........................m..',
  '..mm........................',
  '..mm........................',
  '............pp..............',
  '............pp..............',
  '...m........pp..............',
  '..mmm.......pp..............',
  '.....ppppppppp..............',
  '....pppppppppppppppppppppppp',
  '...ppppppppppppppppppppppppp',
  '.....mm.........mmm....mmm..',
  '.....m......................',
];

/** A sprite in a sheet, with its foot point (ax, ay) inside the rectangle. */
type Sprite = { sheet: string; rect: Rect; ax: number; ay: number };
const spr = (sheet: string, rect: Rect, ax = rect[2] >> 1, ay = rect[3] - 1): Sprite => ({ sheet, rect, ax, ay });
const tree = (rect: Rect, shadowDepth = 12) => spr('nature/trees.png', rect, rect[2] >> 1, rect[3] - shadowDepth);
const plant = (c: number, r: number, h = 1) => spr('nature/plants.png', [c * 32, r * 32, 32, 32 * h], 16, 32 * h - 3);
const deco = (rect: Rect, ay?: number) => spr('farm/decorations.png', rect, rect[2] >> 1, ay ?? rect[3] - 2);

export const SPRITES = {
  oak: tree([0, 535, 150, 169], 18),
  oak2: tree([161, 530, 127, 165], 16),
  round: tree([129, 352, 94, 137], 10),
  round2: tree([128, 104, 95, 118], 12),
  bushy: tree([709, 224, 120, 128], 10),
  fluffy: tree([0, 102, 63, 117], 8),
  pine: tree([64, 356, 63, 149], 8),
  bushSmall: tree([200, 7, 48, 54], 4),
  bushSmall2: tree([131, 2, 55, 58], 4),
  blossom: spr('nature/fruit-trees.png', [302, 36, 59, 92], 30, 80),
  lavender: plant(0, 5), cream: plant(1, 5), blue: plant(2, 5), red: plant(3, 5),
  sunflowers: spr('nature/plants.png', [128, 160, 64, 64], 32, 60),
  roses: plant(5, 6),
  spikePurple: plant(6, 4), spikeBlue: plant(7, 4), spikeYellow: plant(9, 4),
  clusterPurple: plant(6, 5), clusterBlue: plant(7, 5), clusterRed: plant(8, 5), clusterYellow: plant(9, 5),
  meadow1: plant(10, 0), meadow2: plant(12, 1), meadow3: plant(14, 2), meadow4: plant(11, 1), tulips: plant(10, 2),
  grass1: plant(0, 10), grass2: plant(1, 10), grass3: plant(5, 10),
  cattail: plant(1, 13, 2), cattail2: plant(2, 13, 2), reeds: plant(3, 13, 2),
  haystack: deco([64, 640, 64, 56]),
  hayRoll: deco([0, 640, 64, 96]),
  hayBales: deco([128, 682, 97, 54]),
  wheelbarrow: deco([195, 512, 85, 64], 60),
  troughWater: deco([424, 576, 78, 32]),
  bucket: deco([64, 448, 32, 32]),
  pitchfork: deco([288, 576, 32, 64]),
  hayShed: deco([352, 700, 64, 62]),
  well: deco([448, 416, 64, 96], 92),
};
export type SpriteName = keyof typeof SPRITES;

/** Props: [sprite, foot x, foot y]. Flowers and grass sway a little (see index.ts). */
export const PROPS: [SpriteName, number, number][] = [
  // tree line along the top and the sides
  ['oak', 90, 150], ['round', 30, 260], ['pine', 120, 340], ['bushy', 470, 70], ['oak2', 640, 60], ['round2', 800, 90],
  ['fluffy', 860, 220], ['oak', 850, 470], ['pine', 40, 470], ['round', 130, 560], ['round2', 300, 575],
  ['bushSmall', 490, 82], ['bushSmall2', 760, 120], ['bushy', 830, 350], ['round2', 790, 250],
  // around the barn
  ['haystack', 120, 418], ['hayBales', 360, 440], ['wheelbarrow', 125, 470], ['pitchfork', 398, 412],
  ['bucket', 300, 432], ['lavender', 160, 420],
  // the middle: well, blossoming trees, flowers
  ['well', 384, 268], ['blossom', 600, 312], ['bushSmall2', 452, 330], ['clusterYellow', 470, 346], ['roses', 365, 300],
  // along the bottom edge, so the scene feels framed
  ['bushy', 560, 640], ['round', 380, 640], ['blossom', 470, 600],
  // flower beds by the path and the meadow patches
  ['sunflowers', 235, 548], ['roses', 276, 530], ['clusterRed', 300, 540], ['clusterYellow', 205, 532],
  ['spikePurple', 418, 528], ['spikeBlue', 436, 534], ['clusterBlue', 455, 526], ['tulips', 560, 520], ['meadow2', 590, 535],
  ['cream', 120, 230], ['blue', 98, 360], ['clusterPurple', 815, 160], ['meadow2', 830, 130], ['spikeYellow', 400, 280],
  ['grass1', 420, 300], ['grass2', 840, 300], ['grass3', 200, 560], ['red', 690, 540], ['meadow3', 620, 528], ['grass1', 512, 536],
  // pond in the middle, reeds on its banks
  ['cattail', 366, 100], ['cattail2', 382, 94], ['reeds', 484, 120], ['cattail', 486, 186], ['cattail2', 360, 196],
  ['grass2', 430, 214], ['clusterBlue', 470, 212],
  ['clusterPurple', 712, 530], ['bushSmall', 880, 450],
];

/** The plots of the farm on the start screen; a free plot shows stakes and a sign. */
export const PLOTS: Plot[] = [
  { id: 'stall', c0: 5, r0: 3, c1: 10, r1: 12, building: 'stall' },
  { id: 'feed', c0: 11, r0: 11, c1: 11, r1: 12, building: 'feedStore' },
  { id: 'pasture', c0: 16, r0: 3, c1: 22, r1: 8, building: 'pasture' },
  { id: 'arena', c0: 15, r0: 10, c1: 22, r1: 13, building: 'arena' },
  { id: 'free', c0: 13, r0: 7, c1: 15, r1: 8, building: null },
];

/** Where the scene's camera looks; each device shows as much around it as fits. */
export const FOCUS = { x: 448, y: 275 };
