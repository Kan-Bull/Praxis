# Praxis

**Privacy-first browser extension for capturing workflow guides and screenshots.**

Praxis records your clicks, captures screenshots, generates step descriptions, and lets you annotate everything in a built-in editor. Export as PDF or PNG. No accounts, no servers, no tracking.

---

## Features

- **One-click capture** - Press the capture button and interact with any website. Praxis records each step automatically.
- **Screenshot mode** - Capture a single screenshot for quick annotation.
- **Smart descriptions** - Auto-generates step descriptions from your interactions (clicks, form inputs, navigation).
- **Built-in editor** - Annotate screenshots with rectangles, arrows, text, and click indicators using Fabric.js.
- **Destructive blur** - Permanently redact sensitive content at the pixel level (not a reversible overlay).
- **Sensitive field detection** - Automatically redacts passwords, credit cards, SSNs, API keys, and other PII from captured data.
- **PDF & PNG export** - Export complete guides as multi-page PDFs or individual step images.
- **Copy to clipboard** - One-click copy of annotated screenshots.
- **Session recovery** - Auto-saves progress to Chrome storage. Recovers from crashes and accidental tab closures.
- **Zero network requests** - CSP enforces `connect-src data:` which blocks all outbound HTTP/HTTPS traffic. No analytics, no telemetry, no external calls of any kind.

## Privacy

Praxis is built with privacy as a core architectural constraint, not just a feature.

- All data stays **local on your device** (Chrome storage API)
- **No accounts** or sign-in required
- **No data transmission** - enforced at the CSP level, not just by policy
- Sensitive fields (passwords, credit cards, SSNs, tokens) are **automatically detected and redacted**
- URL parameters containing tokens, sessions, and API keys are **automatically scrubbed**
- Captured sessions are **auto-deleted after 24 hours**
- The blur tool **permanently destroys pixels** - blurred content cannot be recovered

Read the full [Privacy Policy](PRIVACY.md).

## Installation

### From the Chrome Web Store

*(Coming soon)*

### From source

```bash
git clone https://github.com/Kan-Bull/Praxis.git
cd Praxis
npm install
npm run build
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

## Usage

1. **Start a capture** - Click the Praxis icon in the toolbar, then click "Start Capture" on the tab you want to record.
2. **Interact normally** - Click, type, navigate. Each interaction is captured as a step with a screenshot and description.
3. **Stop capture** - Click the stop button in the floating toolbar.
4. **Edit & annotate** - The editor opens automatically. Add annotations, blur sensitive areas, crop screenshots, reorder or delete steps.
5. **Export** - Download as PDF, export individual steps as PNG, or copy to clipboard.

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | [Preact](https://preactjs.com/) |
| Language | TypeScript (strict mode) |
| Build | [Vite](https://vitejs.dev/) + [vite-plugin-web-extension](https://github.com/nicedoc/vite-plugin-web-extension) |
| Canvas Editor | [Fabric.js](http://fabricjs.com/) v7 |
| PDF Export | [jsPDF](https://github.com/parallax/jsPDF) |
| Testing | [Vitest](https://vitest.dev/) (654+ unit tests) + [Playwright](https://playwright.dev/) (E2E) |

## Architecture

```
src/
  shared/        # Types, constants, sanitization, PII detection, messaging
  background/    # Service worker: capture pipeline, screenshot processing, recovery
  content/       # Content script: click/form tracking, toolbar, DOM observation
  popup/         # Extension popup: session controls, tab list
  editor/        # Annotation editor: Fabric.js canvas, tools, export
```

- **Manifest V3** with programmatic content script injection
- **Content Security Policy** locks down all extension pages
- **Pre-click screenshot buffer** captures the page state *before* each interaction
- **Event deduplication** prevents double-counting from rapid DOM events
- **Session recovery** persists state to `chrome.storage.local` with automatic cleanup

## Development

```bash
npm run dev          # Build in watch mode
npm run build        # Production build (includes type check)
npm test             # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run typecheck    # Type check only
npm run lint         # ESLint
npm run format       # Prettier
```

## Permissions

| Permission | Purpose |
|---|---|
| `activeTab` | Capture screenshots of the current tab |
| `tabs` | Read tab URL and title for step labels |
| `scripting` | Inject capture toolbar and interaction trackers |
| `storage` / `unlimitedStorage` | Save sessions locally for crash recovery |
| `webNavigation` | Detect page navigations to re-inject the toolbar |
| Host permissions (`<all_urls>`) | Allow capturing on any website |

## License

[ISC](https://opensource.org/licenses/ISC)

## Author

Quentin Goossens

---

Built with [Claude Code](https://claude.ai/code).
