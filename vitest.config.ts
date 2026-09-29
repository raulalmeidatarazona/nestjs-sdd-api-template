import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts', 'src/application/**/*.ts', 'src/adapters/http/**/*.ts'],
      exclude: ['src/adapters/http/http.module.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80 },
      reporter: ['text', 'json-summary'],
    },
  },
});
