import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/hufgeklapper/', // GitHub Pages serves the repo under this path
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
