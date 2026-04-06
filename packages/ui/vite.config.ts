import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '#app': resolve(__dirname, 'src/app'),
      '#entities': resolve(__dirname, 'src/entities'),
      '#features': resolve(__dirname, 'src/features'),
      '#pages': resolve(__dirname, 'src/pages'),
      '#routes': resolve(__dirname, 'src/routes'),
      '#shared': resolve(__dirname, 'src/shared'),
      '#widgets': resolve(__dirname, 'src/widgets'),
    },
  },
  plugins: [tailwindcss(), react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:19191',
      '/ws': {
        target: 'ws://localhost:19191',
        ws: true,
      },
    },
  },
});
