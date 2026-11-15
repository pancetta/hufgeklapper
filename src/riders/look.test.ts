import { describe, expect, it } from 'vitest';
import { HAIR, HELMET, JACKET, pupilKid, SKIN } from './look';

describe('pupil looks', () => {
  it('takes skin, helmet, jacket, hair colour and style from the look number, always a real colour', () => {
    expect(pupilKid({ size: 'small', look: 0 })).toEqual({ size: 'small', skin: 0, helmet: 0, jacket: 0, hairColor: 0, hair: 'zopf' });
    expect(pupilKid({ size: 'big', look: 1 + (2 << 2) + (3 << 4) + (1 << 6) + (2 << 8) })).toMatchObject({ skin: 1, helmet: 2, jacket: 3, hairColor: 1, hair: 'zoepfe' });
    for (let look = 0; look < 1000; look++) {
      const k = pupilKid({ size: 'big', look });
      expect([SKIN[k.skin], HELMET[k.helmet], JACKET[k.jacket], HAIR[k.hairColor]].every(Boolean)).toBe(true);
    }
  });
});
