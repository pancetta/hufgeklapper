import { describe, expect, it } from 'vitest';
import { findEyes } from './eyes';
import { FRAME, type Image } from './pony';

/** A brown side-view "horse" facing west: dark outline around the body, a dark eye pixel in the head. */
function horse(): Image {
  const img: Image = { width: FRAME, height: FRAME, data: new Uint8Array(FRAME * FRAME * 4) };
  const fill = (x0: number, y0: number, w: number, h: number, rgb: number[]) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) img.data.set([...rgb, 255], (y * FRAME + x) * 4);
  };
  fill(30, 40, 70, 50, [30, 20, 10]); // outline colour
  fill(31, 41, 68, 48, [150, 80, 40]); // coat
  fill(36, 52, 1, 1, [20, 15, 10]); // the eye, near the front of the head, below the ears
  return img;
}

describe('findEyes', () => {
  it('finds the eye inside the head but not the outline', () => {
    expect(findEyes(horse(), 0, 0, 'W')).toEqual([[36, 52]]);
  });

  it('finds nothing in a frame seen from behind', () => {
    expect(findEyes(horse(), 0, 0, 'N')).toEqual([]);
  });

  it('finds nothing at the back of a horse facing west when looking east', () => {
    expect(findEyes(horse(), 0, 0, 'E')).toEqual([]);
  });
});
