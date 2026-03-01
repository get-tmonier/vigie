import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';

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
  plugins: [
    tailwindcss(),
    tanstackStart(),
    react(),
  ],
});
