---
globs: ["src/content/toolbar.ts","src/content/index.ts"]
---

## Toolbar Screenshot Hide Strategy

- Use `opacity: 0` + `pointerEvents: none` instead of `display: none` when hiding toolbar for screenshots
- `display: none` causes a visible flash (disappear/reappear) that's jarring to users
- `opacity: 0` is invisible to `captureVisibleTab` (renders transparent pixels) but doesn't cause layout shift
- `hide()` = permanent hide (display:none), `hideForScreenshot()`/`showAfterScreenshot()` = transient hide (opacity:0)

## Toolbar Screenshot Hiding — Belt and Suspenders

- `hideForScreenshot()` must set BOTH `opacity: 0` AND `visibility: hidden`
- `opacity: 0` alone can race with Chrome's compositor — `captureVisibleTab` may grab a frame before the opacity change propagates
- `visibility: hidden` is a stronger compositor-level signal that prevents the element from being painted entirely
- `showAfterScreenshot()` must clear both: `opacity: ''`, `visibility: ''`, `pointerEvents: ''`
- Do NOT use `display: none` — that causes visible layout shift/flash
