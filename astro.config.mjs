import { defineConfig } from 'astro/config';

export default defineConfig({
  compressHTML: true,
  build: { inlineStylesheets: 'never' },
  vite: { build: { cssMinify: true, minify: 'esbuild' } }
});
