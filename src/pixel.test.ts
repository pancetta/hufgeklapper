import { describe, expect, it } from 'vitest';
import { fitPixels } from './pixel';

describe('fitPixels', () => {
  it('scales an iPad in landscape by 2 and fills it', () => {
    expect(fitPixels(1180, 820)).toEqual({ scale: 2, width: 590, height: 410 });
  });

  it('scales a large desktop window by 6', () => {
    expect(fitPixels(2732, 2048)).toEqual({ scale: 6, width: 455, height: 341 });
  });

  it('never goes below scale 1 on small screens', () => {
    expect(fitPixels(390, 844)).toEqual({ scale: 1, width: 390, height: 844 });
  });
});
