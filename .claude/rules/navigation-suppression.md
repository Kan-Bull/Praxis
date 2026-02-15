---
globs: ["src/background/captureManager.ts","src/content/navigationHandler.ts"]
---

# Navigation Step Suppression

- Navigation events (SPA `onHistoryStateUpdated`) within 2s of the last captured step are suppressed in `captureManager.ts`
- Navigation is a consequence of a click/form action, not a separate user action
- `NAV_SUPPRESS_WINDOW = 2_000` ms — configurable constant at module level
- First-interaction navigations (no prior steps) are allowed through
- The toolbar step counter was out of sync because nav steps incremented `session.steps.length` but the content script's local `stepCount` lagged behind re-injection

## Step Dedup Window

- A single user action can fire multiple DOM events: click+change (checkboxes), label→input synthetic click, click→SPA navigation
- Each event produces a separate INTERACTION_EVENT → double-counting steps
- The `pendingInteraction` concurrency guard only helps for events that arrive while the first is still processing
- Added `STEP_DEDUP_WINDOW = 300ms`: suppress any event arriving within 300ms of the last created step's timestamp
- Navigation events still use the wider `NAV_SUPPRESS_WINDOW = 2000ms`
- Both windows are checked in a single unified guard at the top of `handleInteractionEvent`
