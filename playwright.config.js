// e2e lane: real Chromium at phone size against the static site.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${PORT}/`,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    // The app follows the browser language; pin it so the English specs are stable.
    locale: 'en-US',
    // Start! pulses forever; reduced motion (supported by the CSS) keeps
    // elements stable for clicks and screenshots deterministic.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: `node scripts/serve.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env['CI'],
  },
});
