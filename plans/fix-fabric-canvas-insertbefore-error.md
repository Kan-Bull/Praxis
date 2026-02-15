# Fix Fabric.js Canvas insertBefore DOM Desync Bug

**Status**: Draft

## Objective

Fix the `Uncaught (in promise) NotFoundError: Failed to execute 'insertBefore' on 'Node'` error that occurs when Fabric.js initializes on a Preact-managed `<canvas>` element in the editor page.

Success criteria:
- Editor page loads without `insertBefore` console errors
- Fabric.js canvas initializes correctly with annotation tools functional
- All existing tests (416) continue to pass
- No regression in canvas sizing, background image loading, or annotation persistence

## Context

Fabric.js v7 wraps the target `<canvas>` element in a `.canvas-container` div and inserts a second `<canvas class="upper-canvas">` for interaction events. This mutates the DOM tree beneath the container div that Preact owns:

**Before Fabric.js init:**
```
<div ref={containerRef}>          <!-- Preact manages children -->
  <canvas ref={canvasRef} />      <!-- Preact child #0 -->
  <button data-testid="delete-trigger" />  <!-- Preact child #1 -->
</div>
```

**After Fabric.js init:**
```
<div ref={containerRef}>          <!-- Preact manages children -->
  <div class="canvas-container">  <!-- Fabric inserted this -->
    <canvas />                    <!-- Moved inside wrapper -->
    <canvas class="upper-canvas" />  <!-- Fabric created this -->
  </div>
  <button data-testid="delete-trigger" />
</div>
```

When `setCanvasReady(true)` triggers a Preact re-render, the VDOM diffing algorithm expects `<canvas>` to be a direct child of the container div. Since Fabric.js moved it inside a wrapper, Preact's `insertBefore` call fails because the reference node is no longer a child of the expected parent.

This is a fundamental incompatibility between virtual DOM libraries and Fabric.js's DOM mutation strategy. The standard solution is to keep Fabric.js's DOM modifications outside of Preact's knowledge entirely.

## Approach

**Move canvas element creation out of JSX and into imperative code.** Preact will render an empty host div. The `useAnnotationCanvas` hook will imperatively create a `<canvas>` element, append it to the host div, and pass it to Fabric.js. Since Preact's VDOM has no children inside the host div, Fabric.js can wrap/mutate it freely without conflicting with VDOM diffing.

Secondary cleanup: disable Vite's module preload polyfill since the build targets Chrome 120+ which supports it natively.

## Implementation Steps

### Step 1: Refactor AnnotationCanvas component

**File:** `src/editor/components/AnnotationCanvas.tsx`

Changes:
- Remove `const canvasRef = useRef<HTMLCanvasElement>(null)` -- no longer needed as a Preact ref
- Add `const canvasHostRef = useRef<HTMLDivElement>(null)` -- empty div that Fabric.js will populate
- Replace `<canvas ref={canvasRef} data-testid="annotation-canvas" />` with `<div ref={canvasHostRef} data-testid="canvas-host" />`
- Pass `canvasHostRef` instead of `canvasRef` to `useAnnotationCanvas`
- Move the blur confirm dialog and delete trigger button **outside** the canvas host div (into a sibling or wrapper) so Preact never tries to diff children alongside Fabric.js's DOM mutations

The container div structure becomes:
```jsx
<div ref={containerRef} style={...} data-testid="annotation-canvas-wrapper">
  <div ref={canvasHostRef} data-testid="canvas-host" />
  {blurRegion && (<div data-testid="blur-confirm-dialog">...</div>)}
  <button data-testid="delete-trigger" ... />
</div>
```

The canvas host div is an opaque boundary -- Preact sees it as an empty div with no children, so Fabric.js can do whatever it wants inside it.

Complexity: Simple

### Step 2: Refactor useAnnotationCanvas hook

**File:** `src/editor/hooks/useAnnotationCanvas.ts`

Changes:
- Change the `canvasRef` option from `RefObject<HTMLCanvasElement | null>` to `canvasHostRef: RefObject<HTMLDivElement | null>` in the `UseAnnotationCanvasOptions` interface
- In the canvas creation effect (lines 43-66):
  - Guard on `canvasHostRef.current` instead of `canvasRef.current`
  - Imperatively create the canvas element: `const el = document.createElement('canvas')`
  - Optionally set `el.dataset.testid = 'annotation-canvas'` for E2E test selectors
  - Append to host: `canvasHostRef.current.appendChild(el)`
  - Pass `el` (not a ref) to `new Canvas(el, { ... })`
  - `setCanvasReady(true)` now triggers a re-render, but Preact's VDOM for the host div has zero children, so no diff conflict occurs
- In the cleanup function:
  - After `fabricCanvasRef.current.dispose()`, Fabric.js may or may not remove its wrapper. Explicitly clear the host div: `if (canvasHostRef.current) canvasHostRef.current.innerHTML = ''`
  - This ensures clean state on hot module reload or component remount
- Update the effect dependency from `[canvasRef]` to `[canvasHostRef]`

Complexity: Moderate (core fix, must be precise)

Dependencies: Step 1 should be done first or simultaneously, since the interface changes.

### Step 3: Disable Vite module preload polyfill

**File:** `vite.config.ts`

Changes:
- Add `modulePreload: false` to the `build` config object (alongside existing `target: 'chrome120'`)
- Chrome 120+ supports native module preload, so the polyfill is dead code in this extension context

Complexity: Simple

Dependencies: None (independent of Steps 1-2)

### Step 4: Update AnnotationCanvas test

**File:** `tests/unit/editor/AnnotationCanvas.test.tsx`

Changes:
- The test `'renders canvas element'` currently looks for `getByTestId('annotation-canvas')` which was the `<canvas>` element. After the fix, the canvas is created imperatively and not in the VDOM. Update this test to check for the canvas host div instead: `getByTestId('canvas-host')`
- The test `'passes correct options to useAnnotationCanvas'` checks that the hook receives `containerRef`. It should also verify that `canvasHostRef` is passed (the renamed prop). Update the `expect.objectContaining` assertion to use the new prop name
- All other tests (blur dialog, delete trigger) should pass without changes since they don't reference the canvas element directly

Complexity: Simple

Dependencies: Steps 1-2 must be done first.

### Step 5: Verify App test compatibility

**File:** `tests/unit/editor/App.test.tsx`

Review only -- this test mocks `useAnnotationCanvas` entirely, so it should be unaffected. Verify it still passes after the interface change.

Complexity: Simple (verification only)

### Step 6: Build and manual verification

- Run `npx vitest run` to confirm all 416 tests pass
- Run `npx vite build` to confirm clean build
- Load extension in Chrome via `chrome://extensions` > Load Unpacked (`dist/`)
- Open the editor page and verify:
  - No `insertBefore` errors in console
  - Canvas renders with screenshot background
  - Annotation tools (rect, text, blur, select) work
  - Step switching preserves annotations
  - Export still functions

Complexity: Simple (verification only)

## Dependencies

No new libraries or external dependencies required. This is a refactor of existing code using existing APIs:
- `document.createElement('canvas')` -- standard DOM API
- `HTMLDivElement.appendChild()` -- standard DOM API
- `HTMLDivElement.innerHTML = ''` -- standard DOM API for cleanup

## Testing Strategy

**Unit Tests (automated):**
- All 416 existing tests must continue to pass
- `AnnotationCanvas.test.tsx`: Updated test for canvas host div rendering
- `AnnotationCanvas.test.tsx`: Updated test for hook prop names
- `App.test.tsx`: No changes needed (mocks the hook entirely)

**Manual Testing:**
- Load extension and open editor page -- no console errors
- Capture a workflow and open it in the editor
- Draw rectangles, add text, use blur tool
- Switch between steps -- annotations persist
- Export to HTML -- output is correct
- Resize browser window -- canvas responds to container width

**Edge Cases:**
- Component unmount during Fabric.js async import (already handled by `disposed` flag)
- Hot module reload (cleanup function clears host div)
- No screenshot available (canvas should still initialize without background)

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Test ID changes break E2E tests | Low | Low | No E2E tests exist yet; `data-testid="canvas-host"` is a new selector, not replacing one used in automation |
| `innerHTML = ''` cleanup insufficient after Fabric dispose | Low | Medium | Fabric.js `dispose()` should handle its own cleanup; the `innerHTML` clear is a safety net for edge cases |
| Container width measurement affected by DOM restructure | Low | Medium | `containerRef` is separate from `canvasHostRef` and unchanged; width measurement logic is unaffected |
| Blur dialog positioning breaks | Low | Low | Dialog uses `position: absolute` relative to `containerRef` wrapper, which is unchanged |

## Open Questions

- Should `data-testid="annotation-canvas"` be preserved on the imperatively-created `<canvas>` element for future E2E tests? (Recommendation: yes, set `el.dataset.testid = 'annotation-canvas'` for consistency)
- Is `innerHTML = ''` the right cleanup approach, or should we explicitly `removeChild` the canvas element? (Recommendation: `innerHTML = ''` is simpler and handles any child Fabric.js adds; `removeChild` would require tracking the exact element)
