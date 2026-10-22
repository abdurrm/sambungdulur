import { defineConfig, devices } from '@playwright/test';

// Runs against the production build (vite preview) with the locally installed Microsoft Edge,
// so no browser download is needed and the service worker is exercised as well.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    channel: 'msedge',
    acceptDownloads: true,
    viewport: { width: 1400, height: 900 },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1400, height: 900 } }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { channel: 'msedge', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, grep: /@mobile/ },
  ],
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
