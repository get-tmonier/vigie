// @ts-check

import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://tmonier.com',
  output: 'static',
  prefetch: false,
  integrations: [sitemap({ filter: (page) => !page.includes('/og/') })],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    routing: { prefixDefaultLocale: false },
  },
  build: {
    inlineStylesheets: 'always',
  },

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['@resvg/resvg-js'],
    },
  },
});
