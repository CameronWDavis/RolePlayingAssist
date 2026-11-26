/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // The SRD library chunk (spells, monsters, magic items) is ~1 MB of JSON on purpose.
    // It only loads on pages that need it, so don't warn about it.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
