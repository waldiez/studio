import react from '@vitejs/plugin-react';
import 'dotenv/config';
import { resolve } from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const base = process.env['WALDIEZ_STUDIO_BASE_URL'] || '/';
  const publicDir = command === 'build' ? resolve(__dirname, '..', 'public', 'files') : resolve(__dirname, '..', 'public');
  return {
    publicDir,
    base,
    build: {
      emptyOutDir: true,
      minify: 'terser',
      outDir: resolve(__dirname, '..', 'waldiez_studio', 'static', 'frontend'),
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react'],
            'react-dom': ['react-dom'],
            'xyflow-react': ['@xyflow/react'],
            'waldiez-react': ['@waldiez/react']
          }
        }
      }
    },
    plugins: [react()]
  };
});
