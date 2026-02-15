# Replace HTML Export with PDF Export

**Status**: Complete

## Objective

Replace the current self-contained HTML export in the Praxis editor with a
professional PDF export using jsPDF. This is a clean break -- all HTML export
code is removed and replaced, not augmented.

**Success criteria:**

- Clicking "Export PDF" produces a downloadable `.pdf` file
- PDF contains title, numbered steps with descriptions, URLs, screenshots, and
  click indicators
- All HTML export source files and tests are deleted
- All remaining tests pass, types check, and the extension builds cleanly
- jsPDF works under the extension's `script-src 'self'` CSP when bundled

**Scope boundaries:**

- IN: PDF generation, UI text changes, HTML cleanup, test updates
- OUT: New export features (table of contents, custom fonts, multi-format), UI
  redesign beyond text label changes

## Context

Praxis currently exports workflow guides as self-contained HTML files. The HTML
export pipeline includes security hardening (CSP meta tag, XSS validation,
entity encoding) because HTML is an executable format. PDF eliminates this
entire class of security concern -- there is no script execution in PDF, so the
validator and encoder become dead code.

**Current state:**

- `htmlExporter.ts` generates HTML string (89 lines)
- `exportValidator.ts` validates HTML for XSS (75 lines)
- `htmlEncode.ts` entity-encodes text (14 lines)
- `useExport.ts` orchestrates the pipeline: PII scan, review, composite, generate, validate, download
- `canvasFlattener.ts` composites Fabric.js annotations onto screenshots (kept as-is)
- `sensitiveTextScanner.ts` detects PII in step descriptions (kept as-is)

**Desired state:**

- `pdfExporter.ts` generates PDF blob using jsPDF
- `useExport.ts` calls `generateExportPdf()` instead of `generateExportHtml()` + `validateExportHtml()`
- No HTML export code remains in the codebase

**Extension CSP:**

```
default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; connect-src 'none'; object-src 'none'
```

jsPDF must work under `script-src 'self'` when bundled by Vite (no dynamic
`Function()` or `eval()`). This needs verification during Step 1.

## Approach

Use jsPDF to generate PDF documents client-side. jsPDF supports:

- Text rendering with font size/color control
- Image embedding from data URLs (`addImage`)
- Primitive drawing (circles, lines) for click indicators
- Automatic page management (`addPage`)

The PDF layout follows a professional light theme (white background, clean
typography, subtle borders) that mirrors the existing HTML export's visual
style.

Key design decisions:

1. **jsPDF over pdf-lib**: jsPDF has a simpler API for layout-oriented
   documents. pdf-lib is lower-level and better for form filling / PDF editing.
2. **No HTML-to-PDF conversion**: We build the PDF programmatically, not by
   rendering HTML. This avoids needing a headless browser or html2canvas.
3. **Clean break**: All HTML export code is deleted rather than kept as a
   fallback. This reduces maintenance burden and dead code.
4. **Click indicators via jsPDF primitives**: Rather than compositing click
   indicators into screenshots (which would duplicate the canvas flattener's
   work), we draw them directly on the PDF using jsPDF circle/line primitives.
   This keeps them resolution-independent.

## Implementation Steps

### Step 1: Install jsPDF and verify CSP compatibility

- Run `npm install jspdf`
- Create a minimal test that imports jsPDF, generates a 1-page PDF, and
  verifies it produces a Blob
- Build the extension (`npx vite build`) and confirm no CSP violations
- If jsPDF uses `Function()` constructor internally, fall back to `pdf-lib`

Complexity: Simple
Dependencies: None

### Step 2: Create `pdfExporter.ts` with tests

**New file:** `src/editor/lib/pdfExporter.ts`

Interface:

```typescript
export interface PdfExportStep {
  stepNumber: number;
  description: string;
  screenshotDataUrl: string;
  url: string;
  clickPosition?: { xPercent: number; yPercent: number };
}

export interface PdfExportOptions {
  title: string;
  steps: PdfExportStep[];
}

// Returns a Blob of type application/pdf
export async function generateExportPdf(
  options: PdfExportOptions,
): Promise<Blob>;
```

PDF layout specification (A4 portrait, 210mm x 297mm):

- **Margins**: 15mm all sides (content width = 180mm)
- **Header**: Title in 20pt, color `#1e293b`, followed by a 0.5pt horizontal
  rule in `#e2e8f0`, 8mm below title
- **Step block** (repeats for each step):
  - Step badge: filled circle (radius 4mm) in `#3b82f6` with white step number
    (10pt, bold, centered)
  - Description: 11pt, color `#1e293b`, positioned 12mm right of badge center
  - URL: 9pt, color `#64748b`, below description
  - Screenshot: scaled to fit content width (180mm), maintaining aspect ratio.
    Image added via `doc.addImage(dataUrl, 'PNG', x, y, w, h)`
  - Click indicator (when `clickPosition` present): concentric circles drawn
    with jsPDF `circle()` -- outer ring 4mm radius in `#3b82f6` (0.5pt stroke),
    inner ring 2mm radius in `#3b82f6` (1pt stroke), center dot 0.8mm radius
    filled `#ef4444`
  - Bottom spacing: 8mm between steps
- **Page breaks**: Before each step, check if remaining page height can fit at
  least the badge + description + 40mm for image. If not, `doc.addPage()`.
- **Footer**: "Generated by Praxis" centered at bottom of last page, 9pt,
  color `#94a3b8`
- **Graceful degradation**: If `screenshotDataUrl` is empty or invalid, skip
  image for that step (do not crash)

**New file:** `tests/unit/editor/pdfExporter.test.ts`

Since jsPDF uses canvas internally and jsdom has no real canvas, mock jsPDF
entirely. Tests verify:

1. Function returns a Blob with `type: 'application/pdf'`
2. `jsPDF` constructor called with A4 portrait config
3. `doc.text()` called with title and step descriptions
4. `doc.addImage()` called once per step with valid screenshot
5. `doc.addPage()` called when multiple steps present (page break logic)
6. Click indicator drawing methods (`doc.circle()`, `doc.setFillColor()`)
   called when `clickPosition` provided
7. Click indicator methods NOT called when `clickPosition` absent
8. Empty steps array returns a valid Blob (title + footer only)
9. Missing/empty `screenshotDataUrl` does not throw -- image is skipped

Complexity: Moderate
Dependencies: Step 1

### Step 3: Update `useExport.ts` to use PDF exporter

**Modified file:** `src/editor/hooks/useExport.ts`

Changes to `confirmExport()`:

1. **Remove imports**: `generateExportHtml` from `htmlExporter`, `validateExportHtml` from `exportValidator`
2. **Add import**: `generateExportPdf` from `pdfExporter`
3. **Replace generation** (lines 103-116): Remove `generateExportHtml()` call and
   `validateExportHtml()` validation gate. Replace with:
   ```typescript
   const blob = await generateExportPdf({ title: session.title, steps: exportSteps });
   ```
4. **Replace download** (lines 118-125): Remove HTML blob creation. Replace
   with:
   ```typescript
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = `${EXPORT_FILENAME_PREFIX}-${Date.now()}.pdf`;
   a.click();
   URL.revokeObjectURL(url);
   ```
5. **Keep everything else**: PII scanning, annotation compositing, click position
   calculation, EXPORT_COMPLETE message, error handling all remain unchanged.

The `exportSteps` array shape already matches `PdfExportStep` exactly
(stepNumber, description, screenshotDataUrl, url, clickPosition), so no data
transformation is needed.

Complexity: Simple
Dependencies: Step 2

### Step 4: Update UI text references

**Modified file:** `src/editor/App.tsx`

- Line 211: Change `'Export HTML'` to `'Export PDF'`

**Modified file:** `src/editor/components/ExportReviewDialog.tsx`

- Line 61: Change `"Exported HTML files cannot be modified."` to
  `"Exported PDF files cannot be modified."`
- Line 159: Change `"I've reviewed — Export HTML"` to
  `"I've reviewed — Export PDF"`

Complexity: Simple
Dependencies: None (can run in parallel with Steps 2-3)

### Step 5: Update test files

**Modified file:** `tests/unit/editor/useExport.test.ts`

- Replace `vi.mock('../../../src/editor/lib/htmlExporter', ...)` with
  `vi.mock('../../../src/editor/lib/pdfExporter', ...)` returning a mock
  `generateExportPdf` that resolves to `new Blob(['mock-pdf'], { type: 'application/pdf' })`
- Remove `vi.mock('../../../src/editor/lib/exportValidator', ...)`
- Remove `mockValidateExportHtml` variable and all references
- Remove the "sets error on validation failure" test (validation no longer exists)
- Update "confirmExport generates HTML and triggers download" test name and
  assertions to reference PDF
- Keep annotation compositing tests, PII scan tests, and error handling tests unchanged

**Modified file:** `tests/unit/editor/App.test.tsx`

- Line 162: Change `'Export HTML'` assertion to `'Export PDF'`

**Modified file:** `tests/unit/editor/ExportReviewDialog.test.tsx`

- No code changes needed. The existing tests check for "Review your guide" text
  and button clicks via test IDs. The "Exported HTML/PDF files" warning text is
  not asserted by any test. The confirm button text is accessed via
  `data-testid="export-confirm"`, not by text content.

Complexity: Simple
Dependencies: Steps 3-4

### Step 6: Delete HTML export files and tests

**Delete source files:**

- `src/editor/lib/htmlExporter.ts` (89 lines)
- `src/editor/lib/htmlEncode.ts` (14 lines)
- `src/editor/lib/exportValidator.ts` (75 lines)

**Delete test files:**

- `tests/unit/editor/htmlExporter.test.ts` (164 lines)
- `tests/unit/editor/htmlEncode.test.ts` (67 lines)
- `tests/unit/editor/exportValidator.test.ts` (83 lines)

**Note:** `validateDataUrl` in `canvasFlattener.ts` is currently only imported
by `htmlExporter.ts`. After deletion, it becomes an unused export. Keep it --
it is a useful utility that may be needed by `pdfExporter.ts` for input
validation, and dead exports do no harm.

Complexity: Simple
Dependencies: Steps 3-5 (all references must be removed first)

### Step 7: Full validation

- `npx vitest run` -- all tests pass
- `npx tsc --noEmit` -- no type errors
- `npx vite build` -- clean build, no warnings
- Manual check: load extension in Chrome, capture a guide, open editor, click
  "Export PDF", verify a `.pdf` file downloads and opens correctly

Complexity: Simple
Dependencies: Steps 1-6

## Dependencies

**Runtime:**

- `jspdf` (npm package) -- PDF generation library, ~280KB bundled

**Existing (unchanged):**

- `fabric` -- Fabric.js for annotation compositing (canvasFlattener.ts)
- `preact` -- UI framework

**No new dev dependencies needed.**

## Testing Strategy

**Unit tests (mocked jsPDF):**

- `pdfExporter.test.ts`: 8-10 tests verifying PDF generation logic through
  mock assertions on jsPDF method calls
- `useExport.test.ts`: Updated tests verifying the hook calls `generateExportPdf`
  instead of `generateExportHtml` + `validateExportHtml`
- `App.test.tsx`: Updated text assertion for "Export PDF" button

**Tests removed (no longer applicable):**

- `htmlExporter.test.ts` (17 tests)
- `htmlEncode.test.ts` (13 tests)
- `exportValidator.test.ts` (10 tests)

**Net test count change:** Remove ~40 HTML export tests, add ~10 PDF tests.
Total test count will decrease but coverage of active code increases (no dead
code tests).

**Manual testing checklist:**

- [ ] Extension loads in Chrome without CSP errors
- [ ] Capture a 3-step workflow guide
- [ ] Open editor, click "Export PDF"
- [ ] Review dialog shows "Export PDF" text
- [ ] PDF downloads with correct filename (`praxis-guide-{timestamp}.pdf`)
- [ ] PDF opens in preview -- title, steps, screenshots, click indicators visible
- [ ] Screenshots maintain aspect ratio and are not distorted
- [ ] Click indicators appear at correct positions
- [ ] Multi-page PDF handles page breaks correctly
- [ ] Empty screenshot gracefully handled (no crash)

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| jsPDF uses `Function()` or `eval()` internally, violating `script-src 'self'` | Low | High | Step 1 verifies CSP compatibility before any other work. Fallback: use `pdf-lib` instead. |
| Large screenshots cause jsPDF performance issues or memory pressure | Medium | Medium | Screenshots are already PNG data URLs from `canvasFlattener`. jsPDF handles base64 images natively. If needed, downscale images before embedding. |
| Bundle size increase (~280KB) | Low | Low | Acceptable for a feature library. jsPDF is tree-shakeable if using ES module import. |
| jsPDF font rendering differs across platforms | Low | Low | We use only the built-in Helvetica font (no custom fonts). Helvetica is standard in PDF. |
| Page break calculation is imprecise (step content cut off) | Medium | Low | Use conservative height estimates. Add padding buffer. Test with 5+ step guides. |

## Open Questions

1. **Should `validateDataUrl` be reused in `pdfExporter.ts`?** Currently only
   `htmlExporter.ts` uses it. The PDF exporter could use it to skip invalid
   image URLs rather than letting jsPDF throw. Recommendation: yes, import and
   use it for defensive coding.

2. **Should the PDF include page numbers?** The HTML export did not. Adding
   "Page X of Y" in the footer is trivial with jsPDF but was not specified.
   Recommendation: add it as a small polish item.

3. **Should the "Exporting..." button state change to a progress indicator?**
   PDF generation with large images may take longer than HTML string
   concatenation. The current `exporting` boolean disables the button but shows
   no progress. This is a future enhancement, not a blocker.

## File Inventory

### New files (2)

| File | Purpose |
|------|---------|
| `src/editor/lib/pdfExporter.ts` | PDF generation using jsPDF |
| `tests/unit/editor/pdfExporter.test.ts` | Unit tests for PDF exporter |

### Modified files (4)

| File | Change |
|------|--------|
| `src/editor/hooks/useExport.ts` | Replace htmlExporter/validator with pdfExporter |
| `src/editor/components/ExportReviewDialog.tsx` | "Export HTML" -> "Export PDF" text |
| `src/editor/App.tsx` | "Export HTML" -> "Export PDF" button text |
| `tests/unit/editor/useExport.test.ts` | Mock pdfExporter instead of htmlExporter/validator |
| `tests/unit/editor/App.test.tsx` | Assert "Export PDF" button text |
| `package.json` | Add `jspdf` dependency |

### Deleted files (6)

| File | Reason |
|------|--------|
| `src/editor/lib/htmlExporter.ts` | Replaced by pdfExporter |
| `src/editor/lib/htmlEncode.ts` | Only used by htmlExporter |
| `src/editor/lib/exportValidator.ts` | HTML XSS validation not needed for PDF |
| `tests/unit/editor/htmlExporter.test.ts` | Source file deleted |
| `tests/unit/editor/htmlEncode.test.ts` | Source file deleted |
| `tests/unit/editor/exportValidator.test.ts` | Source file deleted |

### Unchanged files (kept as-is)

| File | Reason |
|------|--------|
| `src/editor/lib/canvasFlattener.ts` | Still composites annotations onto screenshots |
| `src/editor/lib/sensitiveTextScanner.ts` | Still scans for PII |
| `tests/unit/editor/canvasFlattener.test.ts` | Source unchanged |
| `tests/unit/editor/sensitiveTextScanner.test.ts` | Source unchanged |
