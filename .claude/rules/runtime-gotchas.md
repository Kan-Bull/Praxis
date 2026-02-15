---
globs: ["src/background/**/*.ts"]
---

# Content Script Injection Path

- `chrome.scripting.executeScript({ files: [...] })` uses RUNTIME paths (the built `.js`), not source `.ts` paths
- `vite-plugin-web-extension` rewrites `.ts` to `.js` in `manifest.json` automatically, but NOT in code strings
- Always use `.js` extension in `executeScript` file paths: `'src/content/index.js'` not `'src/content/index.ts'`
