import type {
  SessionStatus,
  CaptureSession,
  CaptureStep,
  InteractionEvent,
} from '../shared/types';
import { MAX_STEPS, MUTATION_MAX_WAIT } from '../shared/constants';
import { generateDescription } from '../shared/descriptionGenerator';
import { sendTabMessage } from '../shared/messaging';
import {
  captureScreenshot,
  resizeScreenshotSW,
  createThumbnailSW,
} from './screenshotManager';
import { saveSession, restoreSession } from './recoveryManager';

// ── State Machine ───────────────────────────────────────────────────

type Action =
  | 'START_CAPTURE'
  | 'STOP'
  | 'CANCEL'
  | 'PAUSE'
  | 'RESUME'
  | 'EXPORT_READY'
  | 'EDITOR_CLOSED';

export const TRANSITIONS: Record<SessionStatus, Partial<Record<Action, SessionStatus>>> = {
  idle: { START_CAPTURE: 'capturing' },
  capturing: { STOP: 'editing', CANCEL: 'idle', PAUSE: 'paused' },
  paused: { RESUME: 'capturing', CANCEL: 'idle' },
  editing: { EXPORT_READY: 'done', EDITOR_CLOSED: 'done' },
  done: {},
};

/** Pure state machine transition. Returns new status or null if invalid. */
export function transition(current: SessionStatus, action: Action): SessionStatus | null {
  return TRANSITIONS[current][action] ?? null;
}

// ── Session State ───────────────────────────────────────────────────

let currentSession: CaptureSession | null = null;
let toolbarPosition: { x: number; y: number } | null = null;

export function getSession(): CaptureSession | null {
  return currentSession;
}

export function setSession(session: CaptureSession | null): void {
  currentSession = session;
  if (!session) {
    lastStepCreatedAt = 0;
    queuedEvent = null;
  }
}

/**
 * Lazy session restore: returns the in-memory session if available,
 * otherwise rehydrates from chrome.storage.local (survives SW termination).
 */
export async function ensureSession(): Promise<CaptureSession | null> {
  if (currentSession) return currentSession;
  const restored = await restoreSession();
  if (restored) {
    currentSession = restored;
  }
  return currentSession;
}

export function getToolbarPosition(): { x: number; y: number } | null {
  return toolbarPosition;
}

export function setToolbarPosition(pos: { x: number; y: number } | null): void {
  toolbarPosition = pos;
}

// ── ID Generation ───────────────────────────────────────────────────

let idCounter = 0;

export function generateSessionId(): string {
  return `session-${Date.now()}-${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function generateStepId(): string {
  return `step-${Date.now()}-${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ── Session Lifecycle ───────────────────────────────────────────────

export function startSession(
  tabId: number,
  url: string,
  title: string,
): CaptureSession {
  const now = Date.now();
  const session: CaptureSession = {
    id: generateSessionId(),
    tabId,
    status: 'capturing',
    title,
    mode: 'workflow',
    steps: [],
    startUrl: url,
    startedAt: now,
    updatedAt: now,
  };
  currentSession = session;
  lastStepCreatedAt = 0;
  return session;
}

/** Create a 1-step session directly in 'editing' status (screenshot mode). */
export function startScreenshotSession(
  tabId: number,
  url: string,
  title: string,
  screenshotDataUrl: string,
  thumbnailDataUrl: string,
): CaptureSession {
  const now = Date.now();
  const step: CaptureStep = {
    id: generateStepId(),
    stepNumber: 1,
    description: title || 'Screenshot',
    screenshotDataUrl,
    thumbnailDataUrl,
    element: {
      tagName: 'BODY',
      boundingRect: { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 },
      isInIframe: false,
    },
    interaction: {
      type: 'click',
      timestamp: now,
      url,
      element: {
        tagName: 'BODY',
        boundingRect: { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 },
        isInIframe: false,
      },
    },
    timestamp: now,
    url,
  };

  const session: CaptureSession = {
    id: generateSessionId(),
    tabId,
    status: 'editing',
    title: title || 'Screenshot',
    mode: 'screenshot',
    steps: [step],
    startUrl: url,
    startedAt: now,
    updatedAt: now,
  };
  currentSession = session;
  return session;
}

export function stopCapture(): CaptureSession | null {
  if (!currentSession) return null;
  const newStatus = transition(currentSession.status, 'STOP');
  if (!newStatus) return null;

  currentSession.status = newStatus;
  currentSession.completedAt = Date.now();
  currentSession.updatedAt = Date.now();
  return currentSession;
}

export function cancelCapture(): void {
  currentSession = null;
  toolbarPosition = null;
  lastStepCreatedAt = 0;
  queuedEvent = null;
}

// ── DOM Settle Promise ──────────────────────────────────────────────

let settleResolve: (() => void) | null = null;

/** Called by the message router when DOM_SETTLED arrives from content script. */
export function resolveDomSettle(): void {
  if (settleResolve) {
    settleResolve();
    settleResolve = null;
  }
}

function waitForDomSettle(): Promise<void> {
  return new Promise<void>((resolve) => {
    settleResolve = resolve;
    // Timeout fallback — don't wait forever
    setTimeout(() => {
      if (settleResolve === resolve) {
        settleResolve = null;
        resolve();
      }
    }, MUTATION_MAX_WAIT);
  });
}

// ── Pre-Click Buffer ────────────────────────────────────────────────

const PRE_CLICK_BUFFER_MAX_AGE = 2_000; // 2 seconds

let preClickBuffer: { dataUrl: string; timestamp: number } | null = null;
let preClickBufferPending: Promise<void> | null = null;

/** Capture a screenshot immediately and store it as the pre-click buffer. */
export function bufferPreClickScreenshot(tabId: number): void {
  // Store the promise so handleInteractionEvent can await it
  preClickBufferPending = (async () => {
    try {
      const dataUrl = await captureScreenshot(tabId);
      preClickBuffer = { dataUrl, timestamp: Date.now() };
    } catch {
      // Capture can fail if tab navigated — silently discard
      preClickBuffer = null;
    } finally {
      preClickBufferPending = null;
    }
  })();
}

export function clearPreClickBuffer(): void {
  preClickBuffer = null;
  preClickBufferPending = null;
}

export function getPreClickBufferPending(): Promise<void> | null {
  return preClickBufferPending;
}

export function getPreClickBuffer(): { dataUrl: string; timestamp: number } | null {
  return preClickBuffer;
}

/** Exposed for testing only. */
export function getQueuedEvent(): InteractionEvent | null {
  return queuedEvent;
}

// ── Dedup / Suppression ─────────────────────────────────────────────

/** General dedup window: suppress ANY event too close to the last step.
 *  Covers: label→input synthetic clicks, click+change on checkboxes,
 *  SPA navigation after click, etc. */
const STEP_DEDUP_WINDOW = 300; // ms

/** Wider window for navigation events (which round-trip through content script). */
const NAV_SUPPRESS_WINDOW = 2_000; // 2 seconds

/** Wall-clock time when the last step was created.
 *  Used alongside event timestamps for dedup — the pipeline is async so
 *  a second event's DOM timestamp may be outside the dedup window even
 *  though the pipeline only just finished creating the previous step. */
let lastStepCreatedAt = 0;

// ── Screenshot Pipeline ─────────────────────────────────────────────

let pendingInteraction = false;

// Priority: higher number = more important user action
const EVENT_PRIORITY: Record<string, number> = {
  click: 4,
  change: 3,
  input: 2,
  keypress: 2,
  navigation: 1,
  scroll: 0,
};

/** Single-slot queue: holds at most one event while the pipeline is busy. */
let queuedEvent: InteractionEvent | null = null;

export async function handleInteractionEvent(
  event: InteractionEvent,
  options?: { fromQueue?: boolean },
): Promise<CaptureStep | null> {
  // Guard: no session or wrong state
  if (!currentSession || currentSession.status !== 'capturing') {
    return null;
  }

  // Guard: step limit reached
  if (currentSession.steps.length >= MAX_STEPS) {
    return null;
  }

  // Dedup: suppress events too close to the last created step.
  // A single user action can fire multiple DOM events (click+change,
  // label→input synthetic click, click→navigation). Only the first
  // event should create a step.
  //
  // We check BOTH the DOM event timestamp gap AND the wall-clock gap
  // since the pipeline finished. The pipeline is async — a second
  // event may fire >300ms after the first in DOM time but arrive
  // immediately after the pipeline completes (e.g., dropdown click
  // fires click then change 350ms later, but pipeline takes 400ms).
  //
  // Queued events skip wall-clock dedup: they were intentionally deferred
  // while the pipeline was busy, so wall-clock proximity to the previous
  // step is expected. DOM timestamps still reflect actual user action timing.
  if (currentSession.steps.length > 0) {
    const lastStep = currentSession.steps[currentSession.steps.length - 1];
    const elapsedDom = event.timestamp - lastStep.timestamp;
    const dedupWindow = event.type === 'navigation' ? NAV_SUPPRESS_WINDOW : STEP_DEDUP_WINDOW;

    if (options?.fromQueue) {
      // Queued events: only check DOM timestamp gap
      if (elapsedDom < dedupWindow) {
        return null;
      }
    } else {
      // Normal events: check both DOM and wall-clock gaps
      const elapsedWall = Date.now() - lastStepCreatedAt;
      if (elapsedDom < dedupWindow || elapsedWall < dedupWindow) {
        return null;
      }
    }
  }

  // Concurrency guard: queue at most one event while the pipeline is busy.
  // The deferred event will be processed after the current pipeline finishes.
  if (pendingInteraction) {
    const newPriority = EVENT_PRIORITY[event.type] ?? 0;
    const existingPriority = queuedEvent ? (EVENT_PRIORITY[queuedEvent.type] ?? 0) : -1;
    if (newPriority >= existingPriority) {
      queuedEvent = event;
    }
    return null;
  }

  pendingInteraction = true;

  try {
    const { tabId } = currentSession;

    // Wait for any in-flight buffer capture to complete
    if (preClickBufferPending) {
      await preClickBufferPending;
    }

    // Check for a fresh pre-click buffer
    const buffer = preClickBuffer;
    const bufferFresh = buffer !== null && (Date.now() - buffer.timestamp) < PRE_CLICK_BUFFER_MAX_AGE;
    preClickBuffer = null; // Always consume/clear

    let rawScreenshot: string;

    if (bufferFresh) {
      // Use the buffered screenshot — toolbar was already hidden at mousedown time
      rawScreenshot = buffer!.dataUrl;
      // Send SHOW_TOOLBAR to increment step count — non-fatal because the
      // content script may have been destroyed by a navigation click.
      // The onCommitted handler will re-inject and RESTORE_TOOLBAR with
      // the correct step count.
      await sendTabMessage(tabId, { type: 'SHOW_TOOLBAR', payload: {} }).catch(() => {});
    } else {
      // Fall back to full pipeline: hide → settle → capture → show
      // If HIDE_TOOLBAR fails (content script gone due to navigation),
      // we still attempt capture — the screenshot may show the new page,
      // which is acceptable for a navigation step.
      await sendTabMessage(tabId, { type: 'HIDE_TOOLBAR', payload: {} }).catch(() => {});
      await waitForDomSettle();
      rawScreenshot = await captureScreenshot(tabId);
      await sendTabMessage(tabId, { type: 'SHOW_TOOLBAR', payload: {} }).catch(() => {});
    }

    const resized = await resizeScreenshotSW(rawScreenshot);
    const thumbnail = await createThumbnailSW(rawScreenshot);

    // Session may have been cancelled while the pipeline was running
    if (!currentSession || currentSession.status !== 'capturing') {
      return null;
    }

    // 5. Generate description
    const description = generateDescription(event);

    // 6. Create step
    const step: CaptureStep = {
      id: generateStepId(),
      stepNumber: currentSession.steps.length + 1,
      description,
      screenshotDataUrl: resized,
      thumbnailDataUrl: thumbnail,
      element: event.element,
      interaction: event,
      timestamp: event.timestamp,
      url: event.url,
    };

    // 7. Push to session
    currentSession.steps.push(step);
    currentSession.updatedAt = Date.now();
    lastStepCreatedAt = Date.now();

    return step;
  } finally {
    pendingInteraction = false;

    // Process queued event (if any) now that the pipeline is free.
    // Grab-and-clear atomically to prevent re-entrancy issues.
    const deferred = queuedEvent;
    queuedEvent = null;

    if (deferred) {
      // Fire-and-forget: re-enter handleInteractionEvent with full guard checks.
      // This runs synchronously until the first await, so pendingInteraction
      // will be set to true before any other event can interleave.
      // fromQueue skips wall-clock dedup (expected to be close to the previous step).
      handleInteractionEvent(deferred, { fromQueue: true })
        .then((step) => {
          if (step && currentSession) {
            saveSession(currentSession).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }
}
