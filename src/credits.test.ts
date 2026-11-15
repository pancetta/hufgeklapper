import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import credits from './credits.json';

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));

describe('credits', () => {
  const listed = new Set(credits.flatMap((c) => c.files));

  it('lists every file under public/assets', () => {
    const unlisted = files('public/assets').map((f) => f.replace(/^public\//, '')).filter((f) => !listed.has(f));
    expect(unlisted).toEqual([]);
  });

  it('only lists files that exist', () => {
    expect([...listed].filter((f) => !existsSync(join('public', f)))).toEqual([]);
  });

  it('names authors, licence and source for every pack', () => {
    for (const c of credits) expect([c.title, c.authors, c.license, c.licenseUrl, c.page].every(Boolean)).toBe(true);
  });
});
