import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/preact';

// Mock messaging
const mockSendMessage = vi.fn();
vi.mock('../../../src/shared/messaging', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

import { useSession } from '../../../src/editor/hooks/useSession';
import type { CaptureSession } from '../../../src/shared/types';

function makeSession(overrides: Partial<CaptureSession> = {}): CaptureSession {
  return {
    id: 'session-1',
    tabId: 1,
    status: 'editing',
    title: 'Test Session',
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        description: 'Clicked button',
        screenshotDataUrl: '',
        element: {
          tagName: 'BUTTON',
          boundingRect: { x: 0, y: 0, width: 100, height: 40, top: 0, right: 100, bottom: 40, left: 0 },
          isInIframe: false,
        },
        interaction: {
          type: 'click',
          timestamp: 1000,
          url: 'https://example.com',
          element: {
            tagName: 'BUTTON',
            boundingRect: { x: 0, y: 0, width: 100, height: 40, top: 0, right: 100, bottom: 40, left: 0 },
            isInIframe: false,
          },
        },
        timestamp: 1000,
        url: 'https://example.com',
      },
      {
        id: 'step-2',
        stepNumber: 2,
        description: 'Typed in field',
        screenshotDataUrl: '',
        element: {
          tagName: 'INPUT',
          boundingRect: { x: 0, y: 0, width: 200, height: 30, top: 0, right: 200, bottom: 30, left: 0 },
          isInIframe: false,
        },
        interaction: {
          type: 'input',
          timestamp: 2000,
          url: 'https://example.com',
          element: {
            tagName: 'INPUT',
            boundingRect: { x: 0, y: 0, width: 200, height: 30, top: 0, right: 200, bottom: 30, left: 0 },
            isInIframe: false,
          },
        },
        timestamp: 2000,
        url: 'https://example.com',
      },
    ],
    startUrl: 'https://example.com',
    startedAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

describe('useSession', () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
    // Default fallback so stray calls don't cause unhandled rejections
    mockSendMessage.mockResolvedValue({ status: 'ok', screenshotDataUrl: null, session: null });
  });

  it('starts in loading state', () => {
    mockSendMessage.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useSession());
    expect(result.current.loading).toBe(true);
    expect(result.current.session).toBeNull();
  });

  it('loads session metadata on mount', async () => {
    const session = makeSession();
    mockSendMessage.mockResolvedValueOnce({ status: 'ok', session });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toBeTruthy();
    expect(result.current.session!.id).toBe('session-1');
    expect(result.current.selectedStepId).toBe('step-1');
  });

  it('sets error on failure', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('handles null session', async () => {
    mockSendMessage.mockResolvedValueOnce({ status: 'ok', session: null });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.selectedStepId).toBeNull();
  });

  it('fetches screenshot on step selection', async () => {
    const session = makeSession();
    mockSendMessage
      .mockResolvedValueOnce({ status: 'ok', session }) // GET_SESSION_DATA
      .mockResolvedValueOnce({
        status: 'ok',
        screenshotDataUrl: 'data:image/png;base64,step1',
      }); // GET_STEP_SCREENSHOT for auto-selected step-1

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.screenshotDataUrl).toBe('data:image/png;base64,step1');
    });
  });

  it('uses cache on repeated step selection', async () => {
    const session = makeSession();
    mockSendMessage
      .mockResolvedValueOnce({ status: 'ok', session })
      .mockResolvedValueOnce({
        status: 'ok',
        screenshotDataUrl: 'data:image/png;base64,step1',
      });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.screenshotDataUrl).toBe('data:image/png;base64,step1');
    });

    // Select step-2, then back to step-1
    mockSendMessage.mockResolvedValueOnce({
      status: 'ok',
      screenshotDataUrl: 'data:image/png;base64,step2',
    });

    act(() => {
      result.current.selectStep('step-2');
    });

    await waitFor(() => {
      expect(result.current.screenshotDataUrl).toBe('data:image/png;base64,step2');
    });

    // Go back to step-1 — should use cache, no new sendMessage for screenshot
    const callCountBefore = mockSendMessage.mock.calls.length;
    act(() => {
      result.current.selectStep('step-1');
    });

    await waitFor(() => {
      expect(result.current.screenshotDataUrl).toBe('data:image/png;base64,step1');
    });

    // No new GET_STEP_SCREENSHOT call
    expect(mockSendMessage.mock.calls.length).toBe(callCountBefore);
  });

  it('updateDescription updates local state and sends message', async () => {
    const session = makeSession();
    mockSendMessage
      .mockResolvedValueOnce({ status: 'ok', session })
      .mockResolvedValueOnce({ status: 'ok', screenshotDataUrl: null })
      .mockResolvedValueOnce({ status: 'ok' }); // UPDATE_STEP_DESCRIPTION

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.updateDescription('step-1', 'Updated description');
    });

    expect(result.current.session!.steps[0].description).toBe('Updated description');
    expect(result.current.dirtySteps.has('step-1')).toBe(true);

    // Verify message was sent
    const updateCall = mockSendMessage.mock.calls.find(
      (call) => (call[0] as { type: string }).type === 'UPDATE_STEP_DESCRIPTION',
    );
    expect(updateCall).toBeTruthy();
  });

  it('updateAnnotations updates local state and sends message', async () => {
    const session = makeSession();
    mockSendMessage
      .mockResolvedValueOnce({ status: 'ok', session })
      .mockResolvedValueOnce({ status: 'ok', screenshotDataUrl: null })
      .mockResolvedValueOnce({ status: 'ok' }); // UPDATE_STEP_ANNOTATIONS

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.updateAnnotations('step-1', '{"objects":[]}');
    });

    expect(result.current.session!.steps[0].annotations).toBe('{"objects":[]}');
    expect(result.current.dirtySteps.has('step-1')).toBe(true);
  });

  it('deleteStep removes step from local state and sends DELETE_STEP', async () => {
    const session = makeSession();
    mockSendMessage
      .mockResolvedValueOnce({ status: 'ok', session })
      .mockResolvedValueOnce({ status: 'ok', screenshotDataUrl: null })
      .mockResolvedValueOnce({ status: 'ok' }); // DELETE_STEP

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.deleteStep('step-1');
    });

    expect(result.current.session!.steps).toHaveLength(1);
    expect(result.current.session!.steps[0].id).toBe('step-2');

    const deleteCall = mockSendMessage.mock.calls.find(
      (call) => (call[0] as { type: string }).type === 'DELETE_STEP',
    );
    expect(deleteCall).toBeTruthy();
    expect((deleteCall![0] as { payload: { stepId: string } }).payload.stepId).toBe('step-1');
  });

  it('deleteStep selects next step after deletion', async () => {
    const session = makeSession();
    mockSendMessage
      .mockResolvedValueOnce({ status: 'ok', session })
      .mockResolvedValueOnce({ status: 'ok', screenshotDataUrl: null })
      .mockResolvedValueOnce({ status: 'ok' }); // DELETE_STEP

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // step-1 is selected by default — delete it, should select step-2
    act(() => {
      result.current.deleteStep('step-1');
    });

    expect(result.current.selectedStepId).toBe('step-2');
  });

  it('deleteStep selects previous step when last step deleted', async () => {
    const session = makeSession();
    mockSendMessage
      .mockResolvedValueOnce({ status: 'ok', session })
      .mockResolvedValueOnce({ status: 'ok', screenshotDataUrl: null })
      .mockResolvedValueOnce({ status: 'ok' }); // DELETE_STEP

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Select step-2, then delete it — should fall back to step-1
    act(() => {
      result.current.selectStep('step-2');
    });

    mockSendMessage.mockResolvedValueOnce({ status: 'ok', screenshotDataUrl: null }); // screenshot fetch
    mockSendMessage.mockResolvedValueOnce({ status: 'ok' }); // DELETE_STEP

    act(() => {
      result.current.deleteStep('step-2');
    });

    expect(result.current.selectedStepId).toBe('step-1');
  });

  it('deleteStep clears selection when last remaining step deleted', async () => {
    const session = makeSession({
      steps: [makeSession().steps[0]], // only one step
    });
    mockSendMessage
      .mockResolvedValueOnce({ status: 'ok', session })
      .mockResolvedValueOnce({ status: 'ok', screenshotDataUrl: null })
      .mockResolvedValueOnce({ status: 'ok' }); // DELETE_STEP

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.deleteStep('step-1');
    });

    expect(result.current.session!.steps).toHaveLength(0);
    expect(result.current.selectedStepId).toBeNull();
  });

  it('updateScreenshot updates cache and current display', async () => {
    const session = makeSession();
    mockSendMessage
      .mockResolvedValueOnce({ status: 'ok', session })
      .mockResolvedValueOnce({ status: 'ok', screenshotDataUrl: 'data:image/png;base64,old' });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.screenshotDataUrl).toBe('data:image/png;base64,old');
    });

    act(() => {
      result.current.updateScreenshot('step-1', 'data:image/png;base64,blurred');
    });

    expect(result.current.screenshotDataUrl).toBe('data:image/png;base64,blurred');
  });

  it('reorderSteps moves step and renumbers', async () => {
    const session = makeSession();
    // Add a third step for a meaningful reorder
    session.steps.push({
      id: 'step-3',
      stepNumber: 3,
      description: 'Third step',
      screenshotDataUrl: '',
      element: session.steps[0].element,
      interaction: session.steps[0].interaction,
      timestamp: 3000,
      url: 'https://example.com',
    });
    mockSendMessage
      .mockResolvedValueOnce({ status: 'ok', session })
      .mockResolvedValueOnce({ status: 'ok', screenshotDataUrl: null })
      .mockResolvedValueOnce({ status: 'ok' }); // REORDER_STEPS

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Move step at index 0 to index 2
    act(() => {
      result.current.reorderSteps(0, 2);
    });

    // step-1 should now be last
    expect(result.current.session!.steps.map((s) => s.id)).toEqual(['step-2', 'step-3', 'step-1']);
    // Step numbers should be renumbered
    expect(result.current.session!.steps.map((s) => s.stepNumber)).toEqual([1, 2, 3]);

    // Should have sent REORDER_STEPS message
    const reorderCall = mockSendMessage.mock.calls.find(
      (call) => (call[0] as { type: string }).type === 'REORDER_STEPS',
    );
    expect(reorderCall).toBeTruthy();
    expect((reorderCall![0] as { payload: { stepIds: string[] } }).payload.stepIds).toEqual(
      ['step-2', 'step-3', 'step-1'],
    );
  });

  it('updateScreenshot persists to service worker via UPDATE_STEP_SCREENSHOT', async () => {
    const session = makeSession();
    mockSendMessage
      .mockResolvedValueOnce({ status: 'ok', session })
      .mockResolvedValueOnce({ status: 'ok', screenshotDataUrl: 'data:image/png;base64,old' })
      .mockResolvedValueOnce({ status: 'ok' }); // UPDATE_STEP_SCREENSHOT

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.screenshotDataUrl).toBe('data:image/png;base64,old');
    });

    act(() => {
      result.current.updateScreenshot('step-1', 'data:image/png;base64,cropped');
    });

    const updateCall = mockSendMessage.mock.calls.find(
      (call) => (call[0] as { type: string }).type === 'UPDATE_STEP_SCREENSHOT',
    );
    expect(updateCall).toBeTruthy();
    expect((updateCall![0] as { payload: { stepId: string; screenshotDataUrl: string } }).payload).toEqual({
      stepId: 'step-1',
      screenshotDataUrl: 'data:image/png;base64,cropped',
    });
  });
});
