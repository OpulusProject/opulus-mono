import path from 'path';

import react from '@vitejs/plugin-react-swc';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    tanstackRouter(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@gems': path.resolve(__dirname, '../opulus-gems/dist'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  css: {
    postcss: './postcss.config.js',
  },
  // Watch for changes in gems dist folder
  server: {
    watch: {
      ignored: ['!**/node_modules/@gems/**'],
    },
    fs: {
      allow: ['..'],
    },
  },
});

