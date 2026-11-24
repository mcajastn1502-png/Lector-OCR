import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En GitHub Pages la app se sirve en https://<usuario>.github.io/Lector-OCR/
export default defineConfig({
  base: '/Lector-OCR/',
  plugins: [react()],
  server: { allowedHosts: true },
});
