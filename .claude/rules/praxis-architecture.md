# Praxis Project Overview

- Privacy-first Chrome/Firefox browser extension for capturing workflow guides
- Tech stack: TypeScript (strict) + Preact + Vite + Fabric.js (or Konva.js fallback)
- Build: `vite-plugin-web-extension` (aklinker1) - manifest-driven, handles IIFE for content scripts
- No declarative content_scripts - use programmatic injection via `chrome.scripting.executeScript`
- Chrome-only for v0.1 (skip webextension-polyfill, use @types/chrome directly)
- CSP: `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'`
- Fabric.js CSP compatibility is UNVALIDATED - must test in Phase 0 before committing
- Service Workers terminate after 30s idle - heartbeat mechanism required
- Session transfer to editor uses lazy/chunked protocol (messages have ~64MB limit)
- Pre-click buffer uses mousedown (not continuous polling)
- SPA navigation via chrome.webNavigation.onHistoryStateUpdated (not MAIN world injection)
- Shadow DOM mode: 'closed' with adoptedStyleSheets for content script toolbar
- HTML export must include meta CSP tag + entity-encoded text + validated image src
- Blur tool must be destructive pixel modification (not canvas overlay), non-undoable
- Plan file: plans/implement-praxis-mvp.md
