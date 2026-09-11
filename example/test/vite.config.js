import { defineConfig } from 'vitest/config';
import aeui from '../../packages/core/src/vite-plugin.js';

export default defineConfig({
  plugins: [aeui({ compiler: process.env.AEUI_TEST_COMPILER || 'swc' })],
  test: {
    environment: 'jsdom',
    include: ['src/conformance/**/*.test.{js,jsx}'],
    restoreMocks: true,
    testTimeout: 3000,
  },
});
