// Real screen reader tests: VoiceOver on macOS and NVDA on Windows, driven by
// Guidepup. They need a machine prepared by `npx @guidepup/setup` (CI uses
// the guidepup/setup-action), take over the screen reader, and run one at a
// time, so they live apart from the main suite. See
// .github/workflows/screen-readers.yml.
import { defineConfig, devices } from '@playwright/test';
import { screenReaderConfig } from '@guidepup/playwright';

const PORT = Number(process.env.PORT) || 4173;

export default defineConfig({
  ...screenReaderConfig,
  testDir: 'tests/screenreader',
  timeout: 5 * 60 * 1000,
  retries: process.env.CI ? 2 : 0,
  reportSlowTests: null,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...screenReaderConfig.use,
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'voiceover',
      testMatch: /voiceover\.spec\.mjs$/,
      use: { ...devices['Desktop Safari'], headless: false },
    },
    {
      name: 'nvda',
      testMatch: /nvda\.spec\.mjs$/,
      use: { ...devices['Desktop Chrome'], headless: false },
    },
  ],
  webServer: {
    command: 'node scripts/serve.mjs',
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
