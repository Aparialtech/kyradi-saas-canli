import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { UserConfig } from 'vite';
import type { UserConfig as VitestUserConfig } from 'vitest/config';

const config = {
  plugins: [react()],
  server: {
    headers: {
      'Content-Security-Policy': "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.hcaptcha.com; object-src 'none';",
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
} satisfies UserConfig & { test: VitestUserConfig["test"] };

export default defineConfig(config);
