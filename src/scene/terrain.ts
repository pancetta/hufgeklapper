/**
 * LPC terrain blocks and their edges. A block is 3×7 tiles of 32px: row 0–1 hold the inner corners (a 2×2 ring
 * in columns 1–2), rows 2–4 the 3×3 outer blob (corners, edges, centre). Where the fill variants sit differs:
 * plain blocks have three in row 5; the "with a grass fringe" blocks have the plain tile at (0, 0) and the centre.
 * Each map cell is drawn as four 16px quarters; a quarter's piece depends on its two edge neighbours and the
 * corner neighbour (the usual "blob" autotiling), so terrains get soft, irregular borders with no extra art.
 */
export const TILE = 32;
const Q = TILE / 2;

type Tile = [col: number, row: number];
const PLAIN: Tile[] = [[0, 5], [1, 5], [2, 5], [1, 3]];
const FRINGED: Tile[] = [[1, 3], [0, 0], [1, 3], [1, 3]];
/** Each terrain's block in nature/terrain.png: pixel origin and the tiles used to fill its inside. */
const BLOCKS: Record<string, { at: [number, number]; fills: Tile[] }> = {
  grass: { at: [0, 224], fills: PLAIN }, // base: bright grass
  meadow: { at: [96, 1024], fills: PLAIN }, // light grass with flowers
  path: { at: [480, 1248], fills: FRINGED }, // brown dirt with a grass fringe
  sand: { at: [192, 1248], fills: FRINGED }, // sand with a grass fringe
  water: { at: [96, 448], fills: PLAIN }, // pond with a sandy bank and little waves
};
type Terrain = 'grass' | 'meadow' | 'path' | 'sand' | 'water';

/** Map characters → terrain; the base grass is '.'. Overlays are painted in this order. */
const LEGEND: Record<string, Terrain> = { m: 'meadow', p: 'path', s: 'sand', w: 'water' };

// quarter index: 0 NW, 1 NE, 2 SW, 3 SE; dx/dy point at the neighbours of that quarter
const DIRS = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const;
const OUTER: Tile[] = [[0, 2], [2, 2], [0, 4], [2, 4]];
const INNER: Tile[] = [[2, 1], [1, 1], [2, 0], [1, 0]]; // the ring tile whose missing corner is that quarter
const VERT_EDGE: Tile[] = [[0, 3], [2, 3], [0, 3], [2, 3]]; // neighbour above/below present, side missing
const HORZ_EDGE: Tile[] = [[1, 2], [1, 2], [1, 4], [1, 4]]; // side present, above/below missing

/** Which tile of the block supplies quarter q of the cell at (c, r); `fill` picks the centre variant. */
export function quarterTile(has: (c: number, r: number) => boolean, c: number, r: number, q: number, fill: Tile): Tile {
  const [dx, dy] = DIRS[q];
  const v = has(c, r + dy), h = has(c + dx, r), d = has(c + dx, r + dy);
  if (v && h) return d ? fill : INNER[q];
  if (v) return VERT_EDGE[q];
  if (h) return HORZ_EDGE[q];
  return OUTER[q];
}

/** Stable per-cell variety without a random generator. */
const pick = (c: number, r: number, n: number) => (((c * 73856093) ^ (r * 19349663)) >>> 0) % n;

/** Paints the whole map: base grass everywhere, then each overlay terrain on its cells. */
export function paintTerrain(ctx: CanvasRenderingContext2D, sheet: CanvasImageSource, map: string[]) {
  const rows = map.length, cols = map[0].length;
  const draw = (t: Terrain, tile: Tile, q: number, c: number, r: number) => {
    const [bx, by] = BLOCKS[t].at, qx = (q & 1) * Q, qy = (q >> 1) * Q;
    ctx.drawImage(sheet, bx + tile[0] * TILE + qx, by + tile[1] * TILE + qy, Q, Q, c * TILE + qx, r * TILE + qy, Q, Q);
  };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const [fc, fr] = PLAIN[pick(c, r, 3)], [bx, by] = BLOCKS.grass.at;
      ctx.drawImage(sheet, bx + fc * TILE, by + fr * TILE, TILE, TILE, c * TILE, r * TILE, TILE, TILE);
    }
  for (const [ch, t] of Object.entries(LEGEND)) {
    // outside the map counts as "same terrain", so overlays run cleanly off the edge
    const has = (c: number, r: number) => c < 0 || r < 0 || c >= cols || r >= rows || map[r][c] === ch;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (map[r][c] !== ch) continue;
        const { fills } = BLOCKS[t], fill = fills[pick(c, r, fills.length)];
        for (let q = 0; q < 4; q++) draw(t, quarterTile(has, c, r, q, fill), q, c, r);
      }
  }
}
