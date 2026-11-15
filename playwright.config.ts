import { defineConfig, devices } from '@playwright/test';

const url = 'http://localhost:4173/hufgeklapper/';

// Touch flows run in WebKit (Safari's engine) on an iPad in landscape, against the production build.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: url },
  webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', url, reuseExistingServer: !process.env.CI },
  projects: [{ name: 'ipad', use: { ...devices['iPad (gen 11) landscape'] } }],
});
