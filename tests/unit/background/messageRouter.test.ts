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
}));

import { setSession, getSession, setToolbarPosition, getToolbarPosition, bufferPreClickScreenshot, getPreClickBufferPending } from '../../../src/background/captureManager';
import { captureScreenshot, resizeScreenshotSW, createThumbnailSW } from '../../../src/background/screenshotManager';
import { saveSession } from '../../../src/background/recoveryManager';
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

describe('SW message router — editor messages', () => {
  beforeEach(() => {
    setSession(null);
    setToolbarPosition(null);
  });

  describe('UPDATE_STEP_DESCRIPTION', () => {
    it('updates description for existing step', () => {
      setSession(makeSession());
      const listener = getMessageListener();
      const sendResponse = vi.fn();

      listener(
        { type: 'UPDATE_STEP_DESCRIPTION', payload: { stepId: 'step-1', description: 'New desc' } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith({ status: 'ok' });
      expect(getSession()!.steps[0].description).toBe('New desc');
    });

    it('returns error for non-existent step', () => {
      setSession(makeSession());
      const listener = getMessageListener();
      const sendResponse = vi.fn();

      listener(
        { type: 'UPDATE_STEP_DESCRIPTION', payload: { stepId: 'no-such-step', description: 'x' } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error' }),
      );
    });
  });

  describe('UPDATE_STEP_ANNOTATIONS', () => {
    it('updates annotations for existing step', () => {
      setSession(makeSession());
      const listener = getMessageListener();
      const sendResponse = vi.fn();

      listener(
        { type: 'UPDATE_STEP_ANNOTATIONS', payload: { stepId: 'step-1', annotations: '{"objects":[]}' } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith({ status: 'ok' });
      expect(getSession()!.steps[0].annotations).toBe('{"objects":[]}');
    });

    it('returns error for non-existent step', () => {
      setSession(makeSession());
      const listener = getMessageListener();
      const sendResponse = vi.fn();

      listener(
        { type: 'UPDATE_STEP_ANNOTATIONS', payload: { stepId: 'nope', annotations: '{}' } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error' }),
      );
    });
  });

  describe('SAVE_TOOLBAR_POSITION', () => {
    it('stores toolbar position via captureManager', () => {
      const listener = getMessageListener();
      const sendResponse = vi.fn();

      listener(
        { type: 'SAVE_TOOLBAR_POSITION', payload: { x: 150, y: 30 } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith({ status: 'ok' });
      expect(getToolbarPosition()).toEqual({ x: 150, y: 30 });
    });

    it('overwrites previous position', () => {
      setToolbarPosition({ x: 10, y: 20 });
      const listener = getMessageListener();
      const sendResponse = vi.fn();

      listener(
        { type: 'SAVE_TOOLBAR_POSITION', payload: { x: 400, y: 60 } },
        {},
        sendResponse,
      );

      expect(getToolbarPosition()).toEqual({ x: 400, y: 60 });
    });
  });

  describe('PRE_CLICK_BUFFER', () => {
    it('calls bufferPreClickScreenshot when capturing', async () => {
      setSession(makeSession({ status: 'capturing', tabId: 42 }));
      const listener = getMessageListener();
      const sendResponse = vi.fn();

      const isAsync = listener(
        { type: 'PRE_CLICK_BUFFER', payload: { timestamp: Date.now() } },
        {},
        sendResponse,
      );

      expect(isAsync).toBe(true);

      // Wait for the buffer capture to complete — the handler now waits for
      // the pending promise before calling sendResponse
      const pending = getPreClickBufferPending();
      if (pending) await pending;
      // Allow the .then() chain to resolve
      await new Promise((r) => setTimeout(r, 0));

      expect(sendResponse).toHaveBeenCalledWith({ status: 'ok' });
    });

    it('does not buffer when not capturing', () => {
      setSession(makeSession({ status: 'editing', tabId: 42 }));
      const listener = getMessageListener();
      const sendResponse = vi.fn();

      vi.mocked(captureScreenshot).mockClear();

      listener(
        { type: 'PRE_CLICK_BUFFER', payload: { timestamp: Date.now() } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith({ status: 'ok' });
      expect(captureScreenshot).not.toHaveBeenCalled();
    });

    it('does not buffer when no session exists', () => {
      setSession(null);
      const listener = getMessageListener();
      const sendResponse = vi.fn();

      vi.mocked(captureScreenshot).mockClear();

      listener(
        { type: 'PRE_CLICK_BUFFER', payload: { timestamp: Date.now() } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith({ status: 'ok' });
      expect(captureScreenshot).not.toHaveBeenCalled();
    });
  });

  describe('UPDATE_STEP_SCREENSHOT', () => {
    it('updates screenshot for existing step', () => {
      setSession(makeSession());
      const listener = getMessageListener();
      const sendResponse = vi.fn();

      listener(
        { type: 'UPDATE_STEP_SCREENSHOT', payload: { stepId: 'step-1', screenshotDataUrl: 'data:image/png;base64,cropped' } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith({ status: 'ok' });
      expect(getSession()!.steps[0].screenshotDataUrl).toBe('data:image/png;base64,cropped');
    });

    it('returns error for non-existent step', () => {
      setSession(makeSession());
      const listener = getMessageListener();
      const sendResponse = vi.fn();

      listener(
        { type: 'UPDATE_STEP_SCREENSHOT', payload: { stepId: 'no-such-step', screenshotDataUrl: 'data:image/png;base64,x' } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error' }),
      );
    });
  });

  describe('REORDER_STEPS', () => {
    it('reorders steps according to provided stepIds', () => {
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

      const listener = getMessageListener();
      const sendResponse = vi.fn();

      listener(
        { type: 'REORDER_STEPS', payload: { stepIds: ['step-2', 'step-1'] } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith({ status: 'ok' });
      const updated = getSession()!;
      expect(updated.steps[0].id).toBe('step-2');
      expect(updated.steps[1].id).toBe('step-1');
      // Renumbered
      expect(updated.steps[0].stepNumber).toBe(1);
      expect(updated.steps[1].stepNumber).toBe(2);
    });

    it('returns error when no session exists', () => {
      setSession(null);
      const listener = getMessageListener();
      const sendResponse = vi.fn();

      listener(
        { type: 'REORDER_STEPS', payload: { stepIds: ['step-1'] } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error' }),
      );
    });

    it('ignores unknown step IDs gracefully', () => {
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

      const listener = getMessageListener();
      const sendResponse = vi.fn();

      // Include an unknown ID — it should be silently skipped
      listener(
        { type: 'REORDER_STEPS', payload: { stepIds: ['step-2', 'no-such-step', 'step-1'] } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith({ status: 'ok' });
      const updated = getSession()!;
      expect(updated.steps).toHaveLength(2);
      expect(updated.steps[0].id).toBe('step-2');
      expect(updated.steps[1].id).toBe('step-1');
    });
  });

  describe('DELETE_STEP', () => {
    it('removes step from session and renumbers remaining steps', () => {
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

      const listener = getMessageListener();
      const sendResponse = vi.fn();

      listener(
        { type: 'DELETE_STEP', payload: { stepId: 'step-1' } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith({ status: 'ok' });
      const updated = getSession()!;
      expect(updated.steps).toHaveLength(1);
      expect(updated.steps[0].id).toBe('step-2');
      expect(updated.steps[0].stepNumber).toBe(1); // renumbered
    });

    it('returns error for non-existent step', () => {
      setSession(makeSession());
      const listener = getMessageListener();
      const sendResponse = vi.fn();

      listener(
        { type: 'DELETE_STEP', payload: { stepId: 'no-such-step' } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error' }),
      );
    });

    it('returns error when no session exists', () => {
      setSession(null);
      const listener = getMessageListener();
      const sendResponse = vi.fn();

      listener(
        { type: 'DELETE_STEP', payload: { stepId: 'step-1' } },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(
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

      const listener = getMessageListener();
      const sendResponse = vi.fn();

      const isAsync = listener(
        { type: 'TAKE_SCREENSHOT', payload: { tabId: 1 } },
        {},
        sendResponse,
      );

      expect(isAsync).toBe(true);

      // Wait for async handler
      await new Promise((r) => setTimeout(r, 50));

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

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ok' }),
      );
    });

    it('uses fallback title when tab has no title', async () => {
      (chrome.tabs.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 2,
        url: 'https://example.com',
      });
      (chrome.tabs.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 3 });

      const listener = getMessageListener();
      const sendResponse = vi.fn();

      listener(
        { type: 'TAKE_SCREENSHOT', payload: { tabId: 2 } },
        {},
        sendResponse,
      );

      await new Promise((r) => setTimeout(r, 50));

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

      // Get the onCommitted listener
      const calls = (chrome.webNavigation.onCommitted.addListener as ReturnType<typeof vi.fn>).mock.calls;
      const onCommittedListener = calls[calls.length - 1][0];

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

      const calls = (chrome.webNavigation.onCommitted.addListener as ReturnType<typeof vi.fn>).mock.calls;
      const onCommittedListener = calls[calls.length - 1][0];

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

      const calls = (chrome.webNavigation.onCommitted.addListener as ReturnType<typeof vi.fn>).mock.calls;
      const onCommittedListener = calls[calls.length - 1][0];

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

      const calls = (chrome.webNavigation.onCommitted.addListener as ReturnType<typeof vi.fn>).mock.calls;
      const onCommittedListener = calls[calls.length - 1][0];

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

      const calls = (chrome.webNavigation.onCommitted.addListener as ReturnType<typeof vi.fn>).mock.calls;
      const onCommittedListener = calls[calls.length - 1][0];

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
});
