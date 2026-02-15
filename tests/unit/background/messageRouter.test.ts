import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before import
vi.mock('../../../src/background/screenshotManager', () => ({
  captureScreenshot: vi.fn().mockResolvedValue('data:image/png;base64,screenshot'),
  resizeScreenshotSW: vi.fn().mockResolvedValue('data:image/png;base64,resized'),
  createThumbnailSW: vi.fn().mockResolvedValue('data:image/jpeg;base64,thumb'),
}));

vi.mock('../../../src/background/recoveryManager', () => ({
  saveSession: vi.fn().mockResolvedValue(undefined),
  clearRecoveryData: vi.fn().mockResolvedValue(undefined),
  purgeExpiredSessions: vi.fn().mockResolvedValue(undefined),
  restoreSession: vi.fn().mockResolvedValue(null),
}));

import { setSession, getSession, setToolbarPosition, getToolbarPosition, bufferPreClickScreenshot, getPreClickBufferPending } from '../../../src/background/captureManager';
import { captureScreenshot, resizeScreenshotSW, createThumbnailSW } from '../../../src/background/screenshotManager';
import { saveSession, restoreSession } from '../../../src/background/recoveryManager';
import type { CaptureSession } from '../../../src/shared/types';

// Import to register the listener
import '../../../src/background/index';

function makeSession(overrides: Partial<CaptureSession> = {}): CaptureSession {
  return {
    id: 'session-1',
    tabId: 1,
    status: 'editing',
    title: 'Test',
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        description: 'Original description',
        screenshotDataUrl: 'data:image/png;base64,abc',
        element: {
          tagName: 'BUTTON',
          boundingRect: { x: 0, y: 0, width: 100, height: 40, top: 0, right: 100, bottom: 40, left: 0 },
          isInIframe: false,
        },
        interaction: {
          type: 'click',
          timestamp: Date.now(),
          url: 'https://example.com',
          element: {
            tagName: 'BUTTON',
            boundingRect: { x: 0, y: 0, width: 100, height: 40, top: 0, right: 100, bottom: 40, left: 0 },
            isInIframe: false,
          },
        },
        timestamp: Date.now(),
        url: 'https://example.com',
      },
    ],
    startUrl: 'https://example.com',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/** Get the onMessage listener registered by the background module. */
function getMessageListener(): (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void,
) => boolean | void {
  const calls = (chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>).mock.calls;
  // Return the last registered listener (the one from background/index.ts)
  return calls[calls.length - 1][0];
}

// Cache listeners at module level — clearAllMocks would wipe mock.calls
const cachedMessageListener = getMessageListener();

function getOnCommittedListener(): (details: { tabId: number; frameId: number; url: string }) => void {
  const calls = (chrome.webNavigation.onCommitted.addListener as ReturnType<typeof vi.fn>).mock.calls;
  return calls[calls.length - 1][0];
}
const cachedOnCommittedListener = getOnCommittedListener();

/** Send a message through the router and return the response (async). */
async function routeMessage(message: unknown): Promise<unknown> {
  return new Promise<unknown>((resolve) => {
    cachedMessageListener(message, {}, resolve);
  });
}

describe('SW message router — editor messages', () => {
  beforeEach(() => {
    // Reset specific mocks (not clearAllMocks — that wipes addListener.mock.calls)
    vi.mocked(restoreSession).mockReset().mockResolvedValue(null);
    vi.mocked(saveSession).mockReset().mockResolvedValue(undefined);
    vi.mocked(captureScreenshot).mockReset().mockResolvedValue('data:image/png;base64,screenshot');
    vi.mocked(resizeScreenshotSW).mockReset().mockResolvedValue('data:image/png;base64,resized');
    vi.mocked(createThumbnailSW).mockReset().mockResolvedValue('data:image/jpeg;base64,thumb');
    setSession(null);
    setToolbarPosition(null);
  });

  describe('UPDATE_STEP_DESCRIPTION', () => {
    it('updates description for existing step', async () => {
      setSession(makeSession());
      const response = await routeMessage(
        { type: 'UPDATE_STEP_DESCRIPTION', payload: { stepId: 'step-1', description: 'New desc' } },
      );

      expect(response).toEqual({ status: 'ok' });
      expect(getSession()!.steps[0].description).toBe('New desc');
    });

    it('returns error for non-existent step', async () => {
      setSession(makeSession());
      const response = await routeMessage(
        { type: 'UPDATE_STEP_DESCRIPTION', payload: { stepId: 'no-such-step', description: 'x' } },
      );

      expect(response).toEqual(
        expect.objectContaining({ status: 'error' }),
      );
    });
  });

  describe('UPDATE_STEP_ANNOTATIONS', () => {
    it('updates annotations for existing step', async () => {
      setSession(makeSession());
      const response = await routeMessage(
        { type: 'UPDATE_STEP_ANNOTATIONS', payload: { stepId: 'step-1', annotations: '{"objects":[]}' } },
      );

      expect(response).toEqual({ status: 'ok' });
      expect(getSession()!.steps[0].annotations).toBe('{"objects":[]}');
    });

    it('returns error for non-existent step', async () => {
      setSession(makeSession());
      const response = await routeMessage(
        { type: 'UPDATE_STEP_ANNOTATIONS', payload: { stepId: 'nope', annotations: '{}' } },
      );

      expect(response).toEqual(
        expect.objectContaining({ status: 'error' }),
      );
    });
  });

  describe('SAVE_TOOLBAR_POSITION', () => {
    it('stores toolbar position via captureManager', async () => {
      const response = await routeMessage(
        { type: 'SAVE_TOOLBAR_POSITION', payload: { x: 150, y: 30 } },
      );

      expect(response).toEqual({ status: 'ok' });
      expect(getToolbarPosition()).toEqual({ x: 150, y: 30 });
    });

    it('overwrites previous position', async () => {
      setToolbarPosition({ x: 10, y: 20 });
      const response = await routeMessage(
        { type: 'SAVE_TOOLBAR_POSITION', payload: { x: 400, y: 60 } },
      );

      expect(response).toEqual({ status: 'ok' });
      expect(getToolbarPosition()).toEqual({ x: 400, y: 60 });
    });
  });

  describe('PRE_CLICK_BUFFER', () => {
    it('calls bufferPreClickScreenshot when capturing', async () => {
      setSession(makeSession({ status: 'capturing', tabId: 42 }));
      const response = await routeMessage(
        { type: 'PRE_CLICK_BUFFER', payload: { timestamp: Date.now() } },
      );

      expect(response).toEqual({ status: 'ok' });
    });

    it('does not buffer when not capturing', async () => {
      setSession(makeSession({ status: 'editing', tabId: 42 }));

      vi.mocked(captureScreenshot).mockClear();

      const response = await routeMessage(
        { type: 'PRE_CLICK_BUFFER', payload: { timestamp: Date.now() } },
      );

      expect(response).toEqual({ status: 'ok' });
      expect(captureScreenshot).not.toHaveBeenCalled();
    });

    it('does not buffer when no session exists', async () => {
      setSession(null);

      vi.mocked(captureScreenshot).mockClear();

      const response = await routeMessage(
        { type: 'PRE_CLICK_BUFFER', payload: { timestamp: Date.now() } },
      );

      expect(response).toEqual({ status: 'ok' });
      expect(captureScreenshot).not.toHaveBeenCalled();
    });
  });

  describe('UPDATE_STEP_SCREENSHOT', () => {
    it('updates screenshot for existing step', async () => {
      setSession(makeSession());
      const response = await routeMessage(
        { type: 'UPDATE_STEP_SCREENSHOT', payload: { stepId: 'step-1', screenshotDataUrl: 'data:image/png;base64,cropped' } },
      );

      expect(response).toEqual({ status: 'ok' });
      expect(getSession()!.steps[0].screenshotDataUrl).toBe('data:image/png;base64,cropped');
    });

    it('returns error for non-existent step', async () => {
      setSession(makeSession());
      const response = await routeMessage(
        { type: 'UPDATE_STEP_SCREENSHOT', payload: { stepId: 'no-such-step', screenshotDataUrl: 'data:image/png;base64,x' } },
      );

      expect(response).toEqual(
        expect.objectContaining({ status: 'error' }),
      );
    });
  });

  describe('REORDER_STEPS', () => {
    it('reorders steps according to provided stepIds', async () => {
      const session = makeSession();
      session.steps.push({
        id: 'step-2',
        stepNumber: 2,
        description: 'Second step',
        screenshotDataUrl: 'data:image/png;base64,def',
        element: session.steps[0].element,
        interaction: session.steps[0].interaction,
        timestamp: Date.now(),
        url: 'https://example.com',
      });
      setSession(session);

      const response = await routeMessage(
        { type: 'REORDER_STEPS', payload: { stepIds: ['step-2', 'step-1'] } },
      );

      expect(response).toEqual({ status: 'ok' });
      const updated = getSession()!;
      expect(updated.steps[0].id).toBe('step-2');
      expect(updated.steps[1].id).toBe('step-1');
      // Renumbered
      expect(updated.steps[0].stepNumber).toBe(1);
      expect(updated.steps[1].stepNumber).toBe(2);
    });

    it('returns error when no session exists', async () => {
      setSession(null);
      const response = await routeMessage(
        { type: 'REORDER_STEPS', payload: { stepIds: ['step-1'] } },
      );

      expect(response).toEqual(
        expect.objectContaining({ status: 'error' }),
      );
    });

    it('ignores unknown step IDs gracefully', async () => {
      const session = makeSession();
      session.steps.push({
        id: 'step-2',
        stepNumber: 2,
        description: 'Second step',
        screenshotDataUrl: 'data:image/png;base64,def',
        element: session.steps[0].element,
        interaction: session.steps[0].interaction,
        timestamp: Date.now(),
        url: 'https://example.com',
      });
      setSession(session);

      // Include an unknown ID — it should be silently skipped
      const response = await routeMessage(
        { type: 'REORDER_STEPS', payload: { stepIds: ['step-2', 'no-such-step', 'step-1'] } },
      );

      expect(response).toEqual({ status: 'ok' });
      const updated = getSession()!;
      expect(updated.steps).toHaveLength(2);
      expect(updated.steps[0].id).toBe('step-2');
      expect(updated.steps[1].id).toBe('step-1');
    });
  });

  describe('DELETE_STEP', () => {
    it('removes step from session and renumbers remaining steps', async () => {
      const session = makeSession();
      session.steps.push({
        id: 'step-2',
        stepNumber: 2,
        description: 'Second step',
        screenshotDataUrl: 'data:image/png;base64,def',
        element: session.steps[0].element,
        interaction: session.steps[0].interaction,
        timestamp: Date.now(),
        url: 'https://example.com',
      });
      setSession(session);

      const response = await routeMessage(
        { type: 'DELETE_STEP', payload: { stepId: 'step-1' } },
      );

      expect(response).toEqual({ status: 'ok' });
      const updated = getSession()!;
      expect(updated.steps).toHaveLength(1);
      expect(updated.steps[0].id).toBe('step-2');
      expect(updated.steps[0].stepNumber).toBe(1); // renumbered
    });

    it('returns error for non-existent step', async () => {
      setSession(makeSession());
      const response = await routeMessage(
        { type: 'DELETE_STEP', payload: { stepId: 'no-such-step' } },
      );

      expect(response).toEqual(
        expect.objectContaining({ status: 'error' }),
      );
    });

    it('returns error when no session exists', async () => {
      setSession(null);
      const response = await routeMessage(
        { type: 'DELETE_STEP', payload: { stepId: 'step-1' } },
      );

      expect(response).toEqual(
        expect.objectContaining({ status: 'error' }),
      );
    });
  });

  describe('TAKE_SCREENSHOT', () => {
    it('captures screenshot, creates editing session, and opens editor', async () => {
      (chrome.tabs.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1,
        url: 'https://example.com',
        title: 'Example Page',
      });
      (chrome.tabs.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 2 });

      const response = await routeMessage(
        { type: 'TAKE_SCREENSHOT', payload: { tabId: 1 } },
      );

      expect(captureScreenshot).toHaveBeenCalledWith(1);
      expect(resizeScreenshotSW).toHaveBeenCalled();
      expect(createThumbnailSW).toHaveBeenCalled();
      expect(saveSession).toHaveBeenCalled();
      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('editor/index.html') }),
      );

      // Session should be in editing state with 1 step
      const session = getSession();
      expect(session).not.toBeNull();
      expect(session!.status).toBe('editing');
      expect(session!.steps).toHaveLength(1);
      expect(session!.steps[0].description).toBe('Example Page');
      expect(session!.title).toBe('Example Page');

      expect(response).toEqual(
        expect.objectContaining({ status: 'ok' }),
      );
    });

    it('uses fallback title when tab has no title', async () => {
      (chrome.tabs.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 2,
        url: 'https://example.com',
      });
      (chrome.tabs.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 3 });

      await routeMessage(
        { type: 'TAKE_SCREENSHOT', payload: { tabId: 2 } },
      );

      const session = getSession();
      expect(session!.title).toBe('Screenshot');
    });
  });

  describe('onCommitted re-injection', () => {
    it('registers onCommitted listener', () => {
      expect(chrome.webNavigation.onCommitted.addListener).toHaveBeenCalled();
    });

    it('re-injects content script on hard navigation during capture', async () => {
      setSession(makeSession({ status: 'capturing', tabId: 42 }));
      vi.mocked(chrome.scripting.executeScript).mockClear();

      const onCommittedListener = cachedOnCommittedListener;

      // Simulate hard navigation on the captured tab
      onCommittedListener({
        tabId: 42,
        frameId: 0,
        url: 'https://example.com/page2',
      });

      // Should have called executeScript to re-inject
      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 42 },
        files: ['src/content/index.js'],
      });
    });

    it('ignores navigation on non-top frames', () => {
      setSession(makeSession({ status: 'capturing', tabId: 42 }));
      vi.mocked(chrome.scripting.executeScript).mockClear();

      const onCommittedListener = cachedOnCommittedListener;

      // Simulate navigation in an iframe (frameId !== 0)
      onCommittedListener({
        tabId: 42,
        frameId: 1,
        url: 'https://example.com/iframe',
      });

      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });

    it('ignores navigation on different tab', () => {
      setSession(makeSession({ status: 'capturing', tabId: 42 }));
      vi.mocked(chrome.scripting.executeScript).mockClear();

      const onCommittedListener = cachedOnCommittedListener;

      // Simulate navigation on a different tab
      onCommittedListener({
        tabId: 99,
        frameId: 0,
        url: 'https://other.com',
      });

      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });

    it('ignores navigation when not capturing', () => {
      setSession(makeSession({ status: 'editing', tabId: 42 }));
      vi.mocked(chrome.scripting.executeScript).mockClear();

      const onCommittedListener = cachedOnCommittedListener;

      onCommittedListener({
        tabId: 42,
        frameId: 0,
        url: 'https://example.com/page2',
      });

      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });

    it('sends RESTORE_TOOLBAR immediately after re-injection (no delay)', async () => {
      const session = makeSession({ status: 'capturing', tabId: 42 });
      session.steps = [
        {
          id: 'step-1', stepNumber: 1, description: 'test',
          screenshotDataUrl: '', element: session.steps[0].element,
          interaction: session.steps[0].interaction,
          timestamp: Date.now(), url: 'https://example.com',
        },
        {
          id: 'step-2', stepNumber: 2, description: 'test2',
          screenshotDataUrl: '', element: session.steps[0].element,
          interaction: session.steps[0].interaction,
          timestamp: Date.now(), url: 'https://example.com',
        },
      ];
      setSession(session);
      setToolbarPosition({ x: 200, y: 40 });
      vi.mocked(chrome.tabs.sendMessage).mockClear();

      const onCommittedListener = cachedOnCommittedListener;

      onCommittedListener({
        tabId: 42,
        frameId: 0,
        url: 'https://example.com/page2',
      });

      // Wait for executeScript promise to resolve (microtask)
      await Promise.resolve();
      await Promise.resolve();

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        42,
        {
          type: 'RESTORE_TOOLBAR',
          payload: {
            stepCount: 2,
            position: { x: 200, y: 40 },
          },
        },
      );
    });
  });

  // ── Session Restoration After SW Restart ────────────────────────────

  describe('session restoration after SW restart', () => {
    const restoredStep = {
      id: 'step-1',
      stepNumber: 1,
      description: 'Clicked button',
      screenshotDataUrl: 'data:image/png;base64,restored-screenshot',
      thumbnailDataUrl: 'data:image/jpeg;base64,restored-thumb',
      element: {
        tagName: 'BUTTON',
        boundingRect: { x: 0, y: 0, width: 100, height: 40, top: 0, right: 100, bottom: 40, left: 0 },
        isInIframe: false,
      },
      interaction: {
        type: 'click' as const,
        timestamp: Date.now(),
        url: 'https://example.com',
        element: {
          tagName: 'BUTTON',
          boundingRect: { x: 0, y: 0, width: 100, height: 40, top: 0, right: 100, bottom: 40, left: 0 },
          isInIframe: false,
        },
      },
      timestamp: Date.now(),
      url: 'https://example.com',
    };

    it('restores session for GET_SESSION_DATA when currentSession is null', async () => {
      const savedSession = makeSession({
        id: 'session-restored',
        status: 'editing',
        steps: [restoredStep],
      });
      vi.mocked(restoreSession).mockResolvedValueOnce(savedSession);

      // currentSession is null (simulating SW restart)
      setSession(null);

      const response = await routeMessage({ type: 'GET_SESSION_DATA', payload: {} }) as {
        status: string;
        session: CaptureSession | null;
      };

      expect(restoreSession).toHaveBeenCalled();
      expect(response.status).toBe('ok');
      expect(response.session).not.toBeNull();
      expect(response.session!.id).toBe('session-restored');
    });

    it('restores session for GET_STEP_SCREENSHOT when currentSession is null', async () => {
      const savedSession = makeSession({
        status: 'editing',
        steps: [restoredStep],
      });
      vi.mocked(restoreSession).mockResolvedValueOnce(savedSession);
      setSession(null);

      const response = await routeMessage({
        type: 'GET_STEP_SCREENSHOT',
        payload: { stepId: 'step-1' },
      });

      expect(response).toEqual({
        status: 'ok',
        screenshotDataUrl: 'data:image/png;base64,restored-screenshot',
        thumbnailDataUrl: 'data:image/jpeg;base64,restored-thumb',
      });
    });

    it('restores session for UPDATE_STEP_DESCRIPTION when currentSession is null', async () => {
      const savedSession = makeSession({ status: 'editing', steps: [restoredStep] });
      vi.mocked(restoreSession).mockResolvedValueOnce(savedSession);
      setSession(null);

      const response = await routeMessage({
        type: 'UPDATE_STEP_DESCRIPTION',
        payload: { stepId: 'step-1', description: 'Updated after restart' },
      });

      expect(response).toEqual({ status: 'ok' });
      expect(getSession()!.steps[0].description).toBe('Updated after restart');
    });

    it('only calls restoreSession once (subsequent messages use in-memory)', async () => {
      const savedSession = makeSession({ status: 'editing', steps: [restoredStep] });
      vi.mocked(restoreSession).mockResolvedValueOnce(savedSession);
      setSession(null);

      // First message triggers restore
      await routeMessage({ type: 'GET_SESSION_DATA', payload: {} });
      expect(restoreSession).toHaveBeenCalledTimes(1);

      // Second message uses in-memory session (restoreSession not called again)
      vi.mocked(restoreSession).mockClear();
      await routeMessage({ type: 'GET_SESSION_DATA', payload: {} });
      expect(restoreSession).not.toHaveBeenCalled();
    });
  });
});
