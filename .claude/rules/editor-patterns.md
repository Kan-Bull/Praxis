---
globs: ["src/editor/**/*.ts","src/editor/**/*.tsx"]
---

## Fabric.js Canvas Container Sizing

- Fabric.js wraps the `<canvas>` element in a `.canvas-container` div sized to the canvas dimensions
- `canvasRef.current?.parentElement?.clientWidth` returns the Fabric wrapper width, NOT the available layout space
- Always use a separate `containerRef` on the layout wrapper div to measure available width for responsive sizing
- Pass `containerRef` alongside `canvasRef` to hooks that need layout measurements

## Fabric.js Arrow Pattern

- Arrow annotation = `Line` (shaft) + `Triangle` (arrowhead) in a `Group`
- Fabric.js `Triangle` points upward by default — rotation formula: `Math.atan2(dy, dx) * (180/PI) + 90`
- During drag preview, show only the `Line`; create full `Group` only on mouse:up (avoids recomputing triangle rotation every mouse:move)
- `Line` constructor takes `[x1, y1, x2, y2]` as first arg, options as second
- Update temp line during drag via `.set({ x2: pointer.x, y2: pointer.y })`

## Text Tool: Click-to-Place, Not Drag-to-Draw

- The text tool should NOT share the drag-to-draw-rect pattern with rect/blur tools
- Text tool behavior: click anywhere → place IText at position → enter editing immediately
- Exclude 'text' from temp rect creation in mouse:down; handle text separately in mouse:up before rect logic
- If the text tool creates a temp rect, dragging produces a visible rectangle artifact on the canvas

## Editor Canvas Gutter Debugging

- The "dark grey gutters" in the editor are NOT CSS elements — they're the captured page's own margins rendered on the Fabric.js canvas surface
- Fabric.js canvas-container wrapper expands to canvas pixel dimensions; CSS backgrounds on parent/sibling elements don't cover the canvas surface
- To create visible gutters: cap the canvas `maxWidth` (1400px) so the blueprint gutter divs get real estate
- Blueprint gutter divs are in AnnotationCanvas.tsx: `gutter-left` and `gutter-right` with `flex: 1` flanking the canvas-host
- When debugging visual layout issues in extension pages, always ask for DevTools inspection first — cross-extension security prevents MCP tools from inspecting `chrome-extension://` pages

## Crop clears annotations with truthy empty JSON, not empty string

- After crop, `updateAnnotations(stepId, '{"objects":[]}')` — NOT `''`
- Empty string is falsy → triggers `useAnnotationCanvas` auto-placement with stale viewport coords against cropped image dimensions → displaced click indicator
- `'{"objects":[]}'` is truthy → skips auto-placement, which is correct since crop dialog promises "clear all annotations"
- Valid Fabric.js JSON — `loadFromJSON` handles it correctly (empty objects array)
