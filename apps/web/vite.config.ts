import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Use the shared package's TypeScript source directly: no build step needed for the web app.
    alias: { '@teamlift/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts') },
  },
  server: {
    port: 5173,
    // Locally the web app calls /api on its own origin and Vite forwards it, so no CORS setup.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
