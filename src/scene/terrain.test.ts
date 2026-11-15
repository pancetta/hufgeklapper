import { describe, expect, it } from 'vitest';
import { quarterTile } from './terrain';

const grid = (rows: string[]) => (c: number, r: number) => rows[r]?.[c] === '#';
const FILL: [number, number] = [1, 3];
const quarters = (rows: string[], c: number, r: number) => [0, 1, 2, 3].map((q) => quarterTile(grid(rows), c, r, q, FILL));

describe('quarterTile', () => {
  it('gives a lone cell four outer corners', () => {
    expect(quarters(['...', '.#.', '...'], 1, 1)).toEqual([[0, 2], [2, 2], [0, 4], [2, 4]]);
  });

  it('fills a cell surrounded by its own terrain', () => {
    expect(quarters(['###', '###', '###'], 1, 1)).toEqual([FILL, FILL, FILL, FILL]);
  });

  it('uses an inner corner where only the diagonal neighbour is missing', () => {
    // the north-east diagonal is missing, so the NE quarter gets the ring piece with its hole there
    expect(quarters(['##.', '###', '###'], 1, 1)[1]).toEqual([1, 1]);
  });

  it('uses the top edge along the upper border of a strip', () => {
    expect(quarters(['...', '###', '###'], 1, 1).slice(0, 2)).toEqual([[1, 2], [1, 2]]);
  });

  it('uses the side edge along the left border of a column', () => {
    expect(quarters(['.#', '.#', '.#'], 1, 1)[0]).toEqual([0, 3]);
  });
});
