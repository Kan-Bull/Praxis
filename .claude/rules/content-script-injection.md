---
globs: ["src/content/index.ts","src/background/index.ts"]
---

## Content Script Re-injection on Navigation

- `chrome.webNavigation.onCommitted` fires BEFORE `document.body` exists on the new page
- Content scripts injected at `onCommitted` time must guard `document.body` access
- Use `appendToBody()` helper: append immediately if body exists, else defer to `DOMContentLoaded`
- `chrome.scripting.executeScript` resolves AFTER the script evaluates — no need for setTimeout before sending follow-up messages
- The content script's `onMessage` listener is registered synchronously (no awaits before it), so messages can be sent immediately after injection
