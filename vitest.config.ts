import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    alias: { '@/': new URL('./', import.meta.url).pathname },
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
  },
})
