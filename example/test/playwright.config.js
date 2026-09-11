import { defineConfig } from '@playwright/test';
import { root } from './conformance/check.mjs';
import path from 'node:path';

const port = Number(process.env.AEUI_TEST_PORT || 43820);
export default defineConfig({
  testDir: './extra',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  expect: { timeout: 5000 },
  retries: 0,
  workers: 1,
  forbidOnly: true,
  reporter: [['json', { outputFile: path.join(root, '.conformance/extra-browser.json') }]],
  outputDir: path.join(root, '.conformance/browser-artifacts'),
  use: { headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: ['cli', 'commerce-admin', 'vite-demo', 'deep-compare-test', 'letProps', 'cli-dev', 'shoppingCart'].map((name, offset) => ({
    command: `node example/test/extra/serve.mjs ${name} ${port + offset}`,
    cwd: root,
    url: `http://127.0.0.1:${port + offset}/`,
    reuseExistingServer: false,
    timeout: 60000,
  })),
});
