# Editor Dark Theme Redesign

**Status**: Draft

## Objective

Restyle the Praxis Editor UI from its current light theme to match the popup's dark glassmorphic design system, creating a unified visual identity across the entire extension.

**Success criteria:**

- All 9 editor files use the dark slate/glassmorphic palette
- The popup and editor feel like they belong to the same product
- All 379 existing tests continue to pass without modification
- All `data-testid` attributes are preserved
- All functional behavior remains identical
- Screenshots on the canvas remain clearly visible against the dark background
- The sensitive data banner remains visually prominent (attention-grabbing)
- WCAG AA contrast ratios are maintained for all text

## Context

The Praxis popup (`src/popup/App.tsx`, `src/popup/TabList.tsx`) uses a polished dark glassmorphic design with dark slate backgrounds, semi-transparent cards, blue glow hover states, and light-on-dark typography. The editor currently uses a traditional light theme (white cards, light gray backgrounds, dark text on white). This visual disconnect makes the product feel like two separate tools.

All editor styles are inline JSX style objects -- there are no CSS files to update. The changes are purely cosmetic: swapping color values, backgrounds, borders, and shadows. No structural, layout, or behavioral changes are required.

**Key reference files (the "target" design):**

- `/Users/titus/Documents/GitHub Repos/Praxis/src/popup/App.tsx` -- header, labels, empty state
- `/Users/titus/Documents/GitHub Repos/Praxis/src/popup/TabList.tsx` -- glassmorphic card pattern, hover/active states

## Approach

Define a consistent set of dark theme design tokens derived from the popup, then apply them systematically across every editor component. Work file-by-file in dependency order (leaf components first, then containers).

**Design Token Reference (derived from popup):**

| Token | Value | Usage |
|-------|-------|-------|
| `bg-page` | `linear-gradient(135deg, #0f172a 0%, #1e293b 100%)` | Page/body background |
| `bg-panel` | `rgba(255, 255, 255, 0.04)` | Sidebar, bottom toolbar, card surfaces |
| `bg-card` | `rgba(255, 255, 255, 0.04)` | Step cards, tool palette, dialog cards |
| `bg-card-hover` | `rgba(59, 130, 246, 0.12)` | Hovered interactive cards |
| `bg-card-selected` | `rgba(59, 130, 246, 0.15)` | Selected step cards |
| `bg-card-active` | `rgba(59, 130, 246, 0.2)` | Mousedown/pressed state |
| `bg-input` | `rgba(255, 255, 255, 0.06)` | Textarea, input fields |
| `border-default` | `#1e293b` | Panel borders, card borders |
| `border-selected` | `#3b82f6` | Selected state borders |
| `border-hover` | `#3b82f6` | Hovered state borders |
| `border-input` | `#334155` | Input/textarea borders |
| `text-title` | `#f8fafc` | Headings, primary labels |
| `text-body` | `#e2e8f0` | Body text, descriptions |
| `text-secondary` | `#94a3b8` | Secondary text, char counts |
| `text-tertiary` | `#64748b` | Labels, placeholders |
| `text-link` | `#60a5fa` | Links |
| `accent-blue` | `#3b82f6` | Primary buttons, active tools |
| `accent-gradient` | `#3b82f6 -> #8b5cf6` | Logo/branding badge |
| `shadow-glow` | `0 2px 8px rgba(59, 130, 246, 0.15)` | Hover glow |
| `shadow-dialog` | `0 4px 24px rgba(0, 0, 0, 0.4)` | Modal dialogs |
| `radius-card` | `10px` | Card corners (matching popup) |
| `radius-button` | `6px` | Button corners |
| `radius-input` | `6px` | Input corners |
| `transition` | `all 0.15s ease` | State transitions |

**Dark theme adaptations for special elements:**

| Element | Current (light) | New (dark) |
|---------|-----------------|------------|
| Sensitive banner | Yellow `#fef3c7` bg, `#92400e` text | Amber-dark: `rgba(251, 191, 36, 0.1)` bg, `#fbbf24` border, `#fcd34d` text |
| Error toast | Red `#fef2f2` bg, `#b91c1c` text | Dark red: `rgba(239, 68, 68, 0.15)` bg, `#f87171` border, `#fca5a5` text |
| Sensitive badge | Red `#fef2f2` bg, `#b91c1c` text | Dark red: `rgba(239, 68, 68, 0.12)` bg, `#f87171` border, `#fca5a5` text |
| Delete button | Light red `#fee2e2` bg, `#dc2626` text | Dark red: `rgba(239, 68, 68, 0.15)` bg, `#f87171` border, `#fca5a5` text |
| Step number badge | Red `#ef4444` circle | Blue-purple gradient (matches branding): `linear-gradient(135deg, #3b82f6, #8b5cf6)` |
| Warning banner (export) | Yellow `#fef3c7` bg | Same amber-dark as sensitive banner |
| Canvas container | Light `#f1f5f9` bg | Keep slightly lighter than surrounds: `rgba(255, 255, 255, 0.02)` -- screenshots must remain legible |
| Blur confirm dialog | White card | Dark glassmorphic card (same as export dialog) |
| Export dialog card | White `#ffffff` | Dark `#1e293b` with subtle border |

## Implementation Steps

### Step 1: `src/editor/index.html` -- Page Background

Update the `<style>` block in the HTML file.

**Changes:**
- `background-color: #f1f5f9` changes to `background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); min-height: 100vh;`
- Add `color: #e2e8f0` as base text color

**Complexity:** Simple
**Dependencies:** None (standalone, no imports)

---

### Step 2: `src/editor/components/StepCard.tsx` -- Step Cards

Restyle individual step card buttons for dark theme.

**Changes:**
- Default card: `backgroundColor: '#ffffff'` -> `rgba(255, 255, 255, 0.04)`, border `#e2e8f0` -> `#1e293b`
- Selected card: `backgroundColor: '#eff6ff'` -> `rgba(59, 130, 246, 0.15)`, border stays `#3b82f6`
- Shadow: light shadow -> subtle dark shadow or glow
- Step number badge: red `#ef4444` -> blue-purple gradient `linear-gradient(135deg, #3b82f6, #8b5cf6)`
- Description text: `#334155` -> `#e2e8f0`
- Thumbnail border: `#e2e8f0` -> `#334155`
- Border radius: `8px` -> `10px` (match popup cards)
- Add hover interaction (onMouseEnter/onMouseLeave) for blue glow effect matching popup TabList

**Complexity:** Moderate
**Dependencies:** None (leaf component)

---

### Step 3: `src/editor/components/Timeline.tsx` -- Timeline Sidebar

Restyle the timeline header and container.

**Changes:**
- Header label border: `#e2e8f0` -> `#1e293b`
- Header label color: already `#64748b` (stays the same)
- Empty timeline text color: already `#94a3b8` (stays the same)

**Complexity:** Simple
**Dependencies:** None

---

### Step 4: `src/editor/components/ToolPalette.tsx` -- Tool Buttons

Restyle the tool palette container and all buttons.

**Changes:**
- Container: `backgroundColor: '#ffffff'` -> `rgba(255, 255, 255, 0.04)`, border `#e2e8f0` -> `#1e293b`, shadow adjusted
- `buttonBase`: border `#cbd5e1` -> `#334155`, add `transition: 'all 0.15s ease'`
- Inactive tool buttons: `backgroundColor: '#ffffff'` -> `transparent`, color `#334155` -> `#e2e8f0`
- Active tool button: stays `#3b82f6` bg with `#ffffff` text (already correct)
- Delete button: `backgroundColor: '#fee2e2'` -> `rgba(239, 68, 68, 0.15)`, color `#dc2626` -> `#fca5a5`, border `#fca5a5` -> `#f87171`
- Divider: `backgroundColor: '#e2e8f0'` -> `#334155`
- Color swatch borders: inactive `#e2e8f0` -> `#334155`, active `#1e293b` -> `#f8fafc` (light ring on dark bg for visibility)

**Complexity:** Moderate
**Dependencies:** None (leaf component)

---

### Step 5: `src/editor/components/DescriptionEditor.tsx` -- Text Area

Restyle the label, textarea, and character count.

**Changes:**
- Label color: already `#64748b` (fine, stays)
- Textarea: border `#cbd5e1` -> `#334155`, `backgroundColor` -> `rgba(255, 255, 255, 0.06)`, `color` -> `#e2e8f0`
- Char count color: already `#94a3b8` (stays)

**Complexity:** Simple
**Dependencies:** None (leaf component)

---

### Step 6: `src/editor/components/SensitiveDataBanner.tsx` -- Warning Banner

Adapt the yellow warning banner to a dark amber variant that remains attention-grabbing.

**Changes:**
- `backgroundColor: '#fef3c7'` -> `rgba(251, 191, 36, 0.1)`
- `borderBottom: '1px solid #f59e0b'` -> `1px solid rgba(251, 191, 36, 0.3)`
- `color: '#92400e'` -> `#fcd34d`
- The banner should still feel like a warning -- amber on dark achieves this

**Complexity:** Simple
**Dependencies:** None (leaf component)

---

### Step 7: `src/editor/components/AnnotationCanvas.tsx` -- Blur Confirm Dialog

Restyle the blur confirmation dialog overlay.

**Changes:**
- Dialog card: `backgroundColor: '#ffffff'` -> `#1e293b`, border `#e2e8f0` -> `#334155`
- Shadow: `rgba(0,0,0,0.15)` -> `rgba(0,0,0,0.4)` (stronger on dark bg)
- Warning text: `color: '#334155'` -> `#e2e8f0`
- Cancel button: `backgroundColor: '#ffffff'` -> `transparent`, border `#cbd5e1` -> `#334155`, add `color: '#e2e8f0'`
- Blur Region (confirm) button: stays red `#ef4444` bg, `#ffffff` text (destructive action -- keep prominent)

**Complexity:** Simple
**Dependencies:** None

---

### Step 8: `src/editor/components/ExportReviewDialog.tsx` -- Export Modal

Restyle the export review modal and all its sub-elements.

**Changes:**
- Overlay backdrop: `rgba(0,0,0,0.5)` -> `rgba(0,0,0,0.6)` (slightly darker for dark theme)
- Modal card: `backgroundColor: '#ffffff'` -> `#1e293b`, shadow `rgba(0,0,0,0.15)` -> `rgba(0,0,0,0.4)`
- Warning banner (top): same amber-dark treatment as SensitiveDataBanner -- `rgba(251, 191, 36, 0.1)` bg, `rgba(251, 191, 36, 0.3)` border, `#fcd34d` text
- Step list items: border `#e2e8f0` -> `#334155`, step number label color -> `#f8fafc`, description `#475569` -> `#94a3b8`
- Sensitive badges: `backgroundColor: '#fef2f2'` -> `rgba(239, 68, 68, 0.12)`, border `#fca5a5` -> `#f87171`, color `#b91c1c` -> `#fca5a5`
- Action bar: borderTop `#e2e8f0` -> `#334155`
- Cancel button: `backgroundColor: '#ffffff'` -> `transparent`, border `#cbd5e1` -> `#334155`, add `color: '#e2e8f0'`
- Confirm button: stays `#3b82f6` bg (already correct), ensure `color: '#ffffff'`

**Complexity:** Moderate
**Dependencies:** None

---

### Step 9: `src/editor/App.tsx` -- Main Layout Shell

Restyle the header, sidebar, main content area, bottom toolbar, loading/error/empty states, and error toast.

**Changes:**

**Header:**
- `backgroundColor: '#ffffff'` -> `rgba(255, 255, 255, 0.04)`
- `borderBottom: '1px solid #e2e8f0'` -> `1px solid #1e293b`
- `boxShadow` -> remove or use `0 1px 0 rgba(255,255,255,0.04)`
- Title: `color: '#1e293b'` -> `#f8fafc`
- Export button: already blue (`#3b82f6`), keep as-is; shadow can become `rgba(59,130,246,0.25)`
- Consider adding the Praxis logo badge (blue-purple gradient "P" square) to match popup header

**Sidebar:**
- `backgroundColor: '#f8fafc'` -> `rgba(255, 255, 255, 0.02)`
- `borderRight: '1px solid #e2e8f0'` -> `1px solid #1e293b`

**Main content area:**
- `backgroundColor: '#f1f5f9'` -> `transparent` (the body gradient shows through)

**Bottom toolbar area:**
- `backgroundColor: '#f8fafc'` -> `rgba(255, 255, 255, 0.04)`
- `borderTop: '1px solid #e2e8f0'` -> `1px solid #1e293b`

**Loading/screenshot-loading states:**
- `color: '#94a3b8'` -- already correct for dark theme

**Error state:**
- `color: '#ef4444'` -> `#f87171` (slightly lighter red for dark bg)

**Empty state:**
- `color: '#94a3b8'` -- already correct

**Export error toast:**
- `backgroundColor: '#fef2f2'` -> `rgba(239, 68, 68, 0.15)`
- `border: '1px solid #fca5a5'` -> `1px solid #f87171`
- `color: '#b91c1c'` -> `#fca5a5`

**Complexity:** Moderate
**Dependencies:** Should be done after Steps 2-8 so all child components are already restyled

## Dependencies

- No new libraries or packages required
- No database changes
- No configuration changes
- No build system changes
- All changes are inline style value swaps in existing files

## Testing Strategy

**Automated tests (existing -- must all pass):**
- 18 editor test files with functional assertions
- Tests check `data-testid` presence, text content, click handlers, and callback invocations
- Tests do NOT assert specific color values (verified by reading test files)
- One exception: `StepCard.test.tsx` line 58 checks `card.style.borderColor || card.style.border` is truthy -- this will still pass since we are setting border values

**Manual verification checklist:**
- [ ] Build succeeds: `npx vite build`
- [ ] All tests pass: `npx vitest run`
- [ ] Load extension in Chrome via Load Unpacked
- [ ] Open editor page -- dark gradient background visible
- [ ] Sidebar renders with dark panel, step cards are glassmorphic
- [ ] Hovering step cards shows blue glow (if hover was added)
- [ ] Selected step card shows blue highlight
- [ ] Tool palette has dark background with visible tool buttons
- [ ] Active tool shows blue highlight
- [ ] Delete button is visible with dark-red styling
- [ ] Color swatches are visible with appropriate borders
- [ ] Description textarea is dark with light text
- [ ] Sensitive data banner shows amber-on-dark warning
- [ ] Blur confirm dialog has dark card styling
- [ ] Export review dialog has dark card with amber warning
- [ ] Sensitive badges are visible in export dialog
- [ ] Screenshots on canvas remain clearly visible
- [ ] All text maintains readable contrast against dark backgrounds
- [ ] Error toast is visible against dark background

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Screenshots hard to see on dark bg | Medium | High | Canvas wrapper stays slightly lighter (`rgba(255,255,255,0.02)`); screenshots have their own light backgrounds naturally |
| Sensitive banner not attention-grabbing enough | Low | Medium | Amber-on-dark is still high-visibility; test visually and adjust opacity if needed |
| Fabric.js canvas objects (text, rects) hard to see | Low | Medium | Annotation objects use bright colors (`ANNOTATION_COLORS`) which contrast well on any background |
| Test assertion breaks | Low | High | Tests check functionality not colors; verified by reading all 18 test files |
| Color swatch active ring invisible on dark bg | Medium | Low | Switch active swatch border from dark `#1e293b` to light `#f8fafc` for contrast |
| `StepCard.test.tsx` border assertion fails | Low | Medium | Test checks `borderColor || border` is truthy -- both dark theme values are truthy strings |
| Textarea placeholder text invisible | Low | Low | Set explicit placeholder color via style or ensure browser default works on dark bg |

## Open Questions

1. **Header logo badge:** Should we add the blue-purple gradient "P" badge to the editor header to match the popup header? This would be a very minor structural addition (one `<div>`) but would significantly unify the branding. Recommend: Yes.

2. **Step number badge color:** The current red `#ef4444` badges clash with the blue-purple design system. Switching to the accent gradient (`#3b82f6 -> #8b5cf6`) would be more cohesive. Recommend: Yes, switch to gradient.

3. **Hover effects on step cards:** The popup's TabList has mouse enter/leave/down/up handlers for the blue glow micro-interaction. Should step cards get the same treatment? Recommend: Yes, it's 12 lines of code and significantly elevates the feel.

4. **Scrollbar styling:** Dark theme often looks better with custom scrollbar colors. This would require adding a `<style>` block to `index.html` with `::-webkit-scrollbar` rules. Should we include this? Recommend: Optional, low priority.
