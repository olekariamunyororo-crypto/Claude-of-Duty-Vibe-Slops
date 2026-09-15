import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so dist/ deploys anywhere (Render, Pages, GH Pages)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1600 },
});
