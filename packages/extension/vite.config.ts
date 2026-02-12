import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import path from 'path';
import manifestChrome from './manifest.chrome.json';
import manifestFirefox from './manifest.firefox.json';

export default defineConfig(({ mode }) => {
  const isFirefox = mode === 'firefox';

  // Select manifest based on browser
  const manifest = isFirefox ? manifestFirefox : manifestChrome;

  return {
    plugins: [
      crx({
        manifest,
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: isFirefox ? 'dist-firefox' : 'dist-chrome',
      rollupOptions: {
        input: {
          background: 'src/background/index.ts',
          content: 'src/content/index.ts',
        },
      },
    },
  };
});
