import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from monorepo root
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '');

  // Derive API URL from HOST (single source of truth)
  const HOST = env.HOST || 'localhost';
  const PORT = env.PORT || '3000';
  const USE_HTTPS = mode === 'production' && !HOST.includes('localhost');
  const PROTOCOL = USE_HTTPS ? 'https' : 'http';
  const API_URL = `${PROTOCOL}://${HOST}:${PORT}`;

  console.log('[VITE CONFIG] HOST:', HOST);
  console.log('[VITE CONFIG] API_URL:', API_URL);
  console.log('[VITE CONFIG] mode:', mode);

  return {
    plugins: [react()],
    // Load .env from monorepo root instead of package directory
    envDir: path.resolve(__dirname, '../..'),
    // Inject derived VITE_API_URL from HOST
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(API_URL),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: API_URL,
          changeOrigin: true,
        },
      },
    },
  };
});
