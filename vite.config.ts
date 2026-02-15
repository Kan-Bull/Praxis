import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    preact(),
    webExtension({
      manifest: 'src/manifest.json',
      additionalInputs: ['src/editor/index.html', 'src/content/index.ts'],
    }),
  ],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@background': resolve(__dirname, 'src/background'),
      '@content': resolve(__dirname, 'src/content'),
      '@popup': resolve(__dirname, 'src/popup'),
      '@editor': resolve(__dirname, 'src/editor'),
    },
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  build: {
    target: 'chrome120',
    modulePreload: false,
  },
});
