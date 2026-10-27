import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT) || 4173;
const CROSS_BROWSER = /(nav-a11y|search)\.spec\.mjs$/;
const PHONE_LAYOUT = /(mobile|touch)\.spec\.mjs$/;
const TOUCH = /touch\.spec\.mjs$/;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /(mobile|touch)\.spec\.mjs$/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Touch devices. Phone-layout devices run the phone suites plus the touch
    // suite; tablets with the desktop menu run the touch suite only, which
    // adapts to whichever layout it finds.
    { name: 'mobile', testMatch: PHONE_LAYOUT, use: { ...devices['Pixel 7'] } },
    { name: 'android-tablet', testMatch: PHONE_LAYOUT, use: { ...devices['Galaxy Tab S4'] } },
    // Cross-browser: Firefox and WebKit (Safari's engine). These need
    // `npx playwright install firefox webkit` and run in their own CI job.
    { name: 'firefox', testMatch: CROSS_BROWSER, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testMatch: CROSS_BROWSER, use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-safari', testMatch: PHONE_LAYOUT, use: { ...devices['iPhone 14'] } },
    { name: 'iphone-se', testMatch: PHONE_LAYOUT, use: { ...devices['iPhone SE'] } },
    // iPads get the desktop menu in both orientations (the phone menu starts
    // below 737px), with touch instead of hover.
    { name: 'ipad', testMatch: TOUCH, use: { ...devices['iPad Pro 11'] } },
    { name: 'ipad-mini', testMatch: TOUCH, use: { ...devices['iPad Mini'] } },
    {
      name: 'ipad-landscape',
      testMatch: TOUCH,
      use: { ...devices['iPad Pro 11 landscape'] },
    },
  ],
  webServer: {
    command: 'node scripts/serve.mjs',
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
