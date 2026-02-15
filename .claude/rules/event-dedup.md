---
globs: ["src/content/formTracker.ts","src/background/captureManager.ts"]
---

## Debounced event timestamps must use event-fire time

- `formTracker.handleInput` uses `setTimeout` for debounce — the INTERACTION_EVENT timestamp must be captured at event-fire time, NOT inside the debounce callback
- Otherwise: click fires at T=0, debounced input fires at T+INPUT_DEBOUNCE (500ms), and the dedup window (300ms) can't catch the duplicate
- Wikipedia uses hidden checkboxes (`<input class="vector-dropdown-checkbox">`) for dropdown toggles — clicking fires click + input + change on the same element
- Pattern: capture `const timestamp = Date.now()` before setTimeout, pass it through to the message sender
