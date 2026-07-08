import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://awone.fr',
  compressHTML: true,
  integrations: [sitemap()],
  build: { inlineStylesheets: 'never' }
});
