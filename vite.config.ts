import { defineConfig, type Plugin } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

/**
 * Strip remote CDN URLs embedded in jsPDF's dead-code `pdfobjectnewwindow` path.
 * Chrome Web Store MV3 policy forbids any remotely-hosted code references.
 */
function stripRemoteCdnUrls(): Plugin {
  return {
    name: 'strip-remote-cdn-urls',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk' && file.code) {
          file.code = file.code.replace(
            /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdfobject\/[^"']*/g,
            '',
          );
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    preact(),
    webExtension({
      manifest: 'src/manifest.json',
      additionalInputs: ['src/editor/index.html', 'src/content/index.ts'],
    }),
    stripRemoteCdnUrls(),
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
