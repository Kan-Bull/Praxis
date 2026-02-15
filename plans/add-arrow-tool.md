# Add Arrow Annotation Tool

**Status**: Draft

## Objective

Add an Arrow drawing tool to the Praxis editor annotation palette so users can point at specific UI elements in their workflow screenshots.

**Success criteria:**

- Arrow tool appears in ToolPalette between Text and Blur
- Users can draw arrows by click-and-drag (start = tail, end = head)
- Arrow uses the active color from the color palette
- Arrows are selectable, movable, and deletable via the existing Select/Delete tools
- Arrows serialize/deserialize through `canvas.toJSON()` / `loadFromJSON()` without changes to the export pipeline
- All new code has unit tests; existing tests continue to pass

**Scope boundaries:**

- Single-segment straight arrows only (no curved or multi-segment paths)
- No special arrowhead style options (fixed triangle head)
- No double-headed arrows
- No changes to export pipeline (canvasFlattener, htmlExporter)

## Context

The editor currently supports four annotation tools: Select, Rectangle, Text, and Blur. Users have no way to point at specific elements on a screenshot. Arrows are the most natural pointing annotation and are standard in screenshot annotation tools.

**Current state:** ToolType union is `'select' | 'rect' | 'text' | 'blur' | 'delete'`. Drawing tools (rect, text, blur) share a mouse event pattern in `useAnnotationCanvas.ts` that handles mouse:down/move/up to draw shapes.

**Desired state:** ToolType union includes `'arrow'`. Users can select Arrow from the palette and drag to draw a colored arrow on the canvas.

**Fabric.js context:** The existing `fabricHelpers.ts` already imports `Group` from `fabric`. The arrow will need `Line` and `Triangle` from `fabric` as well -- `Line` for the shaft and `Triangle` for the arrowhead, combined into a `Group`.

## Approach

Use the established Fabric.js pattern of `Line` (shaft) + `Triangle` (arrowhead) wrapped in a `Group`. This is the well-documented approach for arrows in Fabric.js and plays nicely with serialization (`toJSON` / `loadFromJSON` handle Line, Triangle, and Group natively).

The drawing interaction follows the same drag-to-draw pattern as the existing rectangle tool: mouse:down records the start point and creates a preview line, mouse:move updates the preview, mouse:up finalizes the arrow with the arrowhead triangle.

**Key design decisions:**

1. Arrow is a `Group(Line, Triangle)` -- not a polyline or path. Groups are selectable/movable as a unit.
2. The arrowhead triangle rotates to match the line angle using `Math.atan2`.
3. Minimum drag threshold (same as rect: 5px) prevents accidental tiny arrows on click.
4. The arrow tool slot goes between Text and Blur in the palette to keep drawing tools grouped logically (Select | Rectangle | Text | **Arrow** | Blur).

## Implementation Steps

### Step 1: Update ToolType union and TOOLS array

**File:** `src/editor/components/ToolPalette.tsx`
**Complexity:** Simple

- Add `'arrow'` to the `ToolType` union type on line 4
- Add `{ id: 'arrow', label: 'Arrow' }` to the `TOOLS` array between Text and Blur (index 3, before Blur)
- No other changes to the component -- the `TOOLS.map()` loop and `data-testid` pattern handle it automatically

### Step 2: Add `createArrowAnnotation()` to fabricHelpers

**File:** `src/editor/lib/fabricHelpers.ts`
**Complexity:** Moderate

- Add `Line` and `Triangle` to the existing `import { Rect, IText, Circle, Group } from 'fabric'` statement
- Create `createArrowAnnotation(fromX, fromY, toX, toY, color)` function that:
  1. Creates a `Line` from `(fromX, fromY)` to `(toX, toY)` with the given color stroke (strokeWidth: 3, no fill)
  2. Computes the angle: `Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI)`
  3. Creates a `Triangle` arrowhead (width: 12, height: 15, fill: color) positioned at `(toX, toY)`, rotated to match the angle, with `originX: 'center'` and `originY: 'center'`
  4. The triangle needs rotation offset: Fabric.js Triangle points upward by default, so add +90 degrees to the computed angle
  5. Returns a `Group([line, triangle])` with `{ selectable: true, evented: true }`

**Arrow geometry notes:**

- Fabric.js `Line` constructor takes `[x1, y1, x2, y2]` as the first argument
- Fabric.js `Triangle` points upward by default (vertex at top center), so the rotation formula is: `angle + 90` degrees (to align the vertex with the line direction)
- The triangle position should be at the endpoint `(toX, toY)`

### Step 3: Add arrow drawing logic to useAnnotationCanvas

**File:** `src/editor/hooks/useAnnotationCanvas.ts`
**Complexity:** Moderate
**Dependencies:** Steps 1 and 2 must be complete

Changes needed in the mouse event `useEffect` (line 218-336):

1. **Extend the tool guard** on line 221: change `tool !== 'rect' && tool !== 'text' && tool !== 'blur'` to also include `tool !== 'arrow'`
2. **Add a `tempArrowRef`** alongside `tempRectRef` (or reuse `tempRectRef` since only one tool is active at a time -- but a separate ref is cleaner for readability). Add `const tempArrowLineRef = useRef<FabricObject | null>(null)` at the hook's top level.
3. **mouse:down handler**: Add an `else if (tool === 'arrow')` branch that creates a temporary `Line` (thin, colored, stroke only) from the start point to itself (zero-length initially) and adds it to the canvas as a preview
4. **mouse:move handler**: Add arrow branch -- update the temporary line's `x2`/`y2` to follow the pointer. Use `line.set({ x2: pointer.x, y2: pointer.y })`. This shows a live preview of the arrow shaft while dragging.
5. **mouse:up handler**: Add arrow branch:
   - Compute distance between start and end (`Math.hypot(dx, dy)`)
   - If distance < 5px, discard the temp line (same tiny-drag guard as rect)
   - Otherwise, remove the temp preview line, call `createArrowAnnotation(startX, startY, endX, endY, color)` from fabricHelpers, add the resulting Group to the canvas, serialize annotations
   - Clean up refs

**Important implementation detail:** The preview line during mouse:move is just a plain `Line` (no arrowhead). The full arrow `Group` with the arrowhead triangle is only created on mouse:up (finalization). This keeps the drag interaction fast and avoids re-computing triangle rotation on every mouse move.

### Step 4: Write tests (TDD -- write before or alongside each step)

**Complexity:** Moderate

#### 4a. ToolPalette test update

**File:** `tests/unit/editor/ToolPalette.test.tsx`

- Update the "renders all tool buttons" test to also assert `getByTestId('tool-arrow')` exists
- Add a test: "calls onToolChange with 'arrow' when arrow tool clicked"
- Add a test: "arrow button appears between text and blur in tool order"

#### 4b. fabricHelpers test additions

**File:** `tests/unit/editor/fabricHelpers.test.ts`

- Add `MockLine` and `MockTriangle` classes to the `vi.mock('fabric')` block (following the same pattern as MockRect/MockCircle/MockGroup)
- MockLine: `constructor(public points: number[], public opts: Record<string, unknown>) {}`
- MockTriangle: `constructor(public opts: Record<string, unknown>) {}`
- Add to the mock's return object: `Line: MockLine, Triangle: MockTriangle`
- Add import of `createArrowAnnotation` to the import statement
- Add `describe('createArrowAnnotation', ...)` block with tests:
  - "returns a Group containing a Line and a Triangle"
  - "Line uses the given start/end coordinates"
  - "Line and Triangle use the given color"
  - "Triangle is rotated to match the line angle" (test with known coords, e.g., horizontal arrow from (0,0) to (100,0) should produce angle 90 degrees for the triangle)
  - "Group is selectable and evented"
  - "arrow from (0,0) to (0,100) produces correct downward rotation" (vertical arrow)

#### 4c. useAnnotationCanvas interface test update

**File:** `tests/unit/editor/useAnnotationCanvas.test.ts`

- Update the interface test to verify that `tool: 'arrow'` is a valid `ToolType` value in the options
- The actual drawing behavior (dynamic `import('fabric')`) is not testable in jsdom -- this is consistent with the existing pattern where only the interface is unit-tested and drawing behavior is verified via E2E

## Dependencies

- Fabric.js `Line` and `Triangle` classes (already bundled with fabric v7.1.0, which is installed)
- No new npm packages needed
- No database or API changes
- No configuration changes

## Testing Strategy

**Unit Tests** (4a, 4b, 4c above):

- ToolPalette renders arrow button and fires correct onToolChange callback
- `createArrowAnnotation` returns correct Fabric.js object structure with proper geometry
- useAnnotationCanvas interface accepts `'arrow'` tool type

**Manual Testing:**

1. Load extension, capture a session, open editor
2. Select Arrow tool -- cursor should change to crosshair
3. Click and drag on screenshot -- should see preview line during drag
4. Release mouse -- arrow with arrowhead should appear
5. Switch to different color, draw another arrow -- should use new color
6. Switch to Select, click arrow -- should be selectable and movable
7. Click "Remove Annotation" with arrow selected -- should delete it
8. Export as HTML/Markdown -- arrow should appear in exported image
9. Switch between steps -- arrows should persist in annotation JSON

**Edge Cases:**

- Very short drag (< 5px) should be discarded, not create a tiny arrow
- Arrows at all angles (horizontal, vertical, diagonal, reverse direction)
- Arrow color matches the active palette color at time of drawing
- Drawing an arrow then undoing via delete works correctly
- Switching tools mid-drag (unlikely but should not crash)

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Fabric.js Triangle rotation math off by 90 degrees | Medium | Low | Well-known formula; unit test with known angles; easy to adjust offset |
| Group serialization loses Line/Triangle on loadFromJSON | Low | High | Fabric.js natively serializes Line, Triangle, Group; verify in manual test |
| Preview line not cleaned up on tool switch mid-drag | Low | Low | The useEffect cleanup removes mouse handlers; temp line stays but is harmless. Could add cleanup in the useEffect return. |
| Arrow not visible at small sizes | Low | Low | Minimum 5px drag threshold; arrowhead is 12px wide so even short arrows are visible |
| TypeScript type errors with Fabric.js Line/Triangle constructors | Medium | Low | Use `any` casts for event handlers (consistent with existing pattern); test with `npx tsc --noEmit` |

## Open Questions

None -- all design decisions are resolved based on the established patterns in the codebase. The approach is a straightforward extension of the existing rect drawing tool with a different Fabric.js shape.

## Files Changed Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/editor/components/ToolPalette.tsx` | Modify | Add `'arrow'` to ToolType, add entry to TOOLS array |
| `src/editor/lib/fabricHelpers.ts` | Modify | Add `createArrowAnnotation()`, import Line + Triangle |
| `src/editor/hooks/useAnnotationCanvas.ts` | Modify | Add arrow tool to drawing event handler, add tempArrowLineRef |
| `tests/unit/editor/ToolPalette.test.tsx` | Modify | Assert arrow button renders and fires callback |
| `tests/unit/editor/fabricHelpers.test.ts` | Modify | Add MockLine, MockTriangle, test createArrowAnnotation |
| `tests/unit/editor/useAnnotationCanvas.test.ts` | Modify | Verify arrow is valid tool type in interface |

## What Does NOT Change

- `src/editor/lib/canvasFlattener.ts` -- uses `loadFromJSON` which handles any Fabric.js object generically
- `src/editor/lib/htmlExporter.ts` -- uses composited PNG, no per-annotation handling
- `src/editor/components/AnnotationCanvas.tsx` -- tool-prop-agnostic, passes to hook
- `src/editor/App.tsx` -- already passes activeTool, no arrow-specific logic
- `src/editor/lib/coordinateScaler.ts` -- not involved in annotation drawing
- `src/shared/constants.ts` -- no new constants needed
- Export pipeline and manifest -- no changes
