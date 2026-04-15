// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/14-mobile.spec.js'],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-slow',
      use: {
        ...devices['Pixel 7'],
        // Simulate slow 3G for loading delay tests
        launchOptions: {
          args: ['--disable-dev-shm-usage'],
        },
      },
    },
  ],
  webServer: {
    command: 'npx serve public -l 3000 --no-clipboard',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
