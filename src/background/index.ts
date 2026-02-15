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
  ensureSession,
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
  (message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message, sendResponse);
    return true; // All handlers are async (ensureSession awaits storage)
  },
);

async function handleMessage(
  msg: ExtensionMessage,
  sendResponse: (response?: unknown) => void,
): Promise<void> {
  try {
    // Lazy restore: if the SW restarted and currentSession was lost,
    // rehydrate from chrome.storage.local before any handler runs.
    await ensureSession();

    switch (msg.type) {
      case 'START_CAPTURE': {
        const result = await handleStartCapture(msg.payload.tabId);
        sendResponse(result);
        break;
      }

      case 'TAKE_SCREENSHOT': {
        const result = await handleTakeScreenshot(msg.payload.tabId);
        sendResponse(result);
        break;
      }

      case 'STOP_CAPTURE': {
        const result = await handleStopCapture();
        sendResponse(result);
        break;
      }

      case 'CANCEL_CAPTURE':
        handleCancelCapture();
        sendResponse({ status: 'ok' });
        break;

      case 'INTERACTION_EVENT': {
        const step = await handleInteractionEvent(msg.payload.event);
        if (step) {
          const session = getSession();
          if (session) {
            saveSession(session).catch((err) =>
              logger.error('Auto-save failed:', err),
            );
          }
        }
        sendResponse({ status: 'ok', stepId: step?.id ?? null });
        break;
      }

      case 'DOM_SETTLED':
        resolveDomSettle();
        sendResponse({ status: 'ok' });
        break;

      case 'HEARTBEAT':
        sendResponse({ status: 'ok' });
        break;

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
        break;
      }

      case 'GET_STEP_SCREENSHOT': {
        const session = getSession();
        const step = session?.steps.find((s) => s.id === msg.payload.stepId);
        sendResponse({
          status: 'ok',
          screenshotDataUrl: step?.screenshotDataUrl ?? null,
          thumbnailDataUrl: step?.thumbnailDataUrl ?? null,
        });
        break;
      }

      case 'PRE_CLICK_BUFFER': {
        const session = getSession();
        if (session?.status === 'capturing') {
          bufferPreClickScreenshot(session.tabId);
          const pending = getPreClickBufferPending();
          if (pending) await pending;
        }
        sendResponse({ status: 'ok' });
        break;
      }

      case 'UPDATE_STEP_DESCRIPTION': {
        const session = getSession();
        const step = session?.steps.find((s) => s.id === msg.payload.stepId);
        if (!step) {
          sendResponse({ status: 'error', error: 'Step not found' });
          break;
        }
        step.description = msg.payload.description;
        if (session) {
          session.updatedAt = Date.now();
          saveSession(session).catch((err) =>
            logger.error('Save after description update failed:', err),
          );
        }
        sendResponse({ status: 'ok' });
        break;
      }

      case 'UPDATE_STEP_ANNOTATIONS': {
        const session = getSession();
        const step = session?.steps.find((s) => s.id === msg.payload.stepId);
        if (!step) {
          sendResponse({ status: 'error', error: 'Step not found' });
          break;
        }
        step.annotations = msg.payload.annotations;
        if (session) {
          session.updatedAt = Date.now();
          saveSession(session).catch((err) =>
            logger.error('Save after annotations update failed:', err),
          );
        }
        sendResponse({ status: 'ok' });
        break;
      }

      case 'UPDATE_STEP_SCREENSHOT': {
        const session = getSession();
        const step = session?.steps.find((s) => s.id === msg.payload.stepId);
        if (!step) {
          sendResponse({ status: 'error', error: 'Step not found' });
          break;
        }
        step.screenshotDataUrl = msg.payload.screenshotDataUrl;
        if (session) {
          session.updatedAt = Date.now();
          saveSession(session).catch((err) =>
            logger.error('Save after screenshot update failed:', err),
          );
        }
        sendResponse({ status: 'ok' });
        break;
      }

      case 'REORDER_STEPS': {
        const session = getSession();
        if (!session) {
          sendResponse({ status: 'error', error: 'No session' });
          break;
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
        break;
      }

      case 'DELETE_STEP': {
        const session = getSession();
        if (!session) {
          sendResponse({ status: 'error', error: 'No session' });
          break;
        }
        const idx = session.steps.findIndex((s) => s.id === msg.payload.stepId);
        if (idx === -1) {
          sendResponse({ status: 'error', error: 'Step not found' });
          break;
        }
        session.steps.splice(idx, 1);
        // Renumber remaining steps
        session.steps.forEach((s, i) => { s.stepNumber = i + 1; });
        session.updatedAt = Date.now();
        saveSession(session).catch((err) =>
          logger.error('Save after step deletion failed:', err),
        );
        sendResponse({ status: 'ok' });
        break;
      }

      case 'EXPORT_COMPLETE':
        await clearRecoveryData();
        sendResponse({ status: 'ok' });
        break;

      case 'SAVE_TOOLBAR_POSITION':
        setToolbarPosition(msg.payload);
        sendResponse({ status: 'ok' });
        break;

      case 'PAUSE_CAPTURE':
        sendResponse({ status: 'not_implemented' });
        break;

      case 'RESUME_CAPTURE':
        sendResponse({ status: 'not_implemented' });
        break;

      default:
        logger.warn('Unknown message type:', (msg as { type: string }).type);
        sendResponse({ status: 'unknown_message' });
        break;
    }
  } catch (err) {
    logger.error(`Message handler failed for ${msg.type}:`, err);
    sendResponse({ status: 'error', error: String(err) });
  }
}

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
