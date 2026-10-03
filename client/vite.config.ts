import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API_URL / CLIENT_PORT let the e2e suite run an isolated stack on other ports.
const apiTarget = process.env.API_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.CLIENT_PORT) || 5173,
    proxy: {
      '/api': apiTarget,
    },
  },
});
