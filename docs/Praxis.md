# Praxis — Project Brief

## Overview

**Praxis** is a privacy-first, open-source browser extension that captures user workflows as annotated step-by-step guides. It records clicks, takes screenshots, generates automatic descriptions, and provides a full annotation editor — all entirely client-side with zero data leaving the browser.

Think Scribe/Tango, but free, open-source, and with no accounts, no servers, no tracking.

## Core Principles

- **Zero persistence by default** — Nothing is stored beyond the active session unless the user explicitly exports
- **No account / No registration** — The extension works immediately after install
- **No backend / No server** — Everything runs client-side in the browser
- **No external network requests** — All assets are bundled; no CDN, no analytics, no telemetry
- **Privacy-first** — Blur tool destructively removes pixel data (not just an overlay)
- **Open source** — MIT license

---

## Target Platforms

- **Chrome** (Manifest V3)
- **Firefox** (Manifest V3 with `browser_specific_settings`)
- Use `webextension-polyfill` (Mozilla) to abstract cross-browser API differences

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | **TypeScript** (strict mode) | Type safety for complex state management |
| UI Framework | **Preact** | Lightweight (~3KB), React-compatible, ideal for extensions |
| Build Tool | **Vite** | Fast builds, multi-entry support for extension architecture |
| Annotation Canvas | **Fabric.js** | Mature canvas library with built-in object manipulation, serialization, and undo support |
| PDF Export | **jsPDF** + **html2canvas** | Client-side PDF generation |
| Cross-browser | **webextension-polyfill** | Unified API across Chrome and Firefox |
| Testing | **Vitest** (unit) + **Playwright** (E2E) | Fast unit tests + real browser E2E |
| Linting | **ESLint** + **Prettier** | Standard code quality |

---

## Architecture

### Extension Components

```
praxis/
├── src/
│   ├── background/          # Service Worker (MV3)
│   │   ├── index.ts         # Main service worker entry
│   │   ├── captureManager.ts # Orchestrates capture sessions + state machine
│   │   └── screenshotManager.ts # Capture, resize, compress screenshots
│   │
│   ├── content/             # Content Script (injected into target tab)
│   │   ├── index.ts         # Entry point, event listeners
│   │   ├── clickTracker.ts  # Intercepts clicks, extracts element info
│   │   ├── formTracker.ts   # Tracks input/change events on form elements
│   │   ├── navigationTracker.ts # Detects SPA navigation (pushState, popstate)
│   │   ├── highlighter.ts   # Visual overlay on clicked elements
│   │   ├── preClickBuffer.ts # Rolling screenshot buffer (mousedown capture)
│   │   └── toolbar.ts       # Floating capture controls (Shadow DOM isolated)
│   │
│   ├── popup/               # Extension popup (tab selector)
│   │   ├── index.html
│   │   ├── App.tsx
│   │   └── TabSelector.tsx
│   │
│   ├── editor/              # Full-page editor (opens in new tab)
│   │   ├── index.html
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Timeline.tsx        # Step list sidebar
│   │   │   ├── StepCard.tsx        # Individual step preview
│   │   │   ├── AnnotationCanvas.tsx # Fabric.js canvas wrapper
│   │   │   ├── ToolBar.tsx         # Annotation tools palette
│   │   │   ├── DescriptionEditor.tsx # Text editor per step
│   │   │   └── ExportPanel.tsx     # Export options (HTML/PDF)
│   │   └── hooks/
│   │       ├── useAnnotation.ts    # Fabric.js state management
│   │       └── useExport.ts        # Export logic
│   │
│   ├── shared/              # Shared utilities
│   │   ├── types.ts         # Core type definitions
│   │   ├── constants.ts     # App constants (limits, defaults)
│   │   ├── messaging.ts     # Extension messaging helpers (typed)
│   │   ├── descriptionGenerator.ts # Auto-description from InteractionEvent
│   │   └── sensitiveFieldDetector.ts # Detect password/CC/PII fields
│   │
│   └── assets/              # Icons, CSS
│       ├── icons/
│       └── styles/
│
├── public/
│   └── manifest.json        # WebExtension manifest (MV3)
│
├── scripts/
│   └── build.ts             # Cross-browser build script
│
├── tests/
│   ├── unit/
│   └── e2e/
│
├── vite.config.ts           # Multi-entry config
├── tsconfig.json
├── package.json
└── README.md
```

### Component Communication

```
┌─────────────────────────────────────────────────┐
│                 Service Worker                    │
│              (captureManager.ts)                  │
│                                                   │
│  State Machine: idle → capturing → paused         │
│                  → capturing → editing → idle      │
│                                                   │
│  Responsibilities:                                │
│  - Orchestrates capture session lifecycle         │
│  - Calls chrome.tabs.captureVisibleTab()          │
│  - Stores steps in memory (Map<sessionId, Step[]>)│
│  - Manages content script injection               │
└──────────┬──────────────────────┬────────────────┘
           │ chrome.runtime       │ chrome.runtime
           │ .sendMessage()       │ .sendMessage()
           ▼                      ▼
┌─────────────────┐    ┌──────────────────────────┐
│     Popup        │    │     Content Script         │
│  (Tab Selector)  │    │  (injected in target tab)  │
│                  │    │                            │
│  - Lists tabs    │    │  - Listens for clicks      │
│  - Starts        │    │  - Extracts element info   │
│    capture       │    │  - Shows highlight overlay  │
└─────────────────┘    │  - Renders floating toolbar │
                       │  - Sends step data to SW    │
                       └──────────────────────────────┘

                       ┌──────────────────────────┐
                       │     Editor (new tab)       │
                       │                            │
                       │  - Receives all steps      │
                       │  - Fabric.js annotation    │
                       │  - Description editing     │
                       │  - Reorder / delete steps  │
                       │  - Export HTML / PDF        │
                       └──────────────────────────────┘
```

---

## Core Data Types

```typescript
interface CaptureSession {
  id: string;
  status: 'idle' | 'capturing' | 'paused' | 'editing' | 'done';
  tabId: number;
  tabTitle: string;
  tabUrl: string;
  steps: CaptureStep[];
  createdAt: number;
  screenshotStrategy: ScreenshotStrategy;
}

interface ScreenshotStrategy {
  mode: 'mutation-observer' | 'fixed-delay';
  settleTime: number;    // ms to wait after last DOM mutation (default: 400)
  maxWait: number;       // ms max timeout (default: 3000)
  fixedDelay: number;    // ms for fixed-delay mode (default: 500)
}

interface CaptureStep {
  id: string;
  index: number;                    // Step number (1-based)
  screenshotBefore?: string;        // Pre-click base64 JPEG (for ephemeral UI)
  screenshotAfter: string;          // Post-click base64 JPEG (primary)
  interaction: InteractionEvent;    // What the user did
  description: string;              // Auto-generated, user-editable
  annotations: string;              // Fabric.js JSON serialization
  timestamp: number;
  tabId: number;                    // Which tab this step occurred in
  url: string;                      // Page URL at time of capture
}

interface InteractionEvent {
  type: 'click' | 'input' | 'change' | 'keypress' | 'navigation' | 'scroll';
  element: ElementInfo;
  value?: string;          // For inputs (masked if sensitive field detected)
  previousValue?: string;  // For change events
  key?: string;            // For keypress events (Enter, Tab, etc.)
  navigatedTo?: string;    // For navigation events (new URL)
}

interface ElementInfo {
  tagName: string;              // e.g., "BUTTON", "A", "INPUT"
  inputType?: string;           // e.g., "text", "checkbox", "radio", "select-one"
  text: string;                 // innerText or value (truncated to 50 chars)
  ariaLabel?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  role?: string;
  href?: string;
  boundingRect: DOMRect;        // Position for highlight overlay
  xpath: string;                // For reference (not used for replay)
  isInIframe: boolean;          // Whether element is inside an iframe
  iframeOffset?: { x: number; y: number }; // Offset if inside iframe
}
```

---

## Feature Specifications

### 1. Tab Selection (Popup)

When the user clicks the extension icon:
- Display a list of all open tabs (title + favicon)
- User selects which tab to capture
- Extension injects the content script into the selected tab
- Capture mode begins immediately

### 2. Click Tracking & Screenshot Capture

**Click interception (Content Script):**
- Listen to `click` events on `document` (capture phase)
- For each click:
  1. Extract element info (tag, text, aria-label, bounding rect, etc.)
  2. Send message to Service Worker
  3. Service Worker calls `chrome.tabs.captureVisibleTab()` to take screenshot
  4. Brief visual highlight flash on the clicked element (CSS animation)

**Auto-description generation:**
Generate human-readable descriptions from interaction metadata:
```
Click:       "Clicked button 'Submit Form'"
Click:       "Clicked link 'Dashboard' → navigating to /dashboard"
Input:       "Typed in text field 'Email address'"
Change:      "Selected 'Option B' from dropdown 'Plan Type'"
Change:      "Checked checkbox 'I agree to terms'"
Click:       "Clicked tab 'Settings'"
Keypress:    "Pressed Enter to submit form"
Navigation:  "Navigated to /settings/profile"
```

**Description logic priority (for click events):**
1. `aria-label` → "Clicked [tagName] '[aria-label]'"
2. `innerText` (truncated to 50 chars) → "Clicked [tagName] '[text]'"
3. `placeholder` → "Clicked [tagName] with placeholder '[placeholder]'"
4. `title` attribute → "Clicked [tagName] '[title]'"
5. `id` or first meaningful `className` → "Clicked [tagName] #[id]"
6. Fallback → "Clicked [tagName] element"

**Special cases:**
- Links: append "→ navigating to [href]"
- Inputs: detect type (text, checkbox, radio, select) and adjust verb (typed, checked, selected)
- Navigation elements: detect role="tab", role="menuitem", etc.
- Iframe content: prepend "Inside embedded frame: " to the description
- Sensitive fields: if `input.type` is "password", "credit-card", or field has `autocomplete="cc-*"`, mask the value: "Typed [masked] in field 'Password'"

### 3. Floating Capture Toolbar

A draggable toolbar injected into the target tab during capture:

```
┌─────────────────────────────────────────┐
│  ● Praxis  │ Step 5 │ ⏸ │ ⏹ │ 🗑 │
└─────────────────────────────────────────┘
```

- **Step counter** — Shows current step count
- **Pause/Resume** (⏸/▶) — Temporarily stops click tracking
- **Stop** (⏹) — Ends capture, opens editor
- **Cancel/Delete** (🗑) — Discards all captured data, confirms with dialog
- Toolbar is draggable to avoid obscuring content
- Toolbar uses Shadow DOM to prevent style conflicts with the host page
- Toolbar is excluded from screenshots (hidden before capture, shown after)

### 4. Annotation Editor

Opens in a new tab after capture stops. Layout:

```
┌────────────────────────────────────────────────────────┐
│  Praxis Editor              [Export HTML] [Export PDF]  │
├──────────┬─────────────────────────────────────────────┤
│ Timeline │              Canvas Area                     │
│          │                                              │
│ [Step 1] │  ┌──────────────────────────────────┐       │
│  thumb   │  │                                    │       │
│          │  │     Screenshot + Annotations       │       │
│ [Step 2] │  │                                    │       │
│  thumb   │  │     (Fabric.js canvas)             │       │
│          │  └──────────────────────────────────┘       │
│ [Step 3] │                                              │
│  thumb   │  ┌──────────────────────────────────┐       │
│          │  │ Description:                       │       │
│  ...     │  │ "Clicked button 'Save Draft'"      │       │
│          │  └──────────────────────────────────┘       │
│          │                                              │
│          │  Tool Palette:                               │
│          │  [Arrow][Rect][Circle][Text][Blur][Color]    │
│          │  [Undo][Redo][Delete selected]               │
└──────────┴─────────────────────────────────────────────┘
```

**Annotation tools (Fabric.js):**

| Tool | Description | Implementation |
|------|-------------|----------------|
| **Arrow** | Draw directional arrows | Fabric.js Line + Triangle group |
| **Rectangle** | Draw bordered rectangles | `fabric.Rect` with configurable stroke |
| **Circle/Ellipse** | Draw circles/ovals | `fabric.Ellipse` |
| **Text** | Add free text labels | `fabric.IText` with editable content |
| **Blur** | Pixelate/blur a selected rectangular area | Apply pixel averaging to the underlying image data — **must be destructive** (modifies actual pixels, not an overlay) |
| **Step Badge** | Numbered circle auto-placed on clicked element | `fabric.Group` (Circle + Text), auto-positioned from `boundingRect` |
| **Color Picker** | Change stroke/fill color | Palette: red, blue, green, yellow, black, white |
| **Undo/Redo** | Standard undo stack | Fabric.js state serialization stack |
| **Delete** | Remove selected annotation object | `canvas.remove(activeObject)` |

**Step management:**
- Drag-and-drop reorder steps in the timeline
- Delete individual steps
- Edit description text (contenteditable or textarea)
- Each step's annotations are independent (separate Fabric.js canvas state)

### 5. Export — HTML Standalone

Generate a **single, self-contained HTML file** with:
- All images embedded as base64 data URLs
- All CSS inlined (no external dependencies)
- No JavaScript required to view (pure HTML + CSS)
- Clean, responsive layout
- Step numbers, annotated screenshots, and descriptions
- Title and metadata at the top
- Print-friendly styles

**HTML structure:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Praxis Guide: [Guide Title]</title>
  <style>
    /* All styles inlined */
    /* Responsive, print-friendly */
  </style>
</head>
<body>
  <header>
    <h1>[Guide Title]</h1>
    <p class="meta">Generated by Praxis · [Date] · [Step count] steps</p>
  </header>

  <main>
    <section class="step" id="step-1">
      <div class="step-header">
        <span class="step-number">1</span>
        <p class="step-description">[Description]</p>
      </div>
      <img src="data:image/png;base64,..." alt="Step 1" />
    </section>
    <!-- Repeat for each step -->
  </main>

  <footer>
    <p>Created with <a href="[repo-url]">Praxis</a> — Open Source</p>
  </footer>
</body>
</html>
```

### 6. Export — PDF

Generate a PDF document using jsPDF + html2canvas:
- One step per page (or smart layout for smaller screenshots)
- Step number badge, annotated screenshot, description
- Title page with guide name and metadata
- Page numbers
- Consistent styling

---

## Security Requirements

These are non-negotiable given the corporate/financial context:

| Requirement | Implementation |
|-------------|----------------|
| **Minimal permissions** | Request only `activeTab`, `tabs`, `scripting`. No `<all_urls>`, no persistent host permissions |
| **No external requests** | All assets bundled. CSP in manifest blocks all external connections |
| **Ephemeral storage** | Data lives in Service Worker memory only. `chrome.storage.local` used only as temporary buffer during editor session |
| **Auto-cleanup** | All data purged when editor tab closes or extension is toggled off |
| **Destructive blur** | The blur tool modifies actual pixel data on the canvas. Original image data under blurred regions cannot be recovered |
| **Sanitized exports** | HTML export contains no `<script>` tags. PDF is static |
| **Shadow DOM isolation** | Toolbar and overlays use Shadow DOM to prevent CSS/JS leaks in both directions |
| **No eval / no dynamic code** | CSP: `script-src 'self'` only |
| **Manual purge** | "Delete all data" button accessible from popup at all times |

### manifest.json Permissions

```json
{
  "permissions": [
    "activeTab",
    "tabs",
    "scripting"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none'; connect-src 'none'"
  }
}
```

---

## State Machine

```
                    ┌─────────┐
         ┌─────────│  IDLE    │◄──────────────┐
         │         └────┬─────┘               │
         │              │ user selects tab     │
         │              ▼                      │
         │         ┌──────────┐               │
         │    ┌───►│CAPTURING │───────┐       │
         │    │    └────┬─────┘       │       │
         │    │         │ pause       │ stop  │
         │    │         ▼             │       │
         │    │    ┌──────────┐       │       │
         │    └────│ PAUSED   │       │       │
         │ resume  └──────────┘       │       │
         │                            ▼       │
         │ cancel              ┌──────────┐   │
         └─────────────────────│ EDITING  │   │
                               └────┬─────┘   │
                                    │ export   │
                                    │ or close │
                                    ▼         │
                               ┌──────────┐   │
                               │   DONE   │───┘
                               └──────────┘
```

Transitions:
- `IDLE → CAPTURING`: User selects a tab from the popup
- `CAPTURING → PAUSED`: User clicks pause on toolbar
- `PAUSED → CAPTURING`: User clicks resume
- `CAPTURING → EDITING`: User clicks stop on toolbar
- `CAPTURING → IDLE`: User clicks cancel (with confirmation)
- `PAUSED → IDLE`: User clicks cancel (with confirmation)
- `EDITING → DONE → IDLE`: User exports or closes editor

---

## Technical Challenges & Mitigations

These are known edge cases and pitfalls that must be addressed in the architecture. Ignoring them will result in a tool that only works on trivial static pages.

### 1. Screenshot Timing After Click

**Problem:** When the user clicks a button, the page often needs time to react — a modal opens, content loads via AJAX, a spinner appears, a CSS transition plays. If the screenshot is taken immediately on click, it captures the state *before* the click's effect is visible, making the guide confusing.

**Mitigation:**
- After intercepting a click, do NOT screenshot immediately
- Start a `MutationObserver` on `document.body` (subtree, childList, attributes)
- Wait until DOM mutations settle (no new mutations for 300-500ms)
- Set a maximum wait timeout (3 seconds) to avoid hanging on streaming content
- Implement as a configurable `screenshotDelay` strategy:

```typescript
type ScreenshotStrategy = {
  mode: 'mutation-observer' | 'fixed-delay';
  settleTime: number;    // ms to wait after last mutation (default: 400)
  maxWait: number;       // ms max timeout (default: 3000)
  fixedDelay: number;    // ms for fixed-delay mode (default: 500)
};
```

- The toolbar could include a user-facing "delay" toggle (fast/normal/slow) for different app speeds

### 2. SPA Navigation (Single Page Applications)

**Problem:** Modern web apps (React, Angular, Vue) don't trigger full page reloads. A click on a navigation link changes content via `history.pushState()` or `hashchange` without any `beforeunload` event. The content script stays injected but may miss route transitions.

**Mitigation:**
- Monkey-patch `history.pushState` and `history.replaceState` in the content script to detect SPA navigation:

```typescript
const originalPushState = history.pushState.bind(history);
history.pushState = function (...args) {
  originalPushState(...args);
  window.dispatchEvent(new Event('praxis:navigation'));
};
```

- Also listen to `popstate` and `hashchange` events
- On detected navigation, optionally auto-capture a "Navigation" step (screenshot of the new view) even without a click
- This is critical for documenting workflows in tools like CreditLens, Salesforce, or any React-based enterprise app

### 3. Iframe Content

**Problem:** Many enterprise applications use iframes extensively (Salesforce, ServiceNow, Oracle, embedded modules). Content scripts do not automatically inject into iframes. Clicks inside an iframe are invisible to the parent page's content script, and `captureVisibleTab()` only captures the visible viewport (iframes are rendered but click coordinates are wrong).

**Mitigation (MVP):**
- Declare `"all_frames": true` in the content script manifest entry to inject into same-origin iframes:

```json
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["content.js"],
  "all_frames": true,
  "run_at": "document_idle"
}]
```

- For same-origin iframes: content script runs inside the iframe, captures clicks, and reports element coordinates relative to the viewport (accounting for iframe offset via `window.frameElement.getBoundingClientRect()`)
- For cross-origin iframes: impossible to inject by design (browser security). Log a warning and capture the parent page screenshot only. The step description should note "Clicked inside embedded content (cross-origin iframe)"

**Mitigation (V2):**
- Explore using `chrome.scripting.executeScript()` with `frameIds` parameter to selectively inject into specific frames

### 4. Non-Click Interactions

**Problem:** The brief currently only tracks click events, but real workflows involve typing in form fields, selecting dropdown options, toggling checkboxes, scrolling, keyboard shortcuts, drag-and-drop, and right-click context menus. A capture tool that only records clicks will produce incomplete guides.

**Mitigation (MVP — must have):**
- Track `input` and `change` events on form elements to capture:
  - Text input: "Typed '[value]' in field '[label/placeholder]'" (sanitize/mask sensitive input)
  - Select/dropdown: "Selected '[option text]' from '[label]'"
  - Checkbox/radio: "Checked/Unchecked '[label]'"
- Track `keydown` for Enter/Tab key presses that trigger form submissions or navigation
- These generate steps just like clicks (screenshot + auto-description)

**Mitigation (V2):**
- Scroll events → "Scrolled down to [section]" with before/after screenshots
- Drag-and-drop events
- Right-click context menu interactions
- Keyboard shortcut detection

**Update `ClickedElement` to `InteractionEvent`:**

```typescript
interface InteractionEvent {
  type: 'click' | 'input' | 'change' | 'keypress' | 'navigation' | 'scroll';
  element: ElementInfo;
  value?: string;          // For inputs (masked if sensitive)
  previousValue?: string;  // For change events
  key?: string;            // For keypress events
  url?: string;            // For navigation events
}
```

### 5. Screenshot Size & Memory Pressure

**Problem:** `captureVisibleTab()` captures at the device's pixel ratio. On a 2x Retina display at 1920×1080, each screenshot is 3840×2160 pixels. As a PNG base64 string, that's 2-5MB per screenshot. A 30-step guide could consume 60-150MB of memory in the service worker, risking OOM crashes and sluggish editor performance.

**Mitigation:**
- **Resize on capture:** After capturing, resize the image to a max width of 1920px (logical pixels) using an offscreen canvas:

```typescript
// In service worker or offscreen document
const img = await createImageBitmap(blob);
const scale = Math.min(1, 1920 / img.width);
const canvas = new OffscreenCanvas(img.width * scale, img.height * scale);
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
const resizedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
```

- **Use JPEG instead of PNG** for screenshots (70-85% smaller). PNG only for the final annotated export where annotations need sharp edges
- **Step limit:** Hard cap at 100 steps per session. Show a warning at 75 steps. This prevents runaway captures
- **Memory monitoring:** Track approximate memory usage (`performance.memory` where available) and warn the user if approaching limits
- **Lazy loading in editor:** Only load the currently viewed step's full-resolution image. Show thumbnails (further downsized) in the timeline sidebar

### 6. Accidental Data Loss

**Problem:** Since all data is ephemeral by design, closing the editor tab (misclick, browser crash, accidental Ctrl+W) instantly destroys all captured work. For a 30-step annotated guide that took 20 minutes to create, this is devastating.

**Mitigation:**
- **`beforeunload` warning:** When the editor has unsaved changes, register a `beforeunload` handler to show the browser's native "Leave page?" confirmation dialog
- **Temporary session backup:** Optionally use `chrome.storage.local` to periodically auto-save the session (every 30 seconds or after each annotation edit). This is explicitly a recovery mechanism, not persistence — it's cleared on successful export or manual purge
- **Recovery prompt:** If the extension detects leftover session data in `chrome.storage.local` on startup, offer: "A previous session was found. Recover or discard?"
- **Export early, export often:** The editor should prominently display a "Save progress" hint after every 5 annotation edits

### 7. Dropdowns, Menus & Ephemeral UI

**Problem:** Tooltips, dropdown menus, context menus, autocomplete lists, and modal overlays are often dismissed by the next click or by focus loss. If the screenshot is taken *after* the click (which is the normal flow), these elements have already disappeared. The guide then shows "Clicked 'Option B' from dropdown" but the screenshot shows the dropdown already closed.

**Mitigation:**
- Maintain a **rolling pre-click screenshot buffer**: continuously capture a screenshot every ~500ms (or on `mousedown` just before `click` fires) and keep only the last one
- When a click event fires, use the **pre-click screenshot** (showing the open dropdown) rather than the post-click screenshot
- Then also take a **post-click screenshot** after mutation settle
- Generate a **two-screenshot step** for interactions with ephemeral elements:
  - Screenshot A: "Before — dropdown open, option highlighted"
  - Screenshot B: "After — option selected, result visible"
- This can be simplified in the editor to show only one, but both are available

**Implementation detail:**
- `mousedown` fires before `click` — capture on `mousedown`, then pair with the post-`click` screenshot
- Use a flag to avoid double-capturing when `mousedown` and `click` fire on the same element within a short window

### 8. Multi-Tab Workflows

**Problem:** Some workflows open new tabs (`target="_blank"` links, OAuth login flows, external redirects). The current design captures only one tab. If the user clicks a link that opens a new tab, the flow is broken — the new tab has no content script, and the capture session doesn't follow.

**Mitigation (MVP):**
- Listen for `chrome.tabs.onCreated` and `chrome.webNavigation.onCreatedNavigationTarget` in the service worker
- If a new tab is opened *from* the captured tab (opener relationship), show a notification: "Praxis detected a new tab. Follow to new tab?"
- If the user confirms, inject the content script into the new tab and continue the session
- Tag the step with a "Tab switch" indicator in the description: "→ Continued in new tab: [title]"

**Mitigation (V2):**
- Full multi-tab session support: track an array of `tabId`s in the session
- Visually separate steps by tab in the editor timeline

### 9. Content Security Policy Conflicts

**Problem:** Some websites have strict Content Security Policies that can interfere with the content script's injected UI (toolbar, highlight overlay). If a site blocks inline styles or restricts which DOM operations are allowed, the toolbar may not render correctly.

**Mitigation:**
- All injected UI (toolbar, overlays) must use **Shadow DOM** — this isolates the extension's styles from the host page's CSP
- Avoid injecting `<style>` tags into the host page — use `adoptedStyleSheets` on the shadow root instead
- If Shadow DOM is not supported (extremely old browsers), fall back to iframe-based toolbar

### 10. Performance Impact on Host Page

**Problem:** The content script adds event listeners, a MutationObserver, periodic pre-click screenshot captures, and DOM overlays. On a heavy enterprise app (which is the primary use case), this could cause noticeable lag.

**Mitigation:**
- Event listeners use `{ passive: true }` where possible
- MutationObserver is only active *after* a click event, not continuously
- Pre-click screenshot buffer uses `requestIdleCallback` and respects the main thread
- Highlight overlay uses CSS transforms (GPU-composited) instead of layout-triggering properties
- The floating toolbar is positioned with `position: fixed` and uses `will-change: transform`
- All injected elements use `pointer-events: none` except the toolbar itself
- Include a performance budget: content script should add < 5ms to any frame

### 11. Firefox Add-ons Store Publishing (V2)

**Problem:** The brief mentions Firefox support but doesn't cover publishing on Firefox Add-ons (AMO). AMO has different review requirements and policies than CWS.

**Mitigation:**
- AMO requires **source code submission** if the extension uses a build tool (Vite) — the reviewer needs to be able to build from source and verify the output matches the submitted XPI
- Include a `BUILD.md` or build instructions in the repo
- AMO reviews are manual and can take 1-7 days
- Firefox uses the `browser_specific_settings` key in manifest for the extension ID:

```json
"browser_specific_settings": {
  "gecko": {
    "id": "praxis@your-domain.com",
    "strict_min_version": "109.0"
  }
}
```

- AMO does not charge a registration fee (unlike CWS)
- Include AMO listing assets in the build pipeline alongside CWS assets

### 12. Sensitive Data in Auto-Descriptions

**Problem:** Auto-descriptions may capture sensitive text from the page. If the user clicks on a field showing a client name, account number, or email, the auto-description could include that data: "Clicked on cell 'John Smith — $2.4M portfolio'". Even though nothing is sent to a server, this data ends up in the exported HTML/PDF that gets shared.

**Mitigation:**
- All auto-descriptions should be clearly editable and highlight that they may contain sensitive data
- Before export, show a **review prompt**: "Review your guide for sensitive data before sharing"
- The blur tool must also work on text descriptions (not just screenshots)
- In V2: optional auto-redaction patterns (regex for emails, phone numbers, currency amounts) that flag descriptions for review

---

## MVP Scope (v0.1)

Focus on delivering a usable tool as fast as possible.

**Included in MVP:**
- [ ] Chrome-only (Firefox in v0.2)
- [ ] Tab selector popup
- [ ] Click tracking + screenshot capture
- [ ] Form interaction tracking (input, change, select, checkbox)
- [ ] Auto-description of interactions
- [ ] Screenshot timing via MutationObserver settle strategy
- [ ] Pre-click screenshot buffer (mousedown capture for ephemeral UI)
- [ ] Screenshot resize + JPEG compression (max 1920px width)
- [ ] Step limit (100 max, warning at 75)
- [ ] Floating toolbar (stop, cancel — no pause yet)
- [ ] Basic editor: view steps, edit descriptions, reorder, delete
- [ ] Annotation: rectangles, text, blur, step badges
- [ ] Export: HTML standalone only
- [ ] Pre-export review prompt for sensitive data
- [ ] `beforeunload` warning on unsaved editor changes
- [ ] Temporary session auto-save + recovery prompt
- [ ] Manual data purge
- [ ] Same-origin iframe support (`all_frames: true`)
- [ ] SPA navigation detection (pushState/popstate/hashchange)

**Deferred to v0.2:**
- [ ] Firefox support + AMO publishing
- [ ] Pause/Resume capture
- [ ] Full annotation toolkit (arrows, circles, color picker)
- [ ] Undo/Redo in annotation editor
- [ ] PDF export
- [ ] Multi-tab workflow following
- [ ] Keyboard shortcuts in editor
- [ ] Dark mode in editor
- [ ] Drag-and-drop reorder in timeline
- [ ] Guide title editing
- [ ] Scroll capture (detect scroll events as steps)
- [ ] Auto-redaction patterns for sensitive data
- [ ] Two-screenshot steps (before/after for ephemeral UI)
- [ ] Cross-origin iframe handling improvements

---

## Build & Development Setup

### Vite Multi-Entry Configuration

The extension requires multiple entry points built separately:

```typescript
// vite.config.ts (simplified concept)
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
        editor: 'src/editor/index.html',
        content: 'src/content/index.ts',
        background: 'src/background/index.ts',
      },
      output: {
        entryFileNames: '[name].js',
      }
    }
  }
});
```

### Development Workflow

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build (Chrome)
npm run build:chrome

# Production build (Firefox)
npm run build:firefox

# Run tests
npm run test          # unit tests (vitest)
npm run test:e2e      # playwright e2e

# Lint
npm run lint
```

### Loading in Browser (Development)

**Chrome:**
1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `dist/chrome/`

**Firefox:**
1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on" → select `dist/firefox/manifest.json`

---

## Coding Standards

- **TypeScript strict mode** — no `any` types except in explicit escape hatches
- **Functional components** — Preact with hooks, no class components
- **Immutable state updates** — never mutate state directly
- **Message passing** — all cross-context communication through typed message interfaces
- **Error boundaries** — wrap editor components to prevent full crashes
- **Accessibility** — editor UI must be keyboard navigable, proper ARIA labels
- **No console.log in production** — use a debug utility that checks `__DEV__`

---

## Chrome Web Store Publishing

Praxis will be published as a free extension on the Chrome Web Store.

### Store Listing Assets Required

| Asset | Spec |
|-------|------|
| **Extension icon** | 128×128 PNG (also provide 16, 32, 48 for manifest) |
| **Store icon** | 128×128 PNG |
| **Screenshots** | 1280×800 or 640×400 PNG/JPG — minimum 1, up to 5 |
| **Promotional tile (small)** | 440×280 PNG/JPG |
| **Promotional tile (large)** | 920×680 PNG/JPG (optional but recommended) |
| **Short description** | Max 132 characters |
| **Detailed description** | Up to 16,000 characters |

### Manifest Requirements for CWS

```json
{
  "manifest_version": 3,
  "name": "Praxis",
  "version": "0.1.0",
  "description": "Capture, annotate, and share step-by-step workflow guides. Privacy-first, no account needed.",
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "permissions": [
    "activeTab",
    "tabs",
    "scripting"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png"
    }
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none'"
  }
}
```

### CWS Review Compliance

The Chrome Web Store has strict review policies. These design decisions ensure smooth approval:

1. **Minimal permissions** — Only `activeTab`, `tabs`, `scripting`. No `<all_urls>`, no `host_permissions`, no `storage` (we use in-memory only). The fewer permissions, the faster the review.
2. **No remote code** — All JS is bundled. No `eval()`, no `Function()`, no fetching scripts. CSP enforces `script-src 'self'`.
3. **No external network requests** — The extension makes zero HTTP requests. No analytics, no telemetry, no CDN assets. This avoids the "connects to remote servers" flag entirely.
4. **Single clear purpose** — CWS requires a clear, narrow purpose statement. Praxis does one thing: capture and annotate workflow guides.
5. **Privacy policy** — Required even for extensions that collect nothing. Create a simple privacy policy page (can be a GitHub Pages page or a section in the README) stating: "Praxis does not collect, store, transmit, or share any user data. All data remains in your browser and is discarded when you close the editor."
6. **No obfuscated code** — CWS rejects minified/obfuscated code that reviewers can't read. Use Vite's `minify: false` for the CWS submission build, or at minimum use standard minification (Terser) without mangling — no custom obfuscation.
7. **Version numbering** — Use semver (`0.1.0`, `0.2.0`, etc.). CWS requires version to increase with each submission.

### Publishing Checklist (for later)

- [ ] Create Chrome Developer account ($5 one-time registration fee)
- [ ] Prepare all store listing assets (icons, screenshots, descriptions)
- [ ] Write privacy policy (GitHub Pages or repo README section)
- [ ] Build production bundle with source maps excluded
- [ ] Create ZIP of the `dist/chrome/` directory
- [ ] Submit for review (typically 1-3 business days)
- [ ] After approval: set up GitHub Releases to match CWS versions

### Store Description (Draft)

**Short (132 chars):**
> Capture clicks, annotate screenshots, and export step-by-step guides. Free, open-source, privacy-first. No account needed.

**Detailed:**
> Praxis captures your workflow as a step-by-step visual guide — perfect for onboarding, documentation, and knowledge sharing.
>
> HOW IT WORKS:
> 1. Click the Praxis icon and select a tab to capture
> 2. Navigate your workflow — Praxis records each click with a screenshot
> 3. Review, annotate, and edit your guide in the built-in editor
> 4. Export as a standalone HTML file or PDF — share with anyone
>
> KEY FEATURES:
> • Automatic click detection with smart step descriptions
> • Full annotation toolkit: arrows, rectangles, text, and blur for sensitive data
> • Export as self-contained HTML (no server needed to view)
> • Pause and resume capture at any time
>
> PRIVACY-FIRST:
> • No account or registration required
> • No data ever leaves your browser
> • No analytics, tracking, or telemetry
> • All captured data is discarded when you close the editor
> • Blur tool permanently removes pixel data — not just an overlay
>
> 100% free and open-source (MIT license).

---

## Out of Scope

The following are explicitly NOT part of this project:

- User accounts or authentication
- Cloud storage or synchronization
- Backend server of any kind
- Analytics or telemetry
- Monetization features
- Video/GIF recording (screenshots only)
- Workflow replay/automation
- Collaboration features (real-time editing)
- Browser history or bookmark integration

---

## References

- [Chrome Extensions MV3 Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [Firefox WebExtensions Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [webextension-polyfill](https://github.com/nicknisi/webextension-polyfill)
- [Fabric.js Documentation](http://fabricjs.com/docs/)
- [Preact Documentation](https://preactjs.com/guide/v10/getting-started)
- [Vite Plugin for Browser Extensions](https://github.com/nicedoc/vite-plugin-web-extension)