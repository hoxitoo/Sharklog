import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// The sandbox ships its own headless shell; a CI runner has none at this path
// and uses the browser `playwright install` put in its cache. Hardcoding it
// made every CI run fail at browser launch, before a single test ran.
const SANDBOX_SHELL = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
  },
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(existsSync(SANDBOX_SHELL) ? { launchOptions: { executablePath: SANDBOX_SHELL } } : {}),
      },
    },
  ],
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
