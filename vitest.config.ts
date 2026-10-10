import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: { testTimeout: 20000, exclude: [...configDefaults.exclude, '.claude/**'] },
});
