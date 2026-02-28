// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://tmonier.com',
  output: 'static',

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['@resvg/resvg-js'],
    },
  },
});