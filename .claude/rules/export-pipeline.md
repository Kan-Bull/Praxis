---
globs: ["src/editor/lib/canvasFlattener.ts","src/editor/hooks/useExport.ts"]
---

## Annotation Export Coordinate Scaling

- Fabric.js `canvas.toJSON()` stores annotation coordinates in the editor's **display** space (scaled-down canvas)
- `backgroundImage.scaleX` in the annotation JSON reveals the display-to-full ratio used by the editor
- `renderAnnotationsToDataUrl` must create the `StaticCanvas` at the editor's display dimensions (not full screenshot resolution) and use `toDataURL({ multiplier: 1/scaleX })` to scale up to full resolution
- Without this, annotations shift toward top-left because small-space coordinates are placed on a large canvas

## PDF keep-together must use actual image height, not a fixed peek

- `MIN_IMAGE_PEEK = 40mm` was too lenient — cropped images change the step height, and the fixed peek allowed titles to render at page bottom while the image overflow check pushed the full image to the next page
- Fix: compute `imgHeight` from `getImageProperties` BEFORE the keep-together check, then compare `headerH + imgHeight > remainingSpace` against real dimensions
- The image overflow check inside the screenshot block is still needed as a safety net for images taller than a full page
- `y > MARGIN` guard prevents infinite page breaks when a step can never fit on a single page
