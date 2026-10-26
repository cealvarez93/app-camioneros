import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, /api_final se redirige a la API simulada local (server/mock.mjs).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api_final': 'http://localhost:8787' } },
});
