# Privacy Policy for Praxis

**Last updated:** February 15, 2026

Praxis is a browser extension for capturing workflow guides and screenshots. This policy explains what data Praxis collects, how it is used, and how it is stored.

## Data Collection

When you actively use Praxis to capture a workflow, the extension collects:

- **Screenshots** of the visible browser tab (captured via the Chrome tabs API)
- **Page URLs and titles** for each captured step
- **Click coordinates and interaction type** (click, form input, navigation) to generate step descriptions
- **Form field values** for non-sensitive fields, to describe what was typed or selected
- **Page content** visible in screenshots (text, images, layout)

### What Praxis Does NOT Collect

- Passwords, credit card numbers, SSNs, or other sensitive form fields (automatically redacted)
- Browsing history outside of active capture sessions
- Data from tabs you are not capturing
- Any data when the extension is idle (Praxis only records when you press the capture button)

## Data Storage

All data is stored **locally on your device** using Chrome's built-in storage API (`chrome.storage.local`). Captured sessions are automatically removed after 24 hours or when you export/cancel.

## Data Transmission

**Praxis sends zero data over the network.** The extension's Content Security Policy enforces `connect-src data:` which blocks all HTTP/HTTPS network requests. There are no analytics, telemetry, crash reporting, or external API calls of any kind.

## Data Sharing

Praxis does not sell, transfer, or share any user data with third parties. Data only leaves the extension when you explicitly export a PDF or PNG file to your local device.

## Permissions

| Permission | Why It's Needed |
|---|---|
| `activeTab` | Capture screenshots of the tab you're viewing |
| `tabs` | Read the tab's URL and title for step labels |
| `scripting` | Inject the capture toolbar and interaction trackers |
| `storage` / `unlimitedStorage` | Save capture sessions locally for recovery |
| `webNavigation` | Detect page navigations to re-inject the toolbar |
| Host permissions (`<all_urls>`) | Allow capturing workflows on any website |

## Your Control

- You choose when to start and stop capturing
- You can review, edit, annotate, and delete any captured step before exporting
- You can blur sensitive content with the destructive blur tool (pixels are permanently modified)
- Canceling a capture deletes all session data immediately
- No account or sign-in is required

## Changes to This Policy

If this policy changes, the updated version will be posted at this URL with a new "Last updated" date.

## Contact

For questions about this privacy policy, open an issue at [github.com/Kan-Bull/Praxis](https://github.com/Kan-Bull/Praxis/issues).
