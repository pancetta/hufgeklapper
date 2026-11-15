import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { composeSheet, paintOver, type Pixels } from './compose';
import { BREEDS, breedLook, COATS, FACES, layers, LEGS, type Look, MANES } from './look';

const load = async (path: string): Promise<Pixels> => {
  const { data, info } = await sharp(`public/assets/${path}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
};
const hash = (p: Pixels) => createHash('sha1').update(p.data).digest('hex');
const sheet = (look: Look) => composeSheet(look, 'idle', load).then(hash);

describe('paintOver', () => {
  const px = (...rgba: number[]): Pixels => ({ width: 1, height: 1, data: new Uint8ClampedArray(rgba) });

  it('blends a half-transparent layer over an opaque pixel', () => {
    const base = px(0, 0, 255, 255);
    paintOver(base, px(255, 0, 0, 128));
    expect([...base.data]).toEqual([128, 0, 127, 255]);
  });

  it('keeps a half-transparent layer half transparent over nothing', () => {
    const base = px(0, 0, 0, 0);
    paintOver(base, px(255, 0, 0, 128));
    expect([...base.data]).toEqual([255, 0, 0, 128]);
  });

  it("turns the pad's main tone into exactly the tint", () => {
    const base = px(0, 0, 0, 0);
    paintOver(base, px(128, 128, 128, 255), '#d94f3d');
    expect([...base.data]).toEqual([0xd9, 0x4f, 0x3d, 255]);
  });
});

describe('horse looks', () => {
  const pony: Look = { build: 'pony', coat: 'falbe' };

  it('gives the same pixels for the same look', async () => {
    expect(await sheet({ ...pony, face: 'stern', blanket: '#3d6fd9' })).toBe(await sheet({ ...pony, face: 'stern', blanket: '#3d6fd9' }));
  });

  it('changes the pixels with every layer', async () => {
    const variants: Look[] = [
      pony, { ...pony, build: 'horse' }, { ...pony, coat: 'rappe' }, { ...pony, mane: 'weiss' }, { ...pony, face: 'blesse' },
      { ...pony, legs: 'stiefel' }, { ...pony, saddle: true }, { ...pony, blanket: '#d94f3d' }, { ...pony, blanket: '#3d6fd9' },
    ];
    const hashes = await Promise.all(variants.map(sheet));
    expect(new Set(hashes).size).toBe(variants.length);
  });

  it('only uses sheets that exist, for every coat, build and animation', async () => {
    const { existsSync } = await import('node:fs');
    const looks: Look[] = (Object.keys(COATS) as Look['coat'][]).flatMap((coat) => (['horse', 'pony'] as const).flatMap((build) => [
      { build, coat, saddle: true, blanket: '#fff000' },
      ...(Object.keys(FACES) as Look['face'][]).map((face) => ({ build, coat, face })),
      ...(Object.keys(LEGS) as Look['legs'][]).map((legs) => ({ build, coat, legs })),
      ...(Object.keys(MANES) as Look['mane'][]).map((mane) => ({ build, coat, mane })),
    ]));
    const all = looks.flatMap((l) => (['idle', 'walk', 'gallop'] as const).flatMap((anim) => layers(l, anim)));
    expect(all.map((l) => l.path).filter((p) => !existsSync(`public/assets/${p}`))).toEqual([]);
  });

  it('dresses a breed in its build and allowed coats', () => {
    expect(breedLook('haflinger', 'rappe')).toEqual({ build: 'pony', coat: 'fuchs', mane: 'blond' });
    expect(breedLook('warmblut', 'rappe').coat).toBe('rappe');
    for (const b of Object.values(BREEDS)) expect(b.coats.length).toBeGreaterThan(0);
  });
});
