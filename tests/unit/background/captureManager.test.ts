import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock screenshotManager before importing captureManager
vi.mock('../../../src/background/screenshotManager', () => ({
  captureScreenshot: vi
    .fn()
    .mockResolvedValue('data:image/png;base64,screenshot'),
  resizeScreenshotSW: vi
    .fn()
    .mockResolvedValue('data:image/png;base64,resized'),
  createThumbnailSW: vi
    .fn()
    .mockResolvedValue('data:image/jpeg;base64,thumb'),
}));

vi.mock('../../../src/background/recoveryManager', () => ({
  saveSession: vi.fn().mockResolvedValue(undefined),
}));

import {
  transition,
  TRANSITIONS,
  startSession,
  getSession,
  setSession,
  stopCapture,
  cancelCapture,
  handleInteractionEvent,
  resolveDomSettle,
  generateSessionId,
  generateStepId,
  getToolbarPosition,
  setToolbarPosition,
  bufferPreClickScreenshot,
  clearPreClickBuffer,
  getPreClickBuffer,
  getQueuedEvent,
} from '../../../src/background/captureManager';

import type {
  SessionStatus,
  InteractionEvent,
  CaptureSession,
} from '../../../src/shared/types';

import {
  captureScreenshot,
  resizeScreenshotSW,
  createThumbnailSW,
} from '../../../src/background/screenshotManager';

// ── Helper Factories ────────────────────────────────────────────────

function makeInteractionEvent(
  overrides: Partial<InteractionEvent> = {},
): InteractionEvent {
  return {
    type: 'click',
    timestamp: Date.now(),
    url: 'https://example.com',
    element: {
      tagName: 'BUTTON',
      textContent: 'Submit',
      boundingRect: {
        x: 10,
        y: 20,
        width: 100,
        height: 40,
        top: 20,
        right: 110,
        bottom: 60,
        left: 10,
      },
      isInIframe: false,
    },
    ...overrides,
  };
}

function makeSession(
  overrides: Partial<CaptureSession> = {},
): CaptureSession {
  return {
    id: 'session-123',
    tabId: 42,
    status: 'capturing',
    title: 'Example',
    steps: [],
    startUrl: 'https://example.com',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('captureManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset session state between tests
    setSession(null);
    clearPreClickBuffer();
  });

  // ── State Machine ─────────────────────────────────────────────────

  describe('transition (state machine)', () => {
    it('should transition idle → capturing on START_CAPTURE', () => {
      expect(transition('idle', 'START_CAPTURE')).toBe('capturing');
    });

    it('should transition capturing → editing on STOP', () => {
      expect(transition('capturing', 'STOP')).toBe('editing');
    });

    it('should transition capturing → idle on CANCEL', () => {
      expect(transition('capturing', 'CANCEL')).toBe('idle');
    });

    it('should transition capturing → paused on PAUSE', () => {
      expect(transition('capturing', 'PAUSE')).toBe('paused');
    });

    it('should transition paused → capturing on RESUME', () => {
      expect(transition('paused', 'RESUME')).toBe('capturing');
    });

    it('should transition paused → idle on CANCEL', () => {
      expect(transition('paused', 'CANCEL')).toBe('idle');
    });

    it('should transition editing → done on EXPORT_READY', () => {
      expect(transition('editing', 'EXPORT_READY')).toBe('done');
    });

    it('should transition editing → done on EDITOR_CLOSED', () => {
      expect(transition('editing', 'EDITOR_CLOSED')).toBe('done');
    });

    it('should return null for invalid transitions', () => {
      expect(transition('idle', 'STOP')).toBeNull();
      expect(transition('done', 'START_CAPTURE')).toBeNull();
      expect(transition('editing', 'PAUSE')).toBeNull();
    });

    it('should have no transitions from done state', () => {
      expect(TRANSITIONS.done).toEqual({});
    });
  });

  // ── ID Generation ─────────────────────────────────────────────────

  describe('generateSessionId', () => {
    it('should return a string with "session-" prefix', () => {
      const id = generateSessionId();
      expect(id).toMatch(/^session-/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('generateStepId', () => {
    it('should return a string with "step-" prefix', () => {
      const id = generateStepId();
      expect(id).toMatch(/^step-/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateStepId()));
      expect(ids.size).toBe(100);
    });
  });

  // ── Session Lifecycle ─────────────────────────────────────────────

  describe('startSession', () => {
    it('should create a new session with correct fields', () => {
      const session = startSession(42, 'https://example.com', 'Example Page');
      expect(session.tabId).toBe(42);
      expect(session.status).toBe('capturing');
      expect(session.title).toBe('Example Page');
      expect(session.startUrl).toBe('https://example.com');
      expect(session.steps).toEqual([]);
      expect(session.id).toMatch(/^session-/);
    });

    it('should store the session so getSession returns it', () => {
      expect(getSession()).toBeNull();
      const session = startSession(42, 'https://example.com', 'Test');
      expect(getSession()).toBe(session);
    });
  });

  describe('getSession / setSession', () => {
    it('should return null when no session exists', () => {
      expect(getSession()).toBeNull();
    });

    it('should store and retrieve a session', () => {
      const session = makeSession();
      setSession(session);
      expect(getSession()).toBe(session);
    });

    it('should allow clearing session with null', () => {
      setSession(makeSession());
      setSession(null);
      expect(getSession()).toBeNull();
    });
  });

  describe('stopCapture', () => {
    it('should transition session to editing', () => {
      const session = makeSession({ status: 'capturing' });
      setSession(session);
      const result = stopCapture();
      expect(result).not.toBeNull();
      expect(result!.status).toBe('editing');
    });

    it('should set completedAt timestamp', () => {
      setSession(makeSession({ status: 'capturing' }));
      const result = stopCapture();
      expect(result!.completedAt).toBeTypeOf('number');
    });

    it('should return null if no session exists', () => {
      expect(stopCapture()).toBeNull();
    });

    it('should return null if session is not in capturing state', () => {
      setSession(makeSession({ status: 'idle' }));
      expect(stopCapture()).toBeNull();
    });

    it('should work from paused state', () => {
      setSession(makeSession({ status: 'paused' }));
      // Paused → CANCEL → idle is valid, but STOP from paused is not in transitions
      // We need to check if stopCapture handles paused state
      const result = stopCapture();
      // stopCapture uses transition('paused', 'STOP') which is not defined
      expect(result).toBeNull();
    });
  });

  describe('cancelCapture', () => {
    it('should clear the session', () => {
      setSession(makeSession({ status: 'capturing' }));
      cancelCapture();
      expect(getSession()).toBeNull();
    });

    it('should do nothing if no session exists', () => {
      expect(() => cancelCapture()).not.toThrow();
    });
  });

  // ── Screenshot Pipeline ───────────────────────────────────────────

  describe('handleInteractionEvent', () => {
    /** Schedule DOM settle resolution on next microtask (simulates content script response). */
    function autoSettle(): void {
      // sendTabMessage mock (HIDE_TOOLBAR) resolves on microtask, then waitForDomSettle starts.
      // We schedule resolveDomSettle slightly after to simulate content script responding.
      const origSendMessage = vi.mocked(chrome.tabs.sendMessage);
      origSendMessage.mockImplementation(async (_tabId, msg) => {
        if ((msg as { type: string }).type === 'HIDE_TOOLBAR') {
          // Settle shortly after the hide message is sent
          setTimeout(() => resolveDomSettle(), 0);
        }
        return { status: 'ok' };
      });
    }

    beforeEach(() => {
      // Set up a capturing session
      setSession(makeSession({ status: 'capturing' }));
      autoSettle();
    });

    it('should return null if session is not capturing', async () => {
      setSession(makeSession({ status: 'idle' }));
      const result = await handleInteractionEvent(makeInteractionEvent());
      expect(result).toBeNull();
    });

    it('should return null if no session exists', async () => {
      setSession(null);
      const result = await handleInteractionEvent(makeInteractionEvent());
      expect(result).toBeNull();
    });

    it('should call screenshot pipeline in correct order', async () => {
      const event = makeInteractionEvent();
      const step = await handleInteractionEvent(event);

      expect(step).not.toBeNull();
      // Should hide toolbar, capture, resize, thumbnail, then show toolbar
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ type: 'HIDE_TOOLBAR' }),
      );
      expect(captureScreenshot).toHaveBeenCalledWith(42);
      expect(resizeScreenshotSW).toHaveBeenCalled();
      expect(createThumbnailSW).toHaveBeenCalled();
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ type: 'SHOW_TOOLBAR' }),
      );
    });

    it('should create a CaptureStep with correct fields', async () => {
      const event = makeInteractionEvent();
      const step = await handleInteractionEvent(event);

      expect(step!.id).toMatch(/^step-/);
      expect(step!.stepNumber).toBe(1);
      expect(step!.screenshotDataUrl).toBe('data:image/png;base64,resized');
      expect(step!.thumbnailDataUrl).toBe('data:image/jpeg;base64,thumb');
      expect(step!.element).toBe(event.element);
      expect(step!.interaction).toBe(event);
      expect(step!.url).toBe(event.url);
    });

    it('should push step to session.steps', async () => {
      await handleInteractionEvent(makeInteractionEvent());
      const session = getSession();
      expect(session!.steps).toHaveLength(1);
    });

    it('should increment step numbers', async () => {
      const realNow = Date.now();
      const now = realNow;
      await handleInteractionEvent(makeInteractionEvent({ timestamp: now }));
      // Advance wall-clock to simulate real time passing between user actions
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(realNow + 1000);
      await handleInteractionEvent(makeInteractionEvent({ timestamp: now + 1000 }));
      dateNowSpy.mockRestore();
      const session = getSession();
      expect(session!.steps[0].stepNumber).toBe(1);
      expect(session!.steps[1].stepNumber).toBe(2);
    });

    it('should return null when step limit reached', async () => {
      const session = makeSession({
        steps: Array.from({ length: 100 }, (_, i) => ({
          id: `step-${i}`,
          stepNumber: i + 1,
          description: 'test',
          screenshotDataUrl: 'data:image/jpeg;base64,x',
          element: makeInteractionEvent().element,
          interaction: makeInteractionEvent(),
          timestamp: Date.now(),
          url: 'https://example.com',
        })),
      });
      setSession(session);

      const result = await handleInteractionEvent(makeInteractionEvent());
      expect(result).toBeNull();
    });

    it('should guard against concurrent pipeline execution', async () => {
      // First call will be pending
      const promise1 = handleInteractionEvent(makeInteractionEvent());
      // Second call should be dropped
      const promise2 = handleInteractionEvent(makeInteractionEvent());

      const [step1, step2] = await Promise.all([promise1, promise2]);
      expect(step1).not.toBeNull();
      expect(step2).toBeNull();
    });

    it('should generate a description for the step', async () => {
      const event = makeInteractionEvent({
        type: 'click',
        element: {
          tagName: 'BUTTON',
          textContent: 'Save',
          boundingRect: {
            x: 0,
            y: 0,
            width: 50,
            height: 30,
            top: 0,
            right: 50,
            bottom: 30,
            left: 0,
          },
          isInIframe: false,
        },
      });

      const step = await handleInteractionEvent(event);
      expect(step!.description).toBe("Clicked 'Save'");
    });
  });

  // ── Navigation Step Suppression ──────────────────────────────────

  describe('navigation step suppression', () => {
    function autoSettle(): void {
      const origSendMessage = vi.mocked(chrome.tabs.sendMessage);
      origSendMessage.mockImplementation(async (_tabId, msg) => {
        if ((msg as { type: string }).type === 'HIDE_TOOLBAR') {
          setTimeout(() => resolveDomSettle(), 0);
        }
        return { status: 'ok' };
      });
    }

    beforeEach(() => {
      setSession(makeSession({ status: 'capturing' }));
      autoSettle();
    });

    it('should suppress navigation event within 2s of the last step', async () => {
      const now = Date.now();
      const clickEvent = makeInteractionEvent({
        type: 'click',
        timestamp: now,
      });
      const step = await handleInteractionEvent(clickEvent);
      expect(step).not.toBeNull();
      expect(getSession()!.steps).toHaveLength(1);

      // Navigation event arrives 500ms after the click
      const navEvent = makeInteractionEvent({
        type: 'navigation',
        timestamp: now + 500,
      });
      const navStep = await handleInteractionEvent(navEvent);
      expect(navStep).toBeNull();
      expect(getSession()!.steps).toHaveLength(1);
    });

    it('should allow navigation event when no preceding step', async () => {
      expect(getSession()!.steps).toHaveLength(0);

      const navEvent = makeInteractionEvent({
        type: 'navigation',
        timestamp: Date.now(),
      });
      const step = await handleInteractionEvent(navEvent);
      expect(step).not.toBeNull();
      expect(getSession()!.steps).toHaveLength(1);
      expect(step!.interaction.type).toBe('navigation');
    });

    it('should allow navigation event when more than 2s after last step', async () => {
      const now = Date.now();
      const clickEvent = makeInteractionEvent({
        type: 'click',
        timestamp: now,
      });
      await handleInteractionEvent(clickEvent);
      expect(getSession()!.steps).toHaveLength(1);

      // Advance wall-clock to simulate real time passing
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now + 2500);
      // Navigation event arrives 2.5s after the click
      const navEvent = makeInteractionEvent({
        type: 'navigation',
        timestamp: now + 2500,
      });
      const step = await handleInteractionEvent(navEvent);
      dateNowSpy.mockRestore();
      expect(step).not.toBeNull();
      expect(getSession()!.steps).toHaveLength(2);
    });

    it('should suppress navigation event after a non-click interaction too', async () => {
      const now = Date.now();
      const inputEvent = makeInteractionEvent({
        type: 'input',
        timestamp: now,
      });
      await handleInteractionEvent(inputEvent);
      expect(getSession()!.steps).toHaveLength(1);

      // Navigation shortly after input (e.g., form auto-submit)
      const navEvent = makeInteractionEvent({
        type: 'navigation',
        timestamp: now + 300,
      });
      const navStep = await handleInteractionEvent(navEvent);
      expect(navStep).toBeNull();
      expect(getSession()!.steps).toHaveLength(1);
    });

    it('should suppress non-navigation event within 300ms of last step (general dedup)', async () => {
      const now = Date.now();
      const clickEvent = makeInteractionEvent({ type: 'click', timestamp: now });
      await handleInteractionEvent(clickEvent);
      expect(getSession()!.steps).toHaveLength(1);

      // Synthetic change event arrives 50ms later (same user action)
      const changeEvent = makeInteractionEvent({ type: 'change', timestamp: now + 50 });
      const changeStep = await handleInteractionEvent(changeEvent);
      expect(changeStep).toBeNull();
      expect(getSession()!.steps).toHaveLength(1);
    });

    it('should allow non-navigation event after 300ms dedup window', async () => {
      const now = Date.now();
      const clickEvent = makeInteractionEvent({ type: 'click', timestamp: now });
      await handleInteractionEvent(clickEvent);
      expect(getSession()!.steps).toHaveLength(1);

      // Advance wall-clock to simulate real time passing
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now + 500);
      // Next deliberate click arrives 500ms later
      const nextClick = makeInteractionEvent({ type: 'click', timestamp: now + 500 });
      const step = await handleInteractionEvent(nextClick);
      dateNowSpy.mockRestore();
      expect(step).not.toBeNull();
      expect(getSession()!.steps).toHaveLength(2);
    });

    it('should suppress change event arriving after pipeline completes even if DOM timestamps are >300ms apart', async () => {
      // Regression: dropdown click fires click at T, then change at T+350ms.
      // The pipeline takes ~400ms. The change event's DOM timestamp is >300ms
      // after the click's DOM timestamp, but should still be deduped because
      // the step was CREATED just moments ago (wall-clock).
      const now = Date.now();
      const clickEvent = makeInteractionEvent({ type: 'click', timestamp: now });
      await handleInteractionEvent(clickEvent);
      expect(getSession()!.steps).toHaveLength(1);

      // Change event fired 350ms after click in the DOM (outside old dedup window)
      // but arrives after the pipeline completes (wall-clock dedup should catch it)
      const changeEvent = makeInteractionEvent({ type: 'change', timestamp: now + 350 });
      const changeStep = await handleInteractionEvent(changeEvent);
      expect(changeStep).toBeNull();
      expect(getSession()!.steps).toHaveLength(1);
    });
  });

  // ── DOM Settle ────────────────────────────────────────────────────

  describe('resolveDomSettle', () => {
    it('should not throw when called without pending settle', () => {
      expect(() => resolveDomSettle()).not.toThrow();
    });
  });

  // ── Pre-Click Buffer ─────────────────────────────────────────────

  describe('bufferPreClickScreenshot', () => {
    /** Flush microtasks so the internal buffer promise completes. */
    async function flushBuffer(): Promise<void> {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }

    it('should store a buffer with dataUrl and timestamp', async () => {
      bufferPreClickScreenshot(42);
      await flushBuffer();
      const buffer = getPreClickBuffer();
      expect(buffer).not.toBeNull();
      expect(buffer!.dataUrl).toBe('data:image/png;base64,screenshot');
      expect(buffer!.timestamp).toBeTypeOf('number');
    });

    it('should set buffer to null if captureScreenshot fails', async () => {
      vi.mocked(captureScreenshot).mockRejectedValueOnce(new Error('Tab closed'));
      bufferPreClickScreenshot(42);
      await flushBuffer();
      expect(getPreClickBuffer()).toBeNull();
    });

    it('should be cleared by clearPreClickBuffer', async () => {
      bufferPreClickScreenshot(42);
      await flushBuffer();
      clearPreClickBuffer();
      expect(getPreClickBuffer()).toBeNull();
    });
  });

  describe('handleInteractionEvent with pre-click buffer', () => {
    beforeEach(() => {
      setSession(makeSession({ status: 'capturing' }));
    });

    it('should use buffered screenshot when buffer is fresh (pre-resolved)', async () => {
      // Pre-populate buffer by calling and flushing
      bufferPreClickScreenshot(42);
      // Flush the internal promise
      await Promise.resolve();
      await Promise.resolve();
      vi.mocked(captureScreenshot).mockClear();

      const step = await handleInteractionEvent(makeInteractionEvent());

      expect(step).not.toBeNull();
      // Should NOT have called HIDE_TOOLBAR or captureScreenshot
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalledWith(
        42,
        expect.objectContaining({ type: 'HIDE_TOOLBAR' }),
      );
      expect(captureScreenshot).not.toHaveBeenCalled();
      // Should still send SHOW_TOOLBAR
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ type: 'SHOW_TOOLBAR' }),
      );
      // Screenshot should come from the buffer (processed through resize)
      expect(resizeScreenshotSW).toHaveBeenCalledWith('data:image/png;base64,screenshot');
    });

    it('should await pending buffer and use it (race condition fix)', async () => {
      // This is the critical test: fire-and-forget buffer, then immediately
      // call handleInteractionEvent BEFORE the buffer resolves.
      bufferPreClickScreenshot(42);
      // Do NOT await — simulate the real race condition
      vi.mocked(captureScreenshot).mockClear();

      const step = await handleInteractionEvent(makeInteractionEvent());

      expect(step).not.toBeNull();
      // Should have awaited the pending buffer and used it
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalledWith(
        42,
        expect.objectContaining({ type: 'HIDE_TOOLBAR' }),
      );
      // captureScreenshot was called once (by bufferPreClickScreenshot, before we cleared the mock),
      // but NOT by the fallback pipeline
      expect(captureScreenshot).not.toHaveBeenCalled();
      expect(resizeScreenshotSW).toHaveBeenCalledWith('data:image/png;base64,screenshot');
    });

    it('should fall back to full pipeline when buffer is expired', async () => {
      // Manually set an expired buffer (> 2s old)
      bufferPreClickScreenshot(42);
      await Promise.resolve();
      await Promise.resolve();
      const buffer = getPreClickBuffer()!;
      // Mutate timestamp to make it expired
      Object.defineProperty(buffer, 'timestamp', { value: Date.now() - 3000, writable: true });

      vi.mocked(captureScreenshot).mockClear();

      // Need autoSettle for the fallback path
      vi.mocked(chrome.tabs.sendMessage).mockImplementation(async (_tabId, msg) => {
        if ((msg as { type: string }).type === 'HIDE_TOOLBAR') {
          setTimeout(() => resolveDomSettle(), 0);
        }
        return { status: 'ok' };
      });

      const step = await handleInteractionEvent(makeInteractionEvent());

      expect(step).not.toBeNull();
      // Should have used the full pipeline
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ type: 'HIDE_TOOLBAR' }),
      );
      expect(captureScreenshot).toHaveBeenCalledWith(42);
    });

    it('should clear buffer after use', async () => {
      bufferPreClickScreenshot(42);
      await handleInteractionEvent(makeInteractionEvent());
      expect(getPreClickBuffer()).toBeNull();
    });

    it('should clear buffer even when falling back', async () => {
      // Set an expired buffer
      bufferPreClickScreenshot(42);
      await Promise.resolve();
      await Promise.resolve();
      const buffer = getPreClickBuffer()!;
      Object.defineProperty(buffer, 'timestamp', { value: Date.now() - 3000, writable: true });

      vi.mocked(chrome.tabs.sendMessage).mockImplementation(async (_tabId, msg) => {
        if ((msg as { type: string }).type === 'HIDE_TOOLBAR') {
          setTimeout(() => resolveDomSettle(), 0);
        }
        return { status: 'ok' };
      });

      await handleInteractionEvent(makeInteractionEvent());
      expect(getPreClickBuffer()).toBeNull();
    });
  });

  // ── Toolbar Position ──────────────────────────────────────────────

  describe('toolbar position state', () => {
    it('should default to null', () => {
      expect(getToolbarPosition()).toBeNull();
    });

    it('should store and retrieve position', () => {
      setToolbarPosition({ x: 100, y: 200 });
      expect(getToolbarPosition()).toEqual({ x: 100, y: 200 });
      // Clean up
      setToolbarPosition(null);
    });

    it('should clear position with null', () => {
      setToolbarPosition({ x: 50, y: 75 });
      setToolbarPosition(null);
      expect(getToolbarPosition()).toBeNull();
    });

    it('should clear position when capture is cancelled', () => {
      setSession(makeSession({ status: 'capturing' }));
      setToolbarPosition({ x: 300, y: 150 });
      cancelCapture();
      expect(getToolbarPosition()).toBeNull();
    });
  });

  // ── Single-Slot Event Queue ─────────────────────────────────────────

  describe('single-slot event queue', () => {
    function autoSettle(): void {
      const origSendMessage = vi.mocked(chrome.tabs.sendMessage);
      origSendMessage.mockImplementation(async (_tabId, msg) => {
        if ((msg as { type: string }).type === 'HIDE_TOOLBAR') {
          setTimeout(() => resolveDomSettle(), 0);
        }
        return { status: 'ok' };
      });
    }

    beforeEach(() => {
      setSession(makeSession({ status: 'capturing' }));
      autoSettle();
    });

    it('should queue click event when input pipeline is busy and process it after', async () => {
      const now = Date.now();

      // Start the input pipeline — it will be "busy"
      const inputPromise = handleInteractionEvent(
        makeInteractionEvent({ type: 'input', timestamp: now }),
      );

      // While input pipeline is running, a click arrives (600ms later in DOM time,
      // well outside the 300ms dedup window)
      const clickEvent = makeInteractionEvent({ type: 'click', timestamp: now + 600 });
      const clickResult = await handleInteractionEvent(clickEvent);

      // Immediate return is null (queued, not dropped)
      expect(clickResult).toBeNull();
      expect(getQueuedEvent()).toBe(clickEvent);

      // Input pipeline finishes — the finally block fires the deferred click.
      // Queued events use fromQueue flag, so wall-clock dedup is skipped.
      // The DOM timestamp gap (600ms > 300ms) means it passes dedup.
      const inputStep = await inputPromise;
      expect(inputStep).not.toBeNull();

      // Flush the fire-and-forget deferred processing
      await vi.waitFor(() => {
        expect(getSession()!.steps).toHaveLength(2);
      });

      // Both steps created: input then click
      expect(getSession()!.steps[0].interaction.type).toBe('input');
      expect(getSession()!.steps[1].interaction.type).toBe('click');
    });

    it('should replace queued event with higher-priority one', async () => {
      const now = Date.now();

      // Start a pipeline
      const promise = handleInteractionEvent(
        makeInteractionEvent({ type: 'click', timestamp: now }),
      );

      // Queue a navigation (priority 1)
      const navEvent = makeInteractionEvent({ type: 'navigation', timestamp: now + 100 });
      await handleInteractionEvent(navEvent);
      expect(getQueuedEvent()).toBe(navEvent);

      // Queue a click (priority 4) — should replace navigation
      const clickEvent = makeInteractionEvent({ type: 'click', timestamp: now + 200 });
      await handleInteractionEvent(clickEvent);
      expect(getQueuedEvent()).toBe(clickEvent);

      await promise;
    });

    it('should not replace queued event with lower-priority one', async () => {
      const now = Date.now();

      // Start a pipeline
      const promise = handleInteractionEvent(
        makeInteractionEvent({ type: 'click', timestamp: now }),
      );

      // Queue a click (priority 4)
      const clickEvent = makeInteractionEvent({ type: 'click', timestamp: now + 100 });
      await handleInteractionEvent(clickEvent);
      expect(getQueuedEvent()).toBe(clickEvent);

      // Try to queue a scroll (priority 0) — should NOT replace click
      const scrollEvent = makeInteractionEvent({ type: 'scroll', timestamp: now + 200 });
      await handleInteractionEvent(scrollEvent);
      expect(getQueuedEvent()).toBe(clickEvent);

      await promise;
    });

    it('should dedup queued event if within DOM dedup window', async () => {
      const now = Date.now();

      // First click creates a step
      const step1 = await handleInteractionEvent(
        makeInteractionEvent({ type: 'click', timestamp: now }),
      );
      expect(step1).not.toBeNull();

      // Start a second click pipeline (beyond dedup window)
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now + 500);
      const promise2 = handleInteractionEvent(
        makeInteractionEvent({ type: 'click', timestamp: now + 500 }),
      );

      // Queue a change event within 300ms DOM dedup window of the second click.
      // When the deferred event runs with fromQueue, it only checks DOM timestamps.
      // 600 - 500 = 100ms < 300ms dedup window → should be deduped.
      const changeEvent = makeInteractionEvent({ type: 'change', timestamp: now + 600 });
      await handleInteractionEvent(changeEvent);
      expect(getQueuedEvent()).toBe(changeEvent);

      await promise2;

      // Flush deferred processing — the change should be deduped by DOM timestamp
      await new Promise((r) => setTimeout(r, 50));
      dateNowSpy.mockRestore();

      // Only 2 steps: original click + second click (change was deduped)
      expect(getSession()!.steps).toHaveLength(2);
    });

    it('should clear queued event on session cancel', async () => {
      const now = Date.now();

      // Start a pipeline
      const promise = handleInteractionEvent(
        makeInteractionEvent({ type: 'click', timestamp: now }),
      );

      // Queue an event
      const inputEvent = makeInteractionEvent({ type: 'input', timestamp: now + 100 });
      await handleInteractionEvent(inputEvent);
      expect(getQueuedEvent()).toBe(inputEvent);

      // Cancel session — should clear queue
      cancelCapture();
      expect(getQueuedEvent()).toBeNull();

      await promise;

      // Flush any deferred processing — nothing should happen since session is null
      await new Promise((r) => setTimeout(r, 50));
      expect(getSession()).toBeNull();
    });
  });
});
