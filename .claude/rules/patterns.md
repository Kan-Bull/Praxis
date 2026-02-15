## Pre-Click Buffer Race Condition

- Fire-and-forget async calls (`bufferPreClickScreenshot`) can lose the race against subsequent sync messages (`INTERACTION_EVENT` arriving 50-100ms later)
- Fix: store the **promise** (not just the result) and `await` it in the consumer (`handleInteractionEvent`)
- Pattern: `let pending: Promise<void> | null = null;` set on fire, `if (pending) await pending;` in consumer
- `captureScreenshot` involves 2 async hops (`chrome.tabs.get` + `captureVisibleTab`) — never assume it completes within a mousedown→click window
