import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// index.html es la galería (three.js); configurador.html es el configurador (Crucible).
export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        configurador: resolve(import.meta.dirname, 'configurador.html'),
      },
    },
  },
});
