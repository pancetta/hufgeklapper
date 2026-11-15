import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

/** Writes the service worker into the build, with the list of every built file and a version from their contents. */
function serviceWorker(): Plugin {
  let outDir = '', root = '';
  return {
    name: 'service-worker',
    apply: 'build',
    configResolved(c) { root = c.root; outDir = resolve(c.root, c.build.outDir); },
    closeBundle() {
      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
      const files = walk(outDir).filter((f) => !f.endsWith('sw.js')).sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(relative(outDir, f)).update(readFileSync(f));
      const list = ['./', ...files.map((f) => relative(outDir, f).split('\\').join('/'))];
      writeFileSync(join(outDir, 'sw.js'), `const VERSION = '${hash.digest('hex').slice(0, 12)}';\nconst FILES = ${JSON.stringify(list)};\n${readFileSync(resolve(root, 'src/sw.js'), 'utf8')}`);
    },
  };
}

export default defineConfig({
  base: '/hufgeklapper/', // GitHub Pages serves the repo under this path
  plugins: [serviceWorker()],
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
