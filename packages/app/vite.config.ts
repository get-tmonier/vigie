import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: { entry: resolve(__dirname, 'src/infra/ssr/client-entry.tsx') },
      output: {
        entryFileNames: 'entry.js',
        assetFileNames: 'style[extname]',
      },
    },
  },
  resolve: {
    alias: {
      '#modules': resolve(__dirname, 'src/modules'),
      '#infra': resolve(__dirname, 'src/infra'),
      '#shared': resolve(__dirname, 'src/shared'),
    },
  },
  plugins: [tailwindcss(), react()],
});
