---
globs: ["src/background/screenshotManager.ts","src/shared/constants.ts","src/shared/imageProcessor.ts"]
---

## Screenshot Quality Pipeline

- Capture: `captureVisibleTab` with `format: 'png'` (lossless, no quality param)
- Resize: `resizeScreenshotSW` outputs PNG via `convertToBlob({ type: 'image/png' })`
- MAX_WIDTH: 3840 (preserves full Retina resolution; only ultra-wide triggers resize)
- Thumbnails: still JPEG at `JPEG_QUALITY` (0.85) via `createThumbnailSW` — size matters for thumbnails, not quality
- `cropScreenshot` in `imageProcessor.ts` outputs PNG (was already correct)
- `JPEG_QUALITY` constant still exists — used only by thumbnails and `compressScreenshot`
