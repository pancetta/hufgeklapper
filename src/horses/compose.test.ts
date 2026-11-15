import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { composeSheet, type Pixels } from './compose';
import { BREEDS, breedLook, COATS, layers, type Look } from './look';

const load = async (path: string): Promise<Pixels> => {
  const { data, info } = await sharp(`public/assets/${path}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
};
const hash = (p: Pixels) => createHash('sha1').update(p.data).digest('hex');
const sheet = (look: Look) => composeSheet(look, 'idle', load).then(hash);

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
    const all = (Object.keys(COATS) as Look['coat'][]).flatMap((coat) => (['horse', 'pony'] as const).flatMap((build) =>
      (['idle', 'walk', 'gallop'] as const).flatMap((anim) => layers({ build, coat, face: 'flocke', legs: 'socken', saddle: true, blanket: '#fff000' }, anim))));
    expect(all.map((l) => l.path).filter((p) => !existsSync(`public/assets/${p}`))).toEqual([]);
  });

  it('dresses a breed in its build and allowed coats', () => {
    expect(breedLook('haflinger', 'rappe')).toEqual({ build: 'pony', coat: 'fuchs', mane: 'blond' });
    expect(breedLook('warmblut', 'rappe').coat).toBe('rappe');
    for (const b of Object.values(BREEDS)) expect(b.coats.length).toBeGreaterThan(0);
  });
});
