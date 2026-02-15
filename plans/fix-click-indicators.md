# Fix Missing Click Indicators

**Status**: Draft

## Objective

Make click locations visible on screenshots in Praxis workflow guides. When a user clicks an element during capture, the resulting guide should show exactly where the click occurred -- both in the editor canvas and in the exported HTML.

### Success Criteria

- Screenshots in the editor display a click indicator at the exact click position
- Click indicators appear automatically when a step is loaded (no user action required)
- Click indicators are Fabric.js objects (editable, movable, deletable)
- Exported HTML guides include the click indicator composited into the screenshot
- Existing sessions without click coordinates gracefully degrade (use center of bounding rect)
- All new code is covered by tests (TDD -- tests first)
- Zero regressions on existing 416 tests

### Scope

**Included:**
- Capture `clientX`/`clientY` from `MouseEvent` in click tracker
- Add `clickX`/`clickY` fields to `InteractionEvent` type
- Auto-place a click indicator on the Fabric.js canvas when a step loads
- Composite annotations (including click indicator) into exported screenshots
- Backward compatibility for sessions without click coordinates

**Excluded:**
- Click indicators for non-click interactions (input, change, keypress, navigation, scroll)
- Animated/interactive indicators in exported HTML (static image only)
- Custom indicator style picker in the editor UI

## Context

Praxis is a privacy-first Chrome extension that captures workflow guides by recording user interactions and screenshots. The critical pipeline is:

1. **Content script** (`clickTracker.ts`) detects click events and sends `INTERACTION_EVENT` to the service worker
2. **Service worker** (`captureManager.ts`) captures a screenshot (pre-click buffer or fresh capture), creates a `CaptureStep`, and stores it in the session
3. **Editor** (`useAnnotationCanvas.ts`) loads the screenshot as a Fabric.js canvas background and allows annotation
4. **Export** (`useExport.ts` + `htmlExporter.ts`) composites screenshots with annotations and generates an HTML file

Currently, **none of these stages render a click indicator**. The `flashHighlight` in `highlighter.ts` is purely cosmetic (fades in 300ms, not captured in screenshots). The bounding rect is stored but the exact click coordinates (`clientX`/`clientY`) are not.

### Coordinate System

- `captureVisibleTab` captures the viewport at device pixel ratio
- `BoundingRectLike` coordinates are viewport-relative (`getBoundingClientRect`)
- `MouseEvent.clientX`/`clientY` are also viewport-relative (same coordinate space as bounding rect)
- `resizeScreenshotSW` scales images to `MAX_WIDTH = 1920` if wider, preserving aspect ratio
- The editor further scales the screenshot to fit the container: `scale = imgWidth > maxWidth ? maxWidth / imgWidth : 1`
- Fabric.js canvas dimensions match the display-scaled image, so annotations must use display-scaled coordinates

**Scaling chain**: viewport coords --> screenshot pixels (devicePixelRatio) --> resized pixels (MAX_WIDTH cap) --> display pixels (editor container fit)

## Approach

### Design Decision: Click Indicator Visual

Use a **concentric ripple + numbered badge** design:
- Outer ring: 24px radius, 2px stroke, semi-transparent accent blue (`rgba(59, 130, 246, 0.4)`)
- Inner ring: 12px radius, 2px stroke, solid accent blue (`#3b82f6`)
- Center dot: 4px radius, filled solid white with blue border
- Step number badge: red circle with white number (reuse existing `createStepBadge` from `fabricHelpers.ts`), offset above-right of click point

This design is clear at any zoom level, consistent with the Praxis blue accent color scheme, and distinguishable from user-drawn rectangles.

### Design Decision: Fabric.js Object (Not Baked In)

The click indicator will be a **Fabric.js Group object** added to the canvas, not baked into the screenshot pixel data. This means:
- Users can move, delete, or adjust the indicator
- Indicators serialize with the annotations JSON (already supported by the `annotations` field on `CaptureStep`)
- The compositing pipeline in `canvasFlattener.ts` handles rendering the indicator into the export

### Design Decision: Exact clientX/clientY

Store `MouseEvent.clientX`/`clientY` on `InteractionEvent` as optional `clickX`/`clickY` fields. Compared to using center-of-bounding-rect, this is more accurate (users may click the edge of a large button, or click a specific menu item within a container).

### Design Decision: Backward Compatibility

When `clickX`/`clickY` are absent (old sessions), fall back to the center of `boundingRect`:
```
fallbackX = boundingRect.left + boundingRect.width / 2
fallbackY = boundingRect.top + boundingRect.height / 2
```

### Design Decision: Coordinate Scaling

The click coordinates travel through the pipeline as viewport pixels. When placing the indicator on the Fabric.js canvas, the coordinates must be scaled to match the canvas dimensions:

```
canvasX = viewportX * (screenshotWidth / viewportWidth) * displayScale
```

However, `captureVisibleTab` captures at the device pixel ratio, so `screenshotWidth = viewportWidth * devicePixelRatio`. After `resizeScreenshotSW` caps at `MAX_WIDTH`, we get `resizedWidth`. The editor then applies `displayScale = containerWidth / resizedWidth`.

The full transform from viewport coords to canvas coords is:
```
canvasX = viewportX * devicePixelRatio * (resizedWidth / rawWidth) * displayScale
```

We need to store the `devicePixelRatio` at capture time because it may differ from the editor's DPR. We will add an optional `devicePixelRatio` field to `InteractionEvent`.

**Simplification**: Since `resizeScreenshotSW` only downscales if `rawWidth > MAX_WIDTH`, and `displayScale` is computed from the resized image width, the combined transform simplifies to:

```
canvasX = viewportX * (canvasWidth / viewportWidth)
```

Where `viewportWidth` = `window.innerWidth` at capture time. We will store `viewportWidth` on the interaction event.

## Implementation Steps

### Phase 1: Data Layer -- Capture Click Coordinates

**Step 1: Add click coordinate fields to types** (Simple)

File: `src/shared/types.ts`

Add optional fields to `InteractionEvent`:
- `clickX?: number` -- viewport-relative X from `MouseEvent.clientX`
- `clickY?: number` -- viewport-relative Y from `MouseEvent.clientY`
- `viewportWidth?: number` -- `window.innerWidth` at capture time
- `viewportHeight?: number` -- `window.innerHeight` at capture time

These are optional to maintain backward compatibility with existing serialized sessions.

**Step 2: Capture click coordinates in clickTracker** (Simple)

File: `src/content/clickTracker.ts`

The `handler` function receives `MouseEvent e`. Add `e.clientX`, `e.clientY`, `window.innerWidth`, and `window.innerHeight` to the `InteractionEvent` payload.

Dependencies: Step 1

**Step 3: Update tests for click coordinate capture** (Simple)

File: `tests/unit/content/clickTracker.test.ts`

Add test cases:
- Verify `clickX` and `clickY` are present in the `INTERACTION_EVENT` payload
- Verify `viewportWidth` and `viewportHeight` are present
- Verify coordinates match the simulated mouse event values

Note: jsdom's `.click()` produces a `MouseEvent` with `clientX=0, clientY=0`. To test non-zero values, dispatch a custom `MouseEvent` with explicit coordinates:
```typescript
btn.dispatchEvent(new MouseEvent('click', { clientX: 150, clientY: 200, bubbles: true }));
```

### Phase 2: Click Indicator Rendering in Editor

**Step 4: Create click indicator factory in fabricHelpers** (Moderate)

File: `src/editor/lib/fabricHelpers.ts`

Add a new function `createClickIndicator(x, y, stepNumber)` that returns a Fabric.js `Group` containing:
- Outer ring (Circle, radius 24, stroke only)
- Inner ring (Circle, radius 12, stroke only)
- Center dot (Circle, radius 4, filled)
- Step number badge (reuse/adapt `createStepBadge`)

The group should be:
- `selectable: true` (user can move/delete it)
- `evented: true`
- Have a custom property `data: { type: 'click-indicator' }` for identification

Dependencies: None (standalone factory function)

**Step 5: Add tests for click indicator factory** (Simple)

File: `tests/unit/editor/fabricHelpers.test.ts`

Add test cases for `createClickIndicator`:
- Returns a Fabric.js Group
- Group is positioned at the given x, y
- Group contains 4 objects (outer ring, inner ring, center dot, badge)
- Group has `data.type === 'click-indicator'`
- Group is selectable and evented

Note: This test file already exists and directly imports Fabric.js. The existing pattern should work.

**Step 6: Create coordinate scaling utility** (Moderate)

File: `src/editor/lib/coordinateScaler.ts` (new file)

Create a function that transforms viewport-relative click coordinates to Fabric.js canvas coordinates:

```typescript
export interface ScaleContext {
  viewportWidth: number;
  viewportHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

export function viewportToCanvas(
  viewportX: number,
  viewportY: number,
  ctx: ScaleContext,
): { x: number; y: number }
```

Also include a fallback function for computing click position from bounding rect when `clickX`/`clickY` are not available:

```typescript
export function boundingRectCenter(
  rect: BoundingRectLike,
): { x: number; y: number }
```

Dependencies: None

**Step 7: Add tests for coordinate scaling** (Simple)

File: `tests/unit/editor/coordinateScaler.test.ts` (new file)

Test cases:
- Identity scaling (viewport = canvas dimensions)
- Downscale (viewport 1920 to canvas 960 -- 2x reduction)
- Non-uniform aspect ratio handling
- Zero/edge values
- `boundingRectCenter` returns midpoint of rect

Dependencies: Step 6

**Step 8: Auto-place click indicator when step loads** (Complex)

File: `src/editor/hooks/useAnnotationCanvas.ts`

After the background image loads (in the `screenshotDataUrl` effect), compute the click indicator position and add it to the canvas -- but only if:
1. The step has NO existing annotations (avoid duplicating on re-load)
2. The step has click coordinates (or a bounding rect to fall back to)

This requires passing the `CaptureStep` (or at least the interaction event data) into the hook. Currently the hook receives `screenshotDataUrl`, `annotations`, etc. We need to add:
- `clickX?: number`
- `clickY?: number`
- `viewportWidth?: number`
- `viewportHeight?: number`
- `boundingRect: BoundingRectLike`
- `stepNumber: number`

The indicator placement logic:
1. If `annotations` is already set (step was previously edited), load the saved annotations (which may include a previously placed indicator). Do NOT auto-add another.
2. If no annotations exist:
   a. Compute canvas coordinates from click coords (or fallback to bounding rect center)
   b. Create a click indicator via `createClickIndicator()`
   c. Add it to the canvas
   d. Serialize annotations immediately (triggers `onAnnotationsChange` to persist)

Dependencies: Steps 4, 6, 7

**Step 9: Update AnnotationCanvas component props** (Simple)

File: `src/editor/components/AnnotationCanvas.tsx`

Pass the new fields through from `AnnotationCanvas` props to `useAnnotationCanvas`. Add:
- `clickX?: number`
- `clickY?: number`
- `viewportWidth?: number`
- `viewportHeight?: number`
- `boundingRect: BoundingRectLike`
- `stepNumber: number`

Dependencies: Step 8

**Step 10: Wire up step data in App.tsx** (Simple)

File: `src/editor/App.tsx`

Pass the selected step's interaction event click coordinates, viewport dimensions, bounding rect, and step number to `AnnotationCanvas`.

Dependencies: Step 9

**Step 11: Add integration tests for auto-placement** (Moderate)

File: `tests/unit/editor/useAnnotationCanvas.test.ts` (new file)

Since Fabric.js dynamic imports cannot be intercepted by `vi.mock` in jsdom, mock the `useAnnotationCanvas` hook itself or test via the component with a mocked hook.

Test cases:
- Click indicator is added to canvas on initial load when no annotations exist
- Click indicator is NOT added when annotations already exist
- Fallback to bounding rect center when clickX/clickY are absent
- Indicator position matches expected scaled coordinates

Note: Follow the existing pattern of mocking hooks for component tests (per `.claude/rules/fabric-preact-integration.md`).

Dependencies: Steps 8-10

### Phase 3: Export Compositing

**Step 12: Fix getAnnotationOverlay in App.tsx** (Moderate)

File: `src/editor/App.tsx`

The current `getAnnotationOverlay` stub always returns `null`. This needs to be replaced with a function that can produce a data URL of the annotation layer for each step.

However, the current architecture has a fundamental issue: `getAnnotationOverlay()` is called per-step during export, but the Fabric.js canvas only shows one step at a time. The overlay must be generated from the saved `annotations` JSON, not from the live canvas.

**Revised approach**: Instead of using `getAnnotationOverlay()` (which would require re-rendering each step's annotations on a canvas), modify the export pipeline to:
1. For each step, load the step's `annotations` JSON onto a temporary Fabric.js canvas
2. Export that canvas as a data URL (the overlay)
3. Composite it with the screenshot using `compositeScreenshotWithOverlay`

Create a new utility function in `canvasFlattener.ts`:

```typescript
export async function renderAnnotationsToDataUrl(
  annotationsJson: string,
  width: number,
  height: number,
): Promise<string | null>
```

This function creates an in-memory Fabric.js canvas, loads the annotations JSON, and exports it as a transparent PNG data URL.

Dependencies: None (standalone utility)

**Step 13: Update useExport to composite annotations per-step** (Moderate)

File: `src/editor/hooks/useExport.ts`

Modify `confirmExport` to:
1. For each step, check if `step.annotations` is set
2. If annotations exist, call `renderAnnotationsToDataUrl` to produce an overlay
3. Composite the overlay with the screenshot via `compositeScreenshotWithOverlay`

This replaces the current `getAnnotationOverlay()` call (which always returns null) with per-step annotation rendering.

Also update the `useExport` function signature to remove the `getAnnotationOverlay` parameter since it is no longer needed.

Dependencies: Step 12

**Step 14: Update App.tsx to remove getAnnotationOverlay** (Simple)

File: `src/editor/App.tsx`

Remove the `getAnnotationOverlay` callback and update the `useExport` call.

Dependencies: Step 13

**Step 15: Add tests for annotation rendering to data URL** (Moderate)

File: `tests/unit/editor/canvasFlattener.test.ts`

Test cases for `renderAnnotationsToDataUrl`:
- Returns null for empty/undefined annotations
- Returns a data URL string for valid annotations JSON
- Canvas dimensions match the provided width/height

Note: This function uses Fabric.js, so it will need the same mocking strategy as other Fabric.js tests. Since this is a utility function (not a hook), we can mock `import('fabric')` at the module level.

Dependencies: Step 12

**Step 16: Update useExport tests** (Simple)

File: `tests/unit/editor/useExport.test.ts`

Update existing tests to:
- Remove the `getAnnotationOverlay` parameter
- Add test cases for annotation compositing during export
- Verify that steps with annotations get composited

Dependencies: Steps 13-14

### Phase 4: HTML Export Click Indicator

**Step 17: Add click indicator to HTML export** (Moderate)

File: `src/editor/lib/htmlExporter.ts`

The click indicator is already baked into the composited screenshot (from Phase 3). However, we should also add a CSS-based click indicator overlay in the HTML for better rendering at different zoom levels.

Add an optional `clickPosition` field to `ExportStep`:
```typescript
export interface ExportStep {
  stepNumber: number;
  description: string;
  screenshotDataUrl: string;
  url: string;
  clickPosition?: { xPercent: number; yPercent: number };
}
```

When `clickPosition` is present, render an additional CSS element over the screenshot:
- A pulsing circle at the click position using percentage-based positioning
- Pure CSS, no JavaScript (respects the no-JS export requirement)

Dependencies: Step 13

**Step 18: Wire click position into export steps** (Simple)

File: `src/editor/hooks/useExport.ts`

When building `exportSteps`, compute the click position as a percentage of the screenshot dimensions and pass it to the exporter.

Dependencies: Step 17

**Step 19: Add tests for HTML export click indicator** (Simple)

File: `tests/unit/editor/htmlExporter.test.ts`

Test cases:
- Export step with `clickPosition` includes the indicator markup
- Export step without `clickPosition` has no indicator
- Click position percentages are correctly applied as CSS properties

Dependencies: Step 17

## Dependencies

### External Libraries

No new dependencies required. Everything uses existing Fabric.js v7.1.0 and standard web APIs.

### Internal Dependencies Graph

```
Step 1 (types)
  |
  v
Step 2 (clickTracker) ---> Step 3 (clickTracker tests)
  |
  v
Step 4 (fabricHelpers) ---> Step 5 (fabricHelpers tests)
  |
Step 6 (coordinateScaler) ---> Step 7 (coordinateScaler tests)
  |
  v
Step 8 (useAnnotationCanvas) ---> Step 9 (AnnotationCanvas) ---> Step 10 (App.tsx) ---> Step 11 (integration tests)
                                                                       |
                                                                       v
Step 12 (renderAnnotations) ---> Step 13 (useExport) ---> Step 14 (App cleanup) ---> Step 15-16 (tests)
                                                                       |
                                                                       v
                                                            Step 17 (htmlExporter) ---> Step 18 (wire up) ---> Step 19 (tests)
```

### Parallelizable Work

- Steps 4-5 (fabricHelpers) and Steps 6-7 (coordinateScaler) can run in parallel
- Steps 12 and 17 can run in parallel (both are standalone additions)
- Step 3 (clickTracker tests) can run in parallel with Steps 4-7

## Testing Strategy

### Unit Tests (TDD -- Write Tests First)

| Step | File | What to Test |
|------|------|-------------|
| 3 | `tests/unit/content/clickTracker.test.ts` | `clickX`, `clickY`, `viewportWidth`, `viewportHeight` in INTERACTION_EVENT payload |
| 5 | `tests/unit/editor/fabricHelpers.test.ts` | `createClickIndicator` returns Group with expected children and properties |
| 7 | `tests/unit/editor/coordinateScaler.test.ts` | `viewportToCanvas` scaling math, `boundingRectCenter` fallback |
| 11 | `tests/unit/editor/useAnnotationCanvas.test.ts` | Auto-placement on load, skip when annotations exist, fallback coordinates |
| 15 | `tests/unit/editor/canvasFlattener.test.ts` | `renderAnnotationsToDataUrl` returns data URL or null |
| 16 | `tests/unit/editor/useExport.test.ts` | Updated signature, annotation compositing |
| 19 | `tests/unit/editor/htmlExporter.test.ts` | Click indicator CSS markup in output |

### Integration Tests

- **Full pipeline smoke test**: Manually verify in Chrome with extension loaded:
  1. Start capture on a page
  2. Click a button
  3. Stop capture, open editor
  4. Verify click indicator appears at the correct position on the screenshot
  5. Move the indicator, verify it persists when switching steps
  6. Export HTML, verify click indicator visible in the exported file

### Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Old session without `clickX`/`clickY` | Fall back to center of `boundingRect` |
| Old session without `viewportWidth` | Fall back to screenshot dimensions (assume DPR=1) |
| Click on edge of viewport (x=0 or x=viewportWidth) | Indicator clipped to canvas bounds |
| Very small bounding rect (e.g., icon button) | Indicator still visible (24px radius ensures minimum size) |
| Step with existing annotations (re-open session) | Load saved annotations, do NOT add duplicate indicator |
| User deletes the click indicator | Deletion persists, no re-addition on step switch |
| Screenshot resized by `resizeScreenshotSW` | Coordinate scaling accounts for resize ratio |
| Multiple rapid clicks (concurrency guard drops second) | Each captured step gets its own indicator |
| Iframe click (`isInIframe: true`) | Coordinates may be relative to iframe viewport -- document this limitation |

### Regression Safety

- Run full test suite (`npx vitest run`) after each step
- Type-check (`npx tsc --noEmit`) after type changes
- Build (`npx vite build`) after all changes to verify no bundle errors

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Coordinate mismatch between viewport and screenshot due to DPR | Medium | High | Store `viewportWidth`/`viewportHeight` at capture time; use ratio-based scaling rather than assuming DPR |
| Fabric.js Group serialization issues with custom `data` property | Low | Medium | Test `toJSON`/`loadFromJSON` round-trip with click indicator objects |
| `renderAnnotationsToDataUrl` fails in service worker context | Low | High | This runs in the editor page (not SW), so Fabric.js and Canvas are available. No issue. |
| Large annotation JSON slows export for many steps | Low | Low | Annotation JSON is typically small (a few KB). Only complex annotations would cause issues. |
| Click indicator obscures important screenshot content | Medium | Medium | Make indicator movable/deletable by the user. Keep indicator semi-transparent. |
| jsdom tests cannot test actual Fabric.js rendering | High | Medium | Mock Fabric.js at the module/hook level for component tests. Test coordinate math separately in pure unit tests. Rely on manual/E2E testing for visual correctness. |
| Breaking change to `useExport` signature (removing `getAnnotationOverlay`) | Low | Low | Update all call sites in the same step. Only one call site exists (App.tsx). |
| Iframe click coordinates relative to iframe viewport, not page viewport | Medium | Medium | Document as a known limitation. Iframe clicks will show indicator at approximate position. Full fix requires cross-frame coordinate mapping (out of scope). |

## Open Questions

1. **Should the click indicator auto-hide when the user starts annotating?** The indicator is a Fabric.js object, so it will interfere with drawing rects/text on top of it. Recommendation: No auto-hide. Users can select and delete it if it's in the way. This is simpler and more predictable.

2. **Should we add a "Toggle click indicators" button to the tool palette?** This would allow showing/hiding all click indicators at once. Recommendation: Defer to a future enhancement. For MVP, indicators are regular Fabric objects (select + delete).

3. **What about non-click interactions (input, change)?** Input fields show a cursor/focus state but no "click" per se. Recommendation: Out of scope for this fix. Click indicators for `type: 'click'` only. Other interaction types can be addressed later.

4. **Should the CSS click indicator in exported HTML use percentage positioning or absolute pixels?** Recommendation: Percentage-based positioning. This ensures the indicator stays in the correct relative position regardless of how the image is rendered (responsive width, print, etc.).

5. **Should we persist `devicePixelRatio` or compute from viewport vs screenshot dimensions?** Recommendation: Store `viewportWidth`/`viewportHeight` at capture time and derive the scaling from `screenshotWidth / viewportWidth`. This avoids needing DPR explicitly and works correctly even if the screenshot was resized.
