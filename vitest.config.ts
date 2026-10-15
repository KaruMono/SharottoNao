import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'utils/**/*.test.ts',
      'server/utils/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/.claude/**',
      'dist/**',
      '.nuxt/**',
      '.output/**',
      'kun-galgame-forum-master/**',
    ],
  },
})
