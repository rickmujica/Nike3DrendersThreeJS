import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// index.html es el configurador; visor.html es el visor original con three.js.
export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        visor: resolve(import.meta.dirname, 'visor.html'),
      },
    },
  },
});
