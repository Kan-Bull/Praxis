# Claude in Chrome + Praxis Integration

## What Works
- Navigate web pages and interact with content normally
- See Praxis toolbar in screenshots (it renders in the page DOM)
- Click page elements to generate capture steps (step counter increments)
- Type in search boxes and form fields during capture
- Click toolbar Stop/Cancel buttons
- Use `window.location.href` to navigate to `chrome-extension://` URLs (but can't read/screenshot them)

## What's Blocked (Cross-Extension Security)
- Cannot screenshot, read DOM, or execute JS on `chrome-extension://` pages
- Cannot access Praxis popup or editor pages
- Cannot start capture sessions programmatically (no access to extension APIs from page context)
- Editor tabs opened by Praxis are outside Claude in Chrome's tab group
- `navigate()` prepends `https://` to `chrome-extension://` URLs — use `javascript_tool` with `window.location.href` instead

## Implications
- User must manually start captures (click Praxis icon)
- Claude can drive the capture workflow (clicking around pages)
- User must review editor results (Claude can't see them)
- To enable full automation, would need a page-context bridge API
