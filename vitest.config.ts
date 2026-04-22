import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['src/__tests__/renderer/setup.ts'],
    testTimeout: 30000,
    environmentMatchGlobs: [
      // Renderer tests run under jsdom so React components can be mounted
      ['src/__tests__/renderer/**/*.{test,spec}.{ts,tsx}', 'jsdom']
    ]
  }
})
