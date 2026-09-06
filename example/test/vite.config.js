import { defineConfig } from 'vitest/config';
import aeui from '../../packages/core/src/vite-plugin.js';

export default defineConfig({
  plugins: [aeui()],
  test: { environment: 'jsdom', globals: true },
});
