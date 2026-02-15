---
globs: ["src/background/captureManager.ts"]
---

## Single-slot event queue in captureManager

- `pendingInteraction` guard now queues (not drops) events while the pipeline is busy
- `queuedEvent` holds at most one event; higher-priority events replace lower-priority ones
- Priority: click(4) > change(3) > input(2) = keypress(2) > navigation(1) > scroll(0)
- Deferred events fire in the `finally` block with `{ fromQueue: true }`
- **Critical**: queued events must skip wall-clock dedup (`fromQueue` flag) — they always fire immediately after the previous pipeline, so `elapsedWall ≈ 0`. DOM timestamps still correctly reflect actual user action timing
- Clear `queuedEvent` in `setSession(null)` and `cancelCapture()` to prevent stale processing
- Added null-session guard after async operations in the pipeline (latent bug: `cancelCapture()` during pipeline caused null dereference)
