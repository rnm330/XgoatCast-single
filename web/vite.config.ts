import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3520',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3520',
        changeOrigin: true,
        ws: true,
      },
    },
  } as any,
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      external: ['agora-rtc-sdk-ng'],
    },
  },
});
