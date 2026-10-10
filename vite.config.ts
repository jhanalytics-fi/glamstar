import { defineConfig } from 'vite';
import pkg from './package.json';

// Relative asset paths so the build works under /glamstar/ on GitHub Pages.
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
