import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'out/**',
        'test/**',
        '**/*.d.ts',
        'esbuild.js',
        'src/ui/react/**/*.test.*'
      ],
      include: [
        'src/**/*.ts',
        'src/**/*.tsx'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    include: [
      'test/unit/**/*.test.{ts,tsx}',
      'test/integration/**/*.test.{ts,tsx}'
    ],
    exclude: [
      'node_modules/**',
      'out/**',
      'test/e2e/**'
    ]
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@test': resolve(__dirname, './test')
    }
  },
  esbuild: {
    target: 'node18'
  }
});