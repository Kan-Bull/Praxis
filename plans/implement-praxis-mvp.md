# Praxis MVP (v0.1) Implementation Plan

## Objective

Build the MVP of Praxis: a privacy-first Chrome browser extension that captures user workflows as annotated step-by-step guides. The extension records clicks and form interactions, takes screenshots, generates automatic descriptions, provides a full annotation editor, and exports self-contained HTML files -- all entirely client-side with zero data leaving the browser.

## Context

Praxis fills the gap between expensive SaaS tools (Scribe, Tango) and manual screenshot documentation. It targets corporate/financial environments where privacy is non-negotiable. The full project brief lives at `docs/Praxis.md`.

This plan synthesizes findings from three specialist reviews:
- **System Architecture** -- Component communication, state machine, memory management, build strategy
- **Security Engineering** -- Permission model, CSP, data protection, injection attack surface, sensitive data handling
- **Tooling Research** -- Vite plugins, Fabric.js compatibility, testing patterns, project setup

### Key Architectural Decisions (resolved during planning)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build tooling | `vite-plugin-web-extension` (aklinker1) | Actively maintained, manifest-driven, handles IIFE for content scripts, HMR support |
| Canvas library | Fabric.js v6 (Konva.js fallback) | Must pass CSP validation in Phase 0. If Fabric.js uses `new Function()`, switch to Konva.js |
| Cross-browser polyfill | Skip for v0.1 | Chrome-only MVP; use `@types/chrome` and `chrome.*` APIs directly |
| SPA navigation detection | `chrome.webNavigation.onHistoryStateUpdated` | Avoids MAIN world injection; no security exposure from monkey-patching `history.pushState` |
| Content script injection | Programmatic only (`chrome.scripting.executeScript`) | No declarative `<all_urls>` in manifest; maintains minimal permissions |
| State machine | Pure function reducer | Simple enough that XState adds overhead without value; ~30 lines of code |
| Session transfer to editor | Lazy/chunked protocol | `chrome.runtime.sendMessage` has ~64MB limit; transfer metadata first, screenshots on demand |
| Pre-click buffer | `mousedown`-triggered (not polling) | Fires 50-150ms before `click`; eliminates continuous CPU overhead of 500ms polling |
| Shadow DOM mode | `closed` | Prevents host page JavaScript from accessing toolbar DOM |
| Service Worker keep-alive | 25-second heartbeat from content script | Chrome terminates idle SWs after 30s; heartbeat prevents session data loss |

---

## Approach

### Phased Implementation

The MVP is built in 7 phases, ordered by dependency. Each phase produces a testable, self-contained increment.

```
Phase 0: Foundation (project setup + CSP validation gate)
    |
Phase 1: Shared Layer (types, messaging, constants)
    |
Phase 2: Service Worker (state machine, screenshot capture)
    |
    +---> Phase 3: Content Script (click tracking, toolbar)
    |         |
    |         +---> Phase 4: Popup (tab selector)
    |
Phase 5: Editor (annotation canvas, description editing)
    |
Phase 6: Export + Polish (HTML export, recovery, security hardening)
```

---

## Implementation Steps

### Phase 0: Foundation + CSP Validation Gate

**Purpose:** Set up the project, validate critical assumptions (Fabric.js + CSP), establish the build pipeline.

**This phase is a GO/NO-GO gate.** If Fabric.js fails under the extension CSP, we switch to Konva.js before writing any editor code.

#### Steps:

1. **Initialize project**
   - `npm init` with `"type": "module"`
   - Install core dependencies: `preact`, `@preact/preset-vite`, `vite`, `vite-plugin-web-extension`, `typescript`, `fabric` (v6+)
   - Install dev dependencies: `vitest`, `@playwright/test`, `@types/chrome`, `eslint`, `prettier`, `jsdom`, `@testing-library/preact`
   - Configure `tsconfig.json` (strict mode, `jsxImportSource: "preact"`, `moduleResolution: "bundler"`, path aliases)
   - Configure `vite.config.ts` with `vite-plugin-web-extension` + `@preact/preset-vite`
   - Configure ESLint (flat config, TypeScript rules, `no-eval` + `no-new-func` enforced)
   - Configure Prettier
   - Configure Vitest (`jsdom` environment, Chrome API mocks in `tests/setup.ts`)

2. **Create manifest.json**
   ```json
   {
     "manifest_version": 3,
     "name": "Praxis",
     "version": "0.1.0",
     "description": "Capture, annotate, and share step-by-step workflow guides. Privacy-first, no account needed.",
     "permissions": ["activeTab", "tabs", "scripting", "storage"],
     "action": {
       "default_popup": "src/popup/index.html",
       "default_icon": { "16": "icons/icon-16.png", "32": "icons/icon-32.png" }
     },
     "icons": {
       "16": "icons/icon-16.png",
       "32": "icons/icon-32.png",
       "48": "icons/icon-48.png",
       "128": "icons/icon-128.png"
     },
     "background": {
       "service_worker": "src/background/index.ts",
       "type": "module"
     },
     "content_security_policy": {
       "extension_pages": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'"
     }
   }
   ```
   **Note:** No declarative `content_scripts` block. Content scripts are injected programmatically.

3. **Create placeholder entry points**
   - `src/background/index.ts` (minimal service worker)
   - `src/content/index.ts` (minimal content script)
   - `src/popup/index.html` + `src/popup/App.tsx` (minimal popup)
   - `src/editor/index.html` + `src/editor/App.tsx` (minimal editor page)

4. **Create placeholder icons** (simple colored squares, replaced later with real icons)

5. **Verify build pipeline**
   - Run `npm run build` -- must produce a valid `dist/` directory
   - Load unpacked extension in Chrome -- must show popup on click
   - Verify content script injection works via `chrome.scripting.executeScript`
   - Verify service worker starts without errors

6. **CSP VALIDATION GATE: Test Fabric.js under extension CSP**
   - In the editor page, initialize a Fabric.js canvas
   - Create a rectangle, text object, and perform serialization/deserialization (`toJSON` / `loadFromJSON`)
   - Load an image as background
   - Check browser console for CSP violations (`EvalError: Refused to evaluate...`)
   - **If Fabric.js passes:** Proceed with Fabric.js
   - **If Fabric.js fails:** Switch to Konva.js, update dependencies, re-test
   - Document the result as a learning in `.claude/rules/`

7. **Set up testing infrastructure**
   - Chrome API mock setup file (`tests/setup.ts`) with typed mocks for `chrome.runtime`, `chrome.tabs`, `chrome.scripting`, `chrome.storage`
   - Playwright config for extension E2E testing (headed Chromium, load unpacked)
   - Verify `npm test` and `npm run test:e2e` both run successfully (even with zero tests)

**Exit criteria:** Extension loads in Chrome, all entry points build, CSP gate passed, test infrastructure runs.

---

### Phase 1: Shared Layer

**Purpose:** Build the typed foundation that all components depend on.

#### Files:

- `src/shared/types.ts` -- All core interfaces
- `src/shared/constants.ts` -- App constants
- `src/shared/messaging.ts` -- Typed message passing helpers
- `src/shared/descriptionGenerator.ts` -- Auto-description from InteractionEvent
- `src/shared/sensitiveFieldDetector.ts` -- Detect password/CC/PII fields
- `src/shared/imageProcessor.ts` -- Screenshot resize/compress
- `src/shared/sanitize.ts` -- Input sanitization for DOM-extracted data
- `src/shared/logger.ts` -- Debug logging (gated by `__DEV__`)

#### Key design details:

**Typed messaging (discriminated union):**
```typescript
type ExtensionMessage =
  | { type: 'START_CAPTURE'; payload: { tabId: number; tabTitle: string; tabUrl: string } }
  | { type: 'STOP_CAPTURE'; payload: { sessionId: string } }
  | { type: 'INTERACTION_EVENT'; payload: { sessionId: string; event: InteractionEvent } }
  | { type: 'SCREENSHOT_READY'; payload: { stepId: string } }
  | { type: 'GET_SESSION_DATA'; payload: { sessionId: string } }
  | { type: 'GET_STEP_SCREENSHOT'; payload: { sessionId: string; stepId: string } }
  // ... (full union defined in types.ts)
```

**Sanitization (defense in depth -- applied at extraction AND rendering AND export):**
```typescript
function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '')           // Strip angle brackets
    .replace(/[\x00-\x1F]/g, '')    // Strip control characters
    .trim()
    .substring(0, 200);             // Hard length limit
}

function sanitizeHref(href: string): string | undefined {
  if (/^https?:\/\//i.test(href)) return href;
  return undefined; // Block javascript:, data:, vbscript:, blob:
}
```

**Sensitive field detection (expanded beyond brief):**
- `type="password"` inputs
- `autocomplete="cc-*"` inputs
- Name/ID pattern matching: `/passw(or)?d/i`, `/ssn/i`, `/social.?sec/i`, `/account.?num/i`, `/api.?key/i`, `/secret/i`, `/token/i`, `/routing/i`, `/cvv/i`, `/pin/i`
- CSS `text-security: disc` detection
- URL parameter redaction for sensitive query params (`token=`, `session=`, `apiKey=`, `clientId=`)

**TDD approach:** Write tests for `descriptionGenerator`, `sensitiveFieldDetector`, `sanitize`, and `imageProcessor` FIRST. These are pure functions -- ideal for unit testing.

**Exit criteria:** All shared modules have passing unit tests. Messaging types compile without errors across all entry points.

---

### Phase 2: Service Worker

**Purpose:** Build the capture session orchestrator -- the brain of the extension.

#### Files:

- `src/background/index.ts` -- Service worker entry, message router
- `src/background/captureManager.ts` -- State machine + session lifecycle
- `src/background/screenshotManager.ts` -- `captureVisibleTab`, resize, compress
- `src/background/recoveryManager.ts` -- Auto-save to `chrome.storage.local`, recovery on startup

#### State Machine:

Pure function reducer pattern:

```typescript
type SessionStatus = 'idle' | 'capturing' | 'paused' | 'editing' | 'done';

const transitions: Record<SessionStatus, Partial<Record<string, SessionStatus>>> = {
  idle:      { START_CAPTURE: 'capturing' },
  capturing: { STOP: 'editing', CANCEL: 'idle' },
  paused:    { RESUME: 'capturing', CANCEL: 'idle' },
  editing:   { EXPORT_READY: 'done', EDITOR_CLOSED: 'done' },
  done:      {},  // auto-transitions to idle with cleanup
};
```

Note: `PAUSE` is deferred to v0.2 per MVP scope. The state machine includes `paused` for forward compatibility but no UI triggers it yet.

#### Screenshot pipeline:

1. Content script sends `INTERACTION_EVENT`
2. SW sends `HIDE_TOOLBAR` to content script
3. Content script hides toolbar, sends `DOM_SETTLED` after MutationObserver settle
4. SW calls `chrome.tabs.captureVisibleTab(tabId, { format: 'jpeg', quality: 85 })`
5. SW resizes via `OffscreenCanvas` + `createImageBitmap` (max 1920px width)
6. SW sends `SHOW_TOOLBAR` to content script
7. SW stores step in `session.steps[]`

#### Session transfer to editor (lazy protocol):

1. Editor sends `GET_SESSION_DATA` -- SW responds with metadata only (no screenshots, ~5KB)
2. Editor sends `GET_STEP_THUMBNAIL(stepId)` for visible timeline items -- SW generates 320px thumbnails (~20KB each)
3. Editor sends `GET_STEP_SCREENSHOT(stepId)` when user selects a step -- SW sends full screenshot (~200KB)
4. Editor maintains LRU cache of 10 loaded screenshots

#### Service Worker keep-alive:

During `capturing` state: content script sends `HEARTBEAT` every 25 seconds to prevent Chrome from terminating the service worker.

#### Recovery manager:

- Auto-save: Debounced write to `chrome.storage.local` after each new step (during capture) and every 30s (during editing)
- Recovery data: Full metadata for all steps + screenshots for last 20 steps (fits within 10MB quota)
- On startup: Check for recovery data < 24 hours old. If found, popup shows recovery prompt
- Auto-purge: Sessions older than 24 hours are cleared on startup

**TDD approach:** Test state machine transitions exhaustively. Test screenshot manager with mocked `chrome.tabs.captureVisibleTab`. Test recovery manager serialization/deserialization.

**Exit criteria:** State machine handles all valid transitions and rejects invalid ones. Screenshot pipeline produces resized JPEGs. Recovery save/restore round-trips correctly.

---

### Phase 3: Content Script

**Purpose:** Build the user-facing capture experience -- click tracking, form tracking, floating toolbar, visual feedback.

#### Files:

- `src/content/index.ts` -- Entry point, initializes trackers on message from SW
- `src/content/clickTracker.ts` -- Click event interception, element info extraction
- `src/content/formTracker.ts` -- Input/change events on form elements
- `src/content/navigationTracker.ts` -- Listens for `chrome.webNavigation` events (via SW relay)
- `src/content/highlighter.ts` -- Visual flash on clicked elements
- `src/content/preClickBuffer.ts` -- Mousedown screenshot capture
- `src/content/screenshotTiming.ts` -- MutationObserver settle logic
- `src/content/toolbar.ts` -- Floating toolbar (Shadow DOM, closed mode)

#### Click tracking:

- Listen on `document` in capture phase: `document.addEventListener('click', handler, { capture: true })`
- Extract `ElementInfo`: tagName, text (sanitized, truncated 50 chars), ariaLabel, placeholder, id, className, role, href (sanitized), boundingRect, xpath, isInIframe
- Check `sensitiveFieldDetector` for value masking
- Send `INTERACTION_EVENT` to SW

#### Form tracking:

- `input` events on text fields: "Typed in field '[label/placeholder]'" (value masked if sensitive)
- `change` events on selects: "Selected '[option text]' from '[label]'"
- `change` events on checkboxes/radios: "Checked/Unchecked '[label]'"
- `keydown` for Enter/Tab: "Pressed Enter to submit form"
- Debounce `input` events (500ms) to avoid capturing every keystroke as a separate step

#### SPA navigation detection:

- Service Worker listens to `chrome.webNavigation.onHistoryStateUpdated` for the captured tab
- When detected, SW sends `NAVIGATION_DETECTED` to content script
- Content script generates a "Navigated to [url]" step
- **No MAIN world injection needed** -- this is handled entirely by the browser's webNavigation API

#### Floating toolbar (Shadow DOM):

```
+------------------------------------------+
|  Praxis  |  Step 5  |  Stop  |  Cancel  |
+------------------------------------------+
```

- Custom element: `<praxis-toolbar>`
- Shadow DOM: `mode: 'closed'`, `adoptedStyleSheets` for styling
- `position: fixed`, `z-index: 2147483647`, draggable
- Toolbar click events call `e.stopPropagation()` to prevent capture
- Hidden before screenshots (`display: none`), shown after
- Preact renders into the shadow root (Preact attaches events directly to elements, works in Shadow DOM)

#### Pre-click buffer:

- `mousedown` event triggers `PRE_CLICK_BUFFER` message to SW
- SW captures screenshot immediately
- Only 1 buffer image stored (overwritten on each mousedown, ~200KB)
- When `INTERACTION_EVENT` arrives within 500ms of buffer, SW pairs them

#### Highlight overlay:

- On click: create a positioned `<div>` overlay matching the clicked element's `boundingRect`
- CSS animation: brief red/orange flash (300ms), then fade out
- Overlay uses `pointer-events: none` to avoid interfering with page
- Also rendered inside Shadow DOM to prevent style conflicts

#### Iframe support (same-origin only):

- Content script injected with `allFrames: true` via `chrome.scripting.executeScript`
- Iframe content scripts detect clicks and send events with `isInIframe: true` + iframe offset
- Cross-origin iframes: log warning, screenshot still captures visual content, description notes "Action inside embedded content (details unavailable)"

**TDD approach:** Test element info extraction with JSDOM. Test description generation for all interaction types. Test sensitive field detection. Test sanitization of malicious element text.

**Exit criteria:** Clicks produce correct InteractionEvents. Form interactions generate appropriate descriptions. Toolbar renders in Shadow DOM without affecting host page. Highlight flashes on click.

---

### Phase 4: Popup

**Purpose:** Tab selector UI that starts capture on the selected tab.

#### Files:

- `src/popup/index.html`
- `src/popup/App.tsx` -- Root component
- `src/popup/components/TabList.tsx` -- Tab listing
- `src/popup/components/RecoveryBanner.tsx` -- Session recovery prompt
- `src/popup/components/PurgeButton.tsx` -- Manual data purge

#### Behavior:

1. On open: Query `chrome.tabs.query({ currentWindow: true })` to list tabs
2. Display tab title + favicon for each tab
3. Filter out non-capturable tabs (`chrome://`, `about:`, `edge://`, Chrome Web Store)
4. On tab select: Send `START_CAPTURE` to SW with `tabId`, `tabTitle`, `tabUrl`
5. Close popup (capture begins in the selected tab)

#### Recovery UI:

- On open: Send `RECOVERY_CHECK` to SW
- If recovery data exists: Show banner "A previous session was found. Recover or discard?"
- Recover: SW transitions to `editing`, opens editor
- Discard: SW clears `chrome.storage.local`

#### Manual purge:

- "Delete all data" button always visible
- Clears `chrome.storage.local` and any in-memory session
- Confirmation dialog before purge

**TDD approach:** Test tab filtering logic. Test message sending on tab select.

**Exit criteria:** Popup shows tabs, selecting a tab injects content script and starts capture, recovery prompt works.

---

### Phase 5: Editor

**Purpose:** Full annotation editor in a new tab with Fabric.js canvas, timeline sidebar, description editing.

#### Files:

- `src/editor/index.html`
- `src/editor/App.tsx` -- Root layout
- `src/editor/components/Timeline.tsx` -- Step list sidebar with thumbnails
- `src/editor/components/StepCard.tsx` -- Individual step in timeline
- `src/editor/components/AnnotationCanvas.tsx` -- Fabric.js canvas wrapper
- `src/editor/components/ToolBar.tsx` -- Annotation tool palette
- `src/editor/components/DescriptionEditor.tsx` -- Text editor per step
- `src/editor/components/ExportPanel.tsx` -- Export options
- `src/editor/components/SensitiveDataBanner.tsx` -- Persistent reminder about screenshots
- `src/editor/hooks/useSession.ts` -- Session data management (lazy loading)
- `src/editor/hooks/useAnnotation.ts` -- Fabric.js state management
- `src/editor/hooks/useExport.ts` -- HTML export logic

#### Layout:

```
+-----------------------------------------------------------+
|  Praxis Editor              [Export HTML]                  |
+----------+------------------------------------------------+
| Timeline |            Canvas Area                          |
|          |                                                 |
| [Step 1] | +-------------------------------------------+   |
|  thumb   | |                                           |   |
|          | |    Screenshot + Annotations               |   |
| [Step 2] | |    (Fabric.js canvas)                     |   |
|  thumb   | |                                           |   |
|          | +-------------------------------------------+   |
| [Step 3] |                                                 |
|  thumb   | +-------------------------------------------+   |
|          | | Description: (editable textarea)          |   |
|  ...     | | "Clicked button 'Save Draft'"             |   |
|          | +-------------------------------------------+   |
|          |                                                 |
|          | Tool Palette:                                    |
|          | [Select] [Rect] [Text] [Blur] [Delete]          |
|          | Color: [red] [blue] [green] [black]             |
+----------+-------------------------------------------------+
```

#### Annotation tools (MVP subset):

| Tool | Implementation |
|------|---------------|
| Select | Default Fabric.js selection mode |
| Rectangle | `fabric.Rect` with configurable stroke color |
| Text | `fabric.IText` with editable content |
| Blur | **Destructive pixel modification** -- averages pixel blocks on the base image, NOT a canvas overlay. Non-undoable. Confirmation dialog before applying. |
| Step Badge | `fabric.Group` (Circle + Text), auto-positioned from `boundingRect` |
| Delete | `canvas.remove(canvas.getActiveObject())` |

#### Blur tool (security-critical):

1. User draws a rectangle selection over the area to blur
2. Confirmation dialog: "Blur permanently removes pixel data in this area. This cannot be undone."
3. On confirm:
   - Read pixel data from the **base screenshot image** in the selected region
   - Apply pixel block averaging (minimum block size: 10px)
   - Write averaged pixels back to the base image
   - Update `step.screenshotAfter` with the modified image
   - Remove the selection rectangle (it was just a UI affordance)
4. This operation is NOT added to the undo stack

#### Lazy loading protocol:

```
Editor mount:
  1. GET_SESSION_DATA -> metadata only (~5KB)
  2. Render timeline with placeholder thumbnails
  3. GET_STEP_THUMBNAIL for visible steps (~20KB each)
  4. On step select: GET_STEP_SCREENSHOT (~200KB)
  5. Load into Fabric.js canvas + apply saved annotations
  6. LRU cache of 10 recently loaded screenshots
```

#### `beforeunload` guard:

Register `beforeunload` handler when editor has unsaved changes. Browser shows native "Leave page?" dialog.

#### Persistent sensitive data banner:

Display above the canvas: "Screenshots may contain sensitive data visible on the page. Use the Blur tool to redact before exporting."

**TDD approach:** Test annotation canvas imperative handle (toJSON/loadFromJSON round-trip). Test blur tool pixel modification (verify original pixel data is destroyed). Test lazy loading protocol. Test description editing.

**Exit criteria:** Editor loads session, displays timeline, allows annotation with rect/text/blur, descriptions are editable, `beforeunload` prevents accidental closure.

---

### Phase 6: Export + Polish

**Purpose:** HTML export, security hardening, recovery finalization, pre-export review.

#### HTML Export:

Generate a single, self-contained HTML file:
- All images embedded as base64 data URIs
- All CSS inlined
- No JavaScript whatsoever
- Meta CSP tag to prevent XSS even if payloads slip through:
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
  ```
- All text content HTML-entity-encoded (descriptions, title, metadata)
- All `<img src>` attributes validated: must match `data:image/(jpeg|png);base64,`
- Responsive, print-friendly layout
- Step numbers, annotated screenshots (flattened from Fabric.js canvas to PNG), descriptions

#### Pre-export review:

Before export, show a review panel:
- List all step descriptions
- Flag descriptions containing detected sensitive patterns (email, SSN-like, CC-like, currency with names)
- Prominent warning: "Review your guide for sensitive data before sharing"
- User must acknowledge before export proceeds

#### Export flow:

1. For each step: flatten Fabric.js canvas to PNG data URL (`canvas.toDataURL('image/png')`)
2. Generate HTML from template with entity-encoded descriptions + flattened images
3. Trigger download via `<a download="praxis-guide.html">`
4. Send `EXPORT_READY` to SW to clean up session data

#### Security hardening checklist (verified in this phase):

- [ ] No `<script>` tags in export output
- [ ] Meta CSP in exported HTML
- [ ] All text HTML-entity-encoded
- [ ] All image `src` validated as `data:image/`
- [ ] No `on*` event handler attributes in export
- [ ] No `javascript:` URIs in export
- [ ] `connect-src 'none'` in manifest CSP
- [ ] Blur tool destroys pixels (non-recoverable)
- [ ] Sensitive field detector covers password, CC, SSN, account numbers, tokens
- [ ] Shadow DOM mode is `closed`
- [ ] No `dangerouslySetInnerHTML` anywhere in editor
- [ ] `chrome.storage.local` auto-purge on export and after 24h

**TDD approach:** Test HTML export output against XSS payloads (script tags, onerror handlers, javascript: URIs, template injection). Test entity encoding. Test image src validation. Test sensitive pattern detection in descriptions.

**Exit criteria:** Export produces valid self-contained HTML. XSS payloads in descriptions do not execute when exported HTML is opened. Pre-export review flags detected sensitive data. All security controls pass.

---

## Dependencies

### External Dependencies

| Package | Version | Purpose | Risk |
|---------|---------|---------|------|
| `preact` | ^10.25.0 | UI framework | Low -- stable, widely used |
| `@preact/preset-vite` | ^2.9.0 | Vite integration for Preact | Low |
| `vite` | ^6.0.0 | Build tool | Low |
| `vite-plugin-web-extension` | ^4.2.0 | Extension build orchestration | Medium -- evaluate during Phase 0 |
| `fabric` | ^6.5.0 | Canvas annotations | **High -- CSP compatibility must be validated** |
| `typescript` | ^5.6.0 | Language | Low |
| `@types/chrome` | ^0.0.268 | Chrome API types | Low |
| `vitest` | ^2.1.0 | Unit testing | Low |
| `@playwright/test` | ^1.49.0 | E2E testing | Low |
| `eslint` | ^9.15.0 | Linting | Low |
| `prettier` | ^3.4.0 | Formatting | Low |

### Phase Dependencies

```
Phase 0 ──> Phase 1 ──> Phase 2 ──┐
                                    ├──> Phase 5 ──> Phase 6
                          Phase 3 ──┤
                                    │
                          Phase 4 ──┘
```

- Phase 1 depends on Phase 0 (project must build)
- Phases 2, 3, 4 depend on Phase 1 (shared types/messaging)
- Phases 3 and 4 depend on Phase 2 (SW must handle messages)
- Phase 3 and 4 can be developed in parallel after Phase 2
- Phase 5 depends on Phases 2, 3, 4 (needs full capture pipeline for real data)
- Phase 6 depends on Phase 5 (export needs editor)

---

## Testing Strategy

### Unit Tests (Vitest)

| Module | Test Focus | Priority |
|--------|-----------|----------|
| `descriptionGenerator` | All interaction types produce correct descriptions | P0 |
| `sensitiveFieldDetector` | Detects password, CC, SSN, account, token fields; no false positives | P0 |
| `sanitize` | Strips XSS payloads, control chars; validates HREFs; truncates | P0 |
| `captureManager` (state machine) | All valid transitions succeed; invalid transitions rejected | P0 |
| `screenshotManager` | Resize produces correct dimensions; JPEG output | P1 |
| `recoveryManager` | Save/restore round-trips; expired sessions purged | P1 |
| `imageProcessor` | Resize, compress, thumbnail generation | P1 |
| `useExport` (HTML export) | No `<script>` tags, meta CSP present, all text encoded, image src validated | P0 |
| `destructive blur` | Pixel data in blurred region is uniformly averaged; original irrecoverable | P0 |

### Security Tests (Vitest)

| Test | What It Validates |
|------|------------------|
| XSS in export | Inject `<script>`, `<img onerror>`, `<svg onload>`, `javascript:` href, template injection in descriptions; verify none execute in exported HTML |
| Sensitive data masking | Password field values show `[REDACTED]`; SSN-like patterns flagged |
| Blur persistence | After blur, extract base64 image, decode, verify pixel data destroyed |
| CSP enforcement | `eval()` and `new Function()` throw errors in extension context |
| Export sanitization | All text content HTML-entity-encoded; no `on*` attributes; all `src` start with `data:image/` |

### E2E Tests (Playwright)

| Test | What It Validates |
|------|------------------|
| Full capture flow | Click extension icon -> select tab -> click elements -> stop -> editor opens with steps |
| Popup tab list | Popup shows current window tabs; chrome:// tabs filtered |
| Editor annotation | Load step, draw rectangle, add text, save, switch steps, come back, annotations preserved |
| HTML export | Export, open in Playwright, verify renders correctly, no JS execution |
| Recovery flow | Start capture, kill service worker, reopen popup, recover session |

### Chrome API Mocks

Located in `tests/setup.ts`. Mocks for `chrome.runtime`, `chrome.tabs`, `chrome.scripting`, `chrome.storage.local`, `chrome.webNavigation`. Each mock returns reasonable defaults and is overridable per test via `vi.mocked()`.

---

## Risks and Mitigations

| # | Risk | Severity | Likelihood | Mitigation |
|---|------|----------|------------|------------|
| R1 | Fabric.js incompatible with `script-src 'self'` CSP | HIGH | MEDIUM | Phase 0 gate: test before committing. Konva.js fallback. If neither works, relax CSP to `'unsafe-eval'` for extension pages only (acceptable -- fully controlled environment). |
| R2 | Service Worker terminated during capture (30s idle) | HIGH | HIGH | 25-second heartbeat from content script. Auto-save to `chrome.storage.local` after each step. Recovery on restart. |
| R3 | Message size limit for session transfer to editor | HIGH | HIGH | Lazy/chunked protocol: metadata first, screenshots on demand per step. |
| R4 | XSS in HTML export via malicious page element text | CRITICAL | MEDIUM | Triple defense: sanitize at extraction + HTML-entity-encode at export + meta CSP in export file. |
| R5 | `chrome.storage.local` quota exhaustion (10MB) | MEDIUM | MEDIUM | Store metadata for all steps but screenshots for only last 20. Monitor usage via `getBytesInUse()`. |
| R6 | `vite-plugin-web-extension` doesn't handle IIFE content scripts | MEDIUM | LOW | Test during Phase 0. Fallback: custom build script (~80 lines). |
| R7 | Content script overhead on heavy enterprise pages | MEDIUM | LOW | Performance budget: < 5ms per frame. All listeners passive where possible. No continuous MutationObserver (only during screenshot settle). |
| R8 | `captureVisibleTab` fails on DRM-protected content | LOW | LOW | Catch error, show placeholder, log warning in description. |

---

## Open Questions

1. **Guide title editing:** The brief defers guide title editing to v0.2, but the export uses a title. For MVP, auto-generate from tab title + date? Or prompt on export?
   - **Recommendation:** Auto-generate as "[Tab Title] - Guide" for MVP. Add editing in v0.2.

2. **Toolbar position persistence:** Should the toolbar remember its dragged position across page navigations within the same capture session?
   - **Recommendation:** Reset to default position (top-right) on each navigation. Simpler, avoids position conflicts.

3. **Step limit UX:** When hitting the 100-step hard cap, auto-transition to editing (architect recommendation) or show a blocking dialog?
   - **Recommendation:** Auto-transition with a toast notification: "Maximum 100 steps reached. Opening editor."

4. **`chrome.storage.local` encryption:** The security review recommends encrypting auto-save data with an ephemeral AES-GCM key. This adds complexity and means recovery is impossible after SW restart (key is lost). Is the trade-off worth it?
   - **Recommendation:** Defer encryption to v0.2. For MVP, accept the risk that `chrome.storage.local` is plaintext on disk. The data auto-purges after 24 hours and on export. Add encryption when the recovery mechanism is proven stable.

5. **Konva.js evaluation depth:** If Fabric.js fails CSP, how deeply should we evaluate Konva.js before committing? It has a different API surface.
   - **Recommendation:** If CSP gate fails, spend Phase 0 evaluating Konva.js with a proof-of-concept (draw shapes, serialize/deserialize, load image background). The `react-konva` wrapper works with Preact via `preact/compat`.
