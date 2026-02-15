---
globs: ["src/content/clickTracker.ts","src/editor/lib/coordinateScaler.ts","src/editor/lib/fabricHelpers.ts","src/editor/hooks/useAnnotationCanvas.ts","src/editor/lib/canvasFlattener.ts","src/editor/lib/htmlExporter.ts"]
---

# Click Indicator Pipeline

- Click coordinates (`clientX`/`clientY`) are captured in `clickTracker.ts` alongside `viewportWidth`/`viewportHeight`
- `InteractionEvent` has optional `clickX`, `clickY`, `viewportWidth`, `viewportHeight` fields (backward compatible)
- `coordinateScaler.ts` transforms viewport coords to canvas coords via `viewportToCanvas()`
- `fabricHelpers.ts` has `createClickIndicator(x, y, stepNumber)` — returns Fabric.js Group with concentric rings + badge
- Auto-placement in `useAnnotationCanvas.ts`: adds indicator on first load (skips if annotations already exist)
- Click indicator has `data: { type: 'click-indicator' }` for identification
- Export compositing: `renderAnnotationsToDataUrl()` in `canvasFlattener.ts` renders annotations to transparent PNG
- HTML export: CSS-based click indicator overlay using percentage positioning (`left: X%; top: Y%`)
- Old sessions without click coords gracefully degrade to center of `boundingRect`
