import { logger } from '../shared/logger';
import type { ExtensionMessage } from '../shared/types';
import { sendTabMessage } from '../shared/messaging';
import {
  startSession,
  startScreenshotSession,
  getSession,
  stopCapture,
  cancelCapture,
  handleInteractionEvent,
  resolveDomSettle,
  getToolbarPosition,
  setToolbarPosition,
  bufferPreClickScreenshot,
  getPreClickBufferPending,
} from './captureManager';
import {
  captureScreenshot,
  resizeScreenshotSW,
  createThumbnailSW,
} from './screenshotManager';
import {
  saveSession,
  clearRecoveryData,
  purgeExpiredSessions,
} from './recoveryManager';

// ── Message Router ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    const msg = message as ExtensionMessage;

    switch (msg.type) {
      case 'START_CAPTURE':
        handleStartCapture(msg.payload.tabId)
          .then((result) => sendResponse(result))
          .catch((err) => {
            logger.error('START_CAPTURE failed:', err);
            sendResponse({ status: 'error', error: String(err) });
          });
        return true; // Async response

      case 'TAKE_SCREENSHOT':
        handleTakeScreenshot(msg.payload.tabId)
          .then((result) => sendResponse(result))
          .catch((err) => {
            logger.error('TAKE_SCREENSHOT failed:', err);
            sendResponse({ status: 'error', error: String(err) });
          });
        return true;

      case 'STOP_CAPTURE':
        handleStopCapture()
          .then((result) => sendResponse(result))
          .catch((err) => {
            logger.error('STOP_CAPTURE failed:', err);
            sendResponse({ status: 'error', error: String(err) });
          });
        return true;

      case 'CANCEL_CAPTURE':
        handleCancelCapture();
        sendResponse({ status: 'ok' });
        return false;

      case 'INTERACTION_EVENT':
        // Fire-and-forget: process the event, save session afterward
        handleInteractionEvent(msg.payload.event)
          .then((step) => {
            if (step) {
              const session = getSession();
              if (session) {
                // Fire-and-forget save — don't block the response
                saveSession(session).catch((err) =>
                  logger.error('Auto-save failed:', err),
                );
              }
            }
            sendResponse({ status: 'ok', stepId: step?.id ?? null });
          })
          .catch((err) => {
            logger.error('INTERACTION_EVENT failed:', err);
            sendResponse({ status: 'error', error: String(err) });
          });
        return true;

      case 'DOM_SETTLED':
        resolveDomSettle();
        sendResponse({ status: 'ok' });
        return false;

      case 'HEARTBEAT':
        sendResponse({ status: 'ok' });
        return false;

      case 'GET_SESSION_DATA': {
        const session = getSession();
        if (!session) {
          sendResponse({ status: 'ok', session: null });
        } else {
          // Return metadata without full screenshot data URLs
          const metadata = {
            ...session,
            steps: session.steps.map((step) => ({
              ...step,
              screenshotDataUrl: '',
            })),
          };
          sendResponse({ status: 'ok', session: metadata });
        }
        return false;
      }

      case 'GET_STEP_SCREENSHOT': {
        const session = getSession();
        const step = session?.steps.find((s) => s.id === msg.payload.stepId);
        sendResponse({
          status: 'ok',
          screenshotDataUrl: step?.screenshotDataUrl ?? null,
          thumbnailDataUrl: step?.thumbnailDataUrl ?? null,
        });
        return false;
      }

      case 'PRE_CLICK_BUFFER': {
        const session = getSession();
        if (session?.status === 'capturing') {
          bufferPreClickScreenshot(session.tabId);
          // Wait for the capture to complete before responding — the content
          // script holds a screenshot lock that prevents SHOW_TOOLBAR from
          // re-showing the toolbar until this response arrives.
          const pending = getPreClickBufferPending();
          if (pending) {
            pending.then(() => sendResponse({ status: 'ok' }));
          } else {
            sendResponse({ status: 'ok' });
          }
        } else {
          sendResponse({ status: 'ok' });
        }
        return true; // async response
      }

      case 'UPDATE_STEP_DESCRIPTION': {
        const session = getSession();
        const step = session?.steps.find((s) => s.id === msg.payload.stepId);
        if (!step) {
          sendResponse({ status: 'error', error: 'Step not found' });
          return false;
        }
        step.description = msg.payload.description;
        if (session) {
          session.updatedAt = Date.now();
          saveSession(session).catch((err) =>
            logger.error('Save after description update failed:', err),
          );
        }
        sendResponse({ status: 'ok' });
        return false;
      }

      case 'UPDATE_STEP_ANNOTATIONS': {
        const session = getSession();
        const step = session?.steps.find((s) => s.id === msg.payload.stepId);
        if (!step) {
          sendResponse({ status: 'error', error: 'Step not found' });
          return false;
        }
        step.annotations = msg.payload.annotations;
        if (session) {
          session.updatedAt = Date.now();
          saveSession(session).catch((err) =>
            logger.error('Save after annotations update failed:', err),
          );
        }
        sendResponse({ status: 'ok' });
        return false;
      }

      case 'UPDATE_STEP_SCREENSHOT': {
        const session = getSession();
        const step = session?.steps.find((s) => s.id === msg.payload.stepId);
        if (!step) {
          sendResponse({ status: 'error', error: 'Step not found' });
          return false;
        }
        step.screenshotDataUrl = msg.payload.screenshotDataUrl;
        if (session) {
          session.updatedAt = Date.now();
          saveSession(session).catch((err) =>
            logger.error('Save after screenshot update failed:', err),
          );
        }
        sendResponse({ status: 'ok' });
        return false;
      }

      case 'REORDER_STEPS': {
        const session = getSession();
        if (!session) {
          sendResponse({ status: 'error', error: 'No session' });
          return false;
        }
        const { stepIds } = msg.payload;
        const stepMap = new Map(session.steps.map((s) => [s.id, s]));
        const reordered: typeof session.steps = [];
        for (const id of stepIds) {
          const step = stepMap.get(id);
          if (step) reordered.push(step);
        }
        reordered.forEach((s, i) => { s.stepNumber = i + 1; });
        session.steps = reordered;
        session.updatedAt = Date.now();
        saveSession(session).catch((err) =>
          logger.error('Save after reorder failed:', err),
        );
        sendResponse({ status: 'ok' });
        return false;
      }

      case 'DELETE_STEP': {
        const session = getSession();
        if (!session) {
          sendResponse({ status: 'error', error: 'No session' });
          return false;
        }
        const idx = session.steps.findIndex((s) => s.id === msg.payload.stepId);
        if (idx === -1) {
          sendResponse({ status: 'error', error: 'Step not found' });
          return false;
        }
        session.steps.splice(idx, 1);
        // Renumber remaining steps
        session.steps.forEach((s, i) => { s.stepNumber = i + 1; });
        session.updatedAt = Date.now();
        saveSession(session).catch((err) =>
          logger.error('Save after step deletion failed:', err),
        );
        sendResponse({ status: 'ok' });
        return false;
      }

      case 'EXPORT_COMPLETE':
        clearRecoveryData()
          .then(() => sendResponse({ status: 'ok' }))
          .catch((err) => {
            logger.error('EXPORT_COMPLETE clear failed:', err);
            sendResponse({ status: 'error', error: String(err) });
          });
        return true;

      case 'SAVE_TOOLBAR_POSITION':
        setToolbarPosition(msg.payload);
        sendResponse({ status: 'ok' });
        return false;

      case 'PAUSE_CAPTURE':
        sendResponse({ status: 'not_implemented' });
        return false;

      case 'RESUME_CAPTURE':
        sendResponse({ status: 'not_implemented' });
        return false;

      default:
        logger.warn('Unknown message type:', (msg as { type: string }).type);
        sendResponse({ status: 'unknown_message' });
        return false;
    }
  },
);

// ── Message Handlers ────────────────────────────────────────────────

async function handleStartCapture(tabId: number): Promise<unknown> {
  const tab = await chrome.tabs.get(tabId);

  // Start session
  const session = startSession(tabId, tab.url ?? '', tab.title ?? 'Untitled');
  logger.log('Capture started:', session.id, 'on tab:', tabId);

  // Inject content script — rollback session on failure
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/index.js'],
    });
  } catch (err) {
    cancelCapture();
    throw err;
  }

  return { status: 'ok', sessionId: session.id };
}

async function handleStopCapture(): Promise<unknown> {
  const session = stopCapture();
  if (!session) {
    return { status: 'error', error: 'No active capture session' };
  }

  // Save session for recovery
  await saveSession(session);

  // Open editor tab
  const editorUrl = chrome.runtime.getURL('src/editor/index.html');
  await chrome.tabs.create({ url: editorUrl });

  logger.log('Capture stopped:', session.id, 'steps:', session.steps.length);
  return { status: 'ok', sessionId: session.id };
}

function handleCancelCapture(): void {
  const session = getSession();
  if (session) {
    logger.log('Capture cancelled:', session.id);
  }
  cancelCapture();
  // Fire-and-forget clear
  clearRecoveryData().catch((err) =>
    logger.error('Clear recovery data failed:', err),
  );
}

async function handleTakeScreenshot(tabId: number): Promise<unknown> {
  const tab = await chrome.tabs.get(tabId);
  const rawScreenshot = await captureScreenshot(tabId);
  const resized = await resizeScreenshotSW(rawScreenshot);
  const thumbnail = await createThumbnailSW(rawScreenshot);

  const session = startScreenshotSession(
    tabId,
    tab.url ?? '',
    tab.title ?? 'Screenshot',
    resized,
    thumbnail,
  );

  await saveSession(session);

  const editorUrl = chrome.runtime.getURL('src/editor/index.html');
  await chrome.tabs.create({ url: editorUrl });

  logger.log('Screenshot captured:', session.id);
  return { status: 'ok', sessionId: session.id };
}

// ── Lifecycle Handlers ──────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  logger.log('Extension installed/updated');
  purgeExpiredSessions().catch((err) =>
    logger.error('Purge on install failed:', err),
  );
});

chrome.runtime.onStartup.addListener(() => {
  purgeExpiredSessions().catch((err) =>
    logger.error('Purge on startup failed:', err),
  );
});

// Auto-stop if captured tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  const session = getSession();
  if (session && session.tabId === tabId) {
    logger.log('Captured tab closed, auto-stopping:', session.id);
    const stopped = stopCapture();
    if (stopped) {
      saveSession(stopped).catch((err) =>
        logger.error('Auto-save on tab close failed:', err),
      );
    }
  }
});

// Re-inject content script on hard navigation (full page load)
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  const session = getSession();
  if (!session || session.tabId !== details.tabId || session.status !== 'capturing') return;

  logger.log('Hard navigation detected, re-injecting content script:', details.url);

  chrome.scripting
    .executeScript({
      target: { tabId: details.tabId },
      files: ['src/content/index.js'],
    })
    .then(() => {
      // Message listener is registered synchronously in the content script —
      // no delay needed after executeScript resolves.
      sendTabMessage(details.tabId, {
        type: 'RESTORE_TOOLBAR',
        payload: {
          stepCount: session.steps.length,
          position: getToolbarPosition(),
        },
      }).catch((err) =>
        logger.error('RESTORE_TOOLBAR message failed:', err),
      );
    })
    .catch((err) => {
      logger.error('Re-injection on navigation failed:', err);
    });
});

// Relay SPA navigation to content script
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  const session = getSession();
  if (session && session.tabId === details.tabId && session.status === 'capturing') {
    sendTabMessage(details.tabId, {
      type: 'NAVIGATION_DETECTED',
      payload: {
        url: details.url,
        previousUrl: '', // Content script tracks its own previous URL
      },
    }).catch((err) =>
      logger.error('Navigation relay failed:', err),
    );
  }
});

logger.log('Service worker initialized');
