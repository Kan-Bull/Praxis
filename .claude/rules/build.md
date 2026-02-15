# Praxis Build

- Build: `npx vite build` from project root
- Tests: `npx vitest run`
- Icons live in `public/icons/` (Vite copies public/ to dist/)
- Editor page is not in manifest - added via `additionalInputs: ['src/editor/index.html']` in vite.config.ts
- Icon generator script: `node scripts/create-placeholder-icons.cjs` (must be .cjs because package.json has `"type": "module"`)
- vite-plugin-web-extension auto-rewrites `.ts` references in manifest to `.js` in dist
- Background agents cannot get interactive permission approval for Write/Bash tools - don't use run_in_background for agents that need to write files
