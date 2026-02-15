---
globs: ["src/content/**/*.ts","src/shared/messaging.ts"]
---

## Chrome Extension Context Invalidation

- After extension reload, `chrome.runtime.id` becomes `undefined` on existing content scripts
- Always guard `chrome.runtime.sendMessage()` with `chrome.runtime?.id` check
- Heartbeat intervals must auto-clear when context is invalidated
- Fire-and-forget `sendMessage()` calls need `.catch()` to prevent unhandled rejections
- The error message is "Extension context invalidated" — this is normal during dev, not a real bug in production

## Fabric.js Canvas Sizing

- Never hardcode canvas dimensions (800x600) — read container width dynamically
- Use `canvasRef.current?.parentElement?.clientWidth` to get available space
- Set canvas dimensions in the background image loading effect, not at creation time
- Scale formula: `const maxWidth = Math.max(containerWidth - padding, minFloor)`

## captureVisibleTab Repaint Race

- `chrome.tabs.captureVisibleTab` captures what's currently **painted** on screen
- Setting `opacity: 0` via JS doesn't guarantee the browser has repainted before the capture API grabs pixels
- Must wait for repaint using `requestAnimationFrame(() => setTimeout(resolve, 0))` before signaling the service worker to capture
- rAF fires before paint, setTimeout(0) inside rAF fires after paint — this is the standard "wait for repaint" trick
- In tests: `flushPaint()` helper triggers both rAF + setTimeout; use in `afterEach` to prevent leaks between tests

## sendTabMessage in capture pipeline must be non-fatal

- `chrome.tabs.sendMessage` throws "Receiving end does not exist" when the content script is destroyed by navigation
- In `captureManager.handleInteractionEvent`, SHOW_TOOLBAR and HIDE_TOOLBAR sends must use `.catch(() => {})` because navigation clicks destroy the content script before the service worker processes the event
- The pre-click buffer already has the screenshot — don't let a failed SHOW_TOOLBAR kill the entire step creation
- The `onCommitted` handler re-injects the content script and sends RESTORE_TOOLBAR with the correct step count, so the toolbar recovers automatically

## Chrome Manifest Description Limit

- Chrome MV3 `description` field: max **132 characters**
- `vite-plugin-web-extension` validates this at build time and will fail the build if exceeded
- The longer description can go in package.json (no limit) and Chrome Web Store listing (separate field)
