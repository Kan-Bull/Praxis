import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import type { CaptureSession } from '../../../src/shared/types';
import type { ExportSettings } from '../../../src/editor/components/ExportReviewDialog';

// Mock dependencies
vi.mock('../../../src/shared/messaging', () => ({
  sendMessage: vi.fn(),
}));

vi.mock('../../../src/editor/lib/canvasFlattener', () => ({
  compositeScreenshotWithOverlay: vi.fn(),
  renderAnnotationsToDataUrl: vi.fn(),
  validateDataUrl: vi.fn().mockReturnValue(true),
}));

vi.mock('../../../src/editor/lib/pdfExporter', () => ({
  generateExportPdf: vi.fn().mockResolvedValue(new Blob(['mock-pdf'], { type: 'application/pdf' })),
}));

import { useExport } from '../../../src/editor/hooks/useExport';
import { sendMessage } from '../../../src/shared/messaging';
import { generateExportPdf } from '../../../src/editor/lib/pdfExporter';
import { compositeScreenshotWithOverlay, renderAnnotationsToDataUrl } from '../../../src/editor/lib/canvasFlattener';

const mockSendMessage = vi.mocked(sendMessage);
const mockGenerateExportPdf = vi.mocked(generateExportPdf);
const mockCompositeScreenshotWithOverlay = vi.mocked(compositeScreenshotWithOverlay);
const mockRenderAnnotationsToDataUrl = vi.mocked(renderAnnotationsToDataUrl);

function makeSettings(overrides: Partial<ExportSettings> = {}): ExportSettings {
  return {
    title: 'Test Guide',
    author: '',
    date: 'February 14, 2026',
    pageSize: 'a4',
    includeUrls: true,
    ...overrides,
  };
}

function makeSession(overrides: Partial<CaptureSession> = {}): CaptureSession {
  return {
    id: 'session-1',
    tabId: 1,
    status: 'editing',
    title: 'Test Guide',
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        description: 'Click the button',
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
    ],
    startUrl: 'https://example.com',
    startedAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

// Mock ClipboardItem for jsdom
class MockClipboardItem {
  constructor(public items: Record<string, Blob>) {}
}
(globalThis as any).ClipboardItem = MockClipboardItem;

describe('useExport', () => {
  const originalCreateElement = document.createElement.bind(document);
  let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({ status: 'ok', screenshotDataUrl: 'data:image/png;base64,abc' });
    mockGenerateExportPdf.mockResolvedValue(new Blob(['mock-pdf'], { type: 'application/pdf' }));
    mockRenderAnnotationsToDataUrl.mockResolvedValue(null);

    // Mock Image class for screenshot dimension loading
    vi.spyOn(globalThis, 'Image').mockImplementation(function (this: HTMLImageElement) {
      const img = { width: 800, height: 600, onload: null as (() => void) | null, onerror: null as (() => void) | null, src: '' };
      Object.defineProperty(img, 'src', {
        set(val: string) {
          (this as any)._src = val;
          setTimeout(() => img.onload?.(), 0);
        },
        get() { return (this as any)._src ?? ''; },
      });
      return img as unknown as HTMLImageElement;
    } as unknown as typeof Image);

    // Mock download trigger — use bound original to avoid recursion
    mockAnchor = { href: '', download: '', click: vi.fn() };
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement;
      return originalCreateElement(tag);
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('startExport scans for sensitive data and shows review', () => {
    const session = makeSession({
      steps: [
        {
          ...makeSession().steps[0],
          description: 'Enter user@test.com',
        },
      ],
    });
    const { result } = renderHook(() => useExport(session));

    act(() => {
      result.current.startExport();
    });

    expect(result.current.showReview).toBe(true);
    expect(result.current.sensitiveMatches.length).toBeGreaterThan(0);
  });

  it('confirmExport generates PDF and triggers download', async () => {
    const session = makeSession();
    const { result } = renderHook(() => useExport(session));

    act(() => {
      result.current.startExport();
    });

    await act(async () => {
      await result.current.confirmExport(makeSettings());
    });

    expect(result.current.showReview).toBe(false);
    expect(result.current.exporting).toBe(false);
    // Verify EXPORT_COMPLETE was sent
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'EXPORT_COMPLETE' }),
    );
  });

  it('confirmExport passes settings to PDF generator', async () => {
    const session = makeSession();
    const { result } = renderHook(() => useExport(session));

    act(() => { result.current.startExport(); });

    await act(async () => {
      await result.current.confirmExport(makeSettings({
        title: 'My Custom Title',
        author: 'Alice',
        date: 'January 1, 2026',
        pageSize: 'letter',
        includeUrls: false,
      }));
    });

    expect(mockGenerateExportPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'My Custom Title',
        author: 'Alice',
        date: 'January 1, 2026',
        pageSize: 'letter',
        includeUrls: false,
      }),
    );
  });

  it('cancelExport hides review dialog', () => {
    const session = makeSession();
    const { result } = renderHook(() => useExport(session));

    act(() => {
      result.current.startExport();
    });
    expect(result.current.showReview).toBe(true);

    act(() => {
      result.current.cancelExport();
    });
    expect(result.current.showReview).toBe(false);
    expect(result.current.sensitiveMatches).toHaveLength(0);
  });

  it('sets exporting flag during export', async () => {
    const session = makeSession();
    let capturedExporting = false;

    // Delay sendMessage to observe exporting state
    mockSendMessage.mockImplementation(async (msg) => {
      if ((msg as { type: string }).type === 'GET_STEP_SCREENSHOT') {
        // Small delay to keep exporting true
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { screenshotDataUrl: 'data:image/png;base64,abc' };
      }
      return { status: 'ok' };
    });

    const { result } = renderHook(() => useExport(session));

    act(() => {
      result.current.startExport();
    });

    const exportPromise = act(async () => {
      const p = result.current.confirmExport(makeSettings());
      capturedExporting = result.current.exporting;
      await p;
    });

    await exportPromise;
    // After completion, exporting should be false
    expect(result.current.exporting).toBe(false);
  });

  it('does nothing with no steps', () => {
    const session = makeSession({ steps: [] });
    const { result } = renderHook(() => useExport(session));

    act(() => {
      result.current.startExport();
    });

    expect(result.current.showReview).toBe(false);
  });

  it('does nothing with null session', () => {
    const { result } = renderHook(() => useExport(null));

    act(() => {
      result.current.startExport();
    });

    expect(result.current.showReview).toBe(false);
  });

  it('composites annotations for steps that have them', async () => {
    const annotationsJson = JSON.stringify({ version: '6.0.0', objects: [{ type: 'rect' }] });
    const session = makeSession({
      steps: [
        {
          ...makeSession().steps[0],
          annotations: annotationsJson,
        },
      ],
    });

    mockRenderAnnotationsToDataUrl.mockResolvedValue('data:image/png;base64,overlay');
    mockCompositeScreenshotWithOverlay.mockResolvedValue('data:image/png;base64,composited');

    const { result } = renderHook(() => useExport(session));

    act(() => {
      result.current.startExport();
    });

    await act(async () => {
      await result.current.confirmExport(makeSettings());
    });

    expect(mockRenderAnnotationsToDataUrl).toHaveBeenCalledWith(annotationsJson, 800, 600);
    expect(mockCompositeScreenshotWithOverlay).toHaveBeenCalledWith(
      'data:image/png;base64,abc',
      'data:image/png;base64,overlay',
    );
  });

  it('exports raw screenshots for steps without annotations', async () => {
    const session = makeSession(); // No annotations on step
    const { result } = renderHook(() => useExport(session));

    act(() => {
      result.current.startExport();
    });

    await act(async () => {
      await result.current.confirmExport(makeSettings());
    });

    expect(mockRenderAnnotationsToDataUrl).not.toHaveBeenCalled();
    expect(mockCompositeScreenshotWithOverlay).not.toHaveBeenCalled();
  });

  it('uses getCachedScreenshot before fetching from SW', async () => {
    const session = makeSession();
    const getCachedScreenshot = vi.fn().mockReturnValue('data:image/png;base64,cached');

    const { result } = renderHook(() => useExport(session, getCachedScreenshot));

    act(() => {
      result.current.startExport();
    });

    await act(async () => {
      await result.current.confirmExport(makeSettings());
    });

    // Should have checked cache for each step
    expect(getCachedScreenshot).toHaveBeenCalledWith('step-1');
    // Should NOT have fetched from SW for screenshot (only EXPORT_COMPLETE)
    expect(mockSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'GET_STEP_SCREENSHOT' }),
    );
  });

  it('falls back to SW when cache returns null', async () => {
    const session = makeSession();
    const getCachedScreenshot = vi.fn().mockReturnValue(null);

    const { result } = renderHook(() => useExport(session, getCachedScreenshot));

    act(() => {
      result.current.startExport();
    });

    await act(async () => {
      await result.current.confirmExport(makeSettings());
    });

    // Should have checked cache first
    expect(getCachedScreenshot).toHaveBeenCalledWith('step-1');
    // Should fall back to SW fetch
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'GET_STEP_SCREENSHOT' }),
    );
  });

  it('confirmExport passes logoDataUrl to generateExportPdf', async () => {
    const session = makeSession();
    const { result } = renderHook(() => useExport(session));

    act(() => { result.current.startExport(); });

    await act(async () => {
      await result.current.confirmExport(makeSettings(), 'data:image/png;base64,logo123');
    });

    expect(mockGenerateExportPdf).toHaveBeenCalledWith(
      expect.objectContaining({ logoDataUrl: 'data:image/png;base64,logo123' }),
    );
  });

  it('does not include logoDataUrl when not provided', async () => {
    const session = makeSession();
    const { result } = renderHook(() => useExport(session));

    act(() => { result.current.startExport(); });

    await act(async () => {
      await result.current.confirmExport(makeSettings());
    });

    const callArgs = mockGenerateExportPdf.mock.calls[0][0];
    expect(callArgs.logoDataUrl).toBeUndefined();
  });

  describe('exportPng', () => {
    it('downloads PNG from selected step', async () => {
      const session = makeSession();
      const { result } = renderHook(() => useExport(session));

      await act(async () => {
        await result.current.exportPng(session.steps[0]);
      });

      expect(mockAnchor.download).toBe('Click-the-button.png');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(result.current.exporting).toBe(false);
    });

    it('appends step number for multi-step sessions', async () => {
      const session = makeSession({
        steps: [
          makeSession().steps[0],
          { ...makeSession().steps[0], id: 'step-2', stepNumber: 2 },
        ],
      });
      const { result } = renderHook(() => useExport(session));

      await act(async () => {
        await result.current.exportPng(session.steps[0]);
      });

      expect(mockAnchor.download).toBe('Click-the-button-step-1.png');
    });

    it('composites annotations before downloading', async () => {
      const annotationsJson = JSON.stringify({ objects: [{ type: 'rect' }] });
      const session = makeSession({
        steps: [{ ...makeSession().steps[0], annotations: annotationsJson }],
      });

      mockRenderAnnotationsToDataUrl.mockResolvedValue('data:image/png;base64,overlay');
      mockCompositeScreenshotWithOverlay.mockResolvedValue('data:image/png;base64,composited');

      const { result } = renderHook(() => useExport(session));

      await act(async () => {
        await result.current.exportPng(session.steps[0]);
      });

      expect(mockRenderAnnotationsToDataUrl).toHaveBeenCalled();
      expect(mockCompositeScreenshotWithOverlay).toHaveBeenCalled();
    });
  });

  describe('copyToClipboard', () => {
    it('copies PNG to clipboard and returns true', async () => {
      const session = makeSession();
      const mockWrite = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { write: mockWrite },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useExport(session));

      let success = false;
      await act(async () => {
        success = await result.current.copyToClipboard(session.steps[0]);
      });

      expect(success).toBe(true);
      expect(mockWrite).toHaveBeenCalledWith([
        expect.any(MockClipboardItem),
      ]);
      expect(result.current.exporting).toBe(false);
    });

    it('returns false on error', async () => {
      const session = makeSession();
      Object.defineProperty(navigator, 'clipboard', {
        value: { write: vi.fn().mockRejectedValue(new Error('Clipboard blocked')) },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useExport(session));

      let success = true;
      await act(async () => {
        success = await result.current.copyToClipboard(session.steps[0]);
      });

      expect(success).toBe(false);
      expect(result.current.exportError).toBe('Error: Clipboard blocked');
    });
  });

  it('does not pass clickPosition to PDF (annotations are composited into screenshot)', async () => {
    const session = makeSession({
      steps: [
        {
          ...makeSession().steps[0],
          interaction: {
            type: 'click',
            timestamp: 1000,
            url: 'https://example.com',
            element: {
              tagName: 'BUTTON',
              boundingRect: { x: 500, y: 300, width: 100, height: 40, top: 300, right: 600, bottom: 340, left: 500 },
              isInIframe: false,
            },
            viewportWidth: 1920,
            viewportHeight: 1080,
            clickX: 550,
            clickY: 320,
          },
        },
      ],
    });

    const { result } = renderHook(() => useExport(session));
    act(() => { result.current.startExport(); });
    await act(async () => { await result.current.confirmExport(makeSettings()); });

    const pdfCall = mockGenerateExportPdf.mock.calls[0][0];
    const step = pdfCall.steps[0];
    expect((step as any).clickPosition).toBeUndefined();
  });
});
