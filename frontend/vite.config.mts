import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import vitePortScanner from './vite-plugin-port-scanner';

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  envDir: '../',
  server: {
    port: 9000,
    allowedHosts: [
      'openaerialmap.hotosm.test',
      '.hotosm.test'
    ]
  },
  plugins: [react(), vitePortScanner()],
  resolve: {
    alias: {
      $components: path.resolve(__dirname, './app/components'),
      $utils: path.resolve(__dirname, './app/utils'),
      $styles: path.resolve(__dirname, './app/styles'),
      $hooks: path.resolve(__dirname, './app/hooks'),
      $pages: path.resolve(__dirname, './app/pages')
    }
  }
});
