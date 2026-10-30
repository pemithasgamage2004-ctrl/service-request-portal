import { defineConfig } from 'vite';

// Relative base so the build works at https://<user>.github.io/<repo>/
// without hard-coding the repo name. Routing is hash-based, so no server rewrites are needed.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Keep assets as separate files (no data: URIs for JS) so the CSP can stay strict.
    assetsInlineLimit: 0,
  },
});
