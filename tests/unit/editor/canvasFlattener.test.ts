import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateDataUrl, compositeScreenshotWithOverlay, renderAnnotationsToDataUrl } from '../../../src/editor/lib/canvasFlattener';

describe('validateDataUrl', () => {
  it('accepts valid PNG data URL', () => {
    expect(validateDataUrl('data:image/png;base64,abc123=')).toBe(true);
  });

  it('accepts valid JPEG data URL', () => {
    expect(validateDataUrl('data:image/jpeg;base64,/9j/4AAQ=')).toBe(true);
  });

  it('rejects non-image data URL', () => {
    expect(validateDataUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
  });

  it('rejects http URL', () => {
    expect(validateDataUrl('https://evil.com/img.png')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateDataUrl('')).toBe(false);
  });

  it('rejects SVG data URL', () => {
    expect(validateDataUrl('data:image/svg+xml;base64,abc=')).toBe(false);
  });
});

describe('compositeScreenshotWithOverlay', () => {
  let mockCtx: { drawImage: ReturnType<typeof vi.fn> };
  let mockCanvas: { width: number; height: number; getContext: ReturnType<typeof vi.fn>; toDataURL: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockCtx = { drawImage: vi.fn() };
    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,composited'),
    };

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
      return document.createElement(tag);
    });

    // Mock Image class
    const origImage = globalThis.Image;
    vi.spyOn(globalThis, 'Image').mockImplementation(function (this: HTMLImageElement) {
      const img = { width: 800, height: 600, onload: null as (() => void) | null, onerror: null as (() => void) | null, src: '' };
      Object.defineProperty(img, 'src', {
        set(val: string) {
          this._src = val;
          // Trigger onload async
          setTimeout(() => img.onload?.(), 0);
        },
        get() { return this._src ?? ''; },
      });
      return img as unknown as HTMLImageElement;
    } as unknown as typeof Image);
  });

  it('draws screenshot onto canvas', async () => {
    const result = await compositeScreenshotWithOverlay(
      'data:image/png;base64,screenshot',
      null,
    );
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
    expect(result).toBe('data:image/png;base64,composited');
  });

  it('draws both screenshot and overlay', async () => {
    const result = await compositeScreenshotWithOverlay(
      'data:image/png;base64,screenshot',
      'data:image/png;base64,overlay',
    );
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(2);
    expect(result).toBe('data:image/png;base64,composited');
  });

  it('handles null overlay gracefully', async () => {
    const result = await compositeScreenshotWithOverlay(
      'data:image/png;base64,screenshot',
      null,
    );
    expect(result).toBe('data:image/png;base64,composited');
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
  });
});

describe('renderAnnotationsToDataUrl', () => {
  it('returns null for undefined annotations', async () => {
    const result = await renderAnnotationsToDataUrl(undefined as unknown as string, 800, 600);
    expect(result).toBeNull();
  });

  it('returns null for empty string annotations', async () => {
    const result = await renderAnnotationsToDataUrl('', 800, 600);
    expect(result).toBeNull();
  });

  it('returns null for whitespace-only annotations', async () => {
    const result = await renderAnnotationsToDataUrl('   ', 800, 600);
    expect(result).toBeNull();
  });

  it('returns a data URL string for valid annotations JSON', async () => {
    const mockDispose = vi.fn();
    const mockRenderAll = vi.fn();
    const mockToDataURL = vi.fn().mockReturnValue('data:image/png;base64,rendered');
    const mockLoadFromJSON = vi.fn().mockResolvedValue(undefined);

    class MockStaticCanvas {
      loadFromJSON = mockLoadFromJSON;
      renderAll = mockRenderAll;
      toDataURL = mockToDataURL;
      dispose = mockDispose;
      constructor(_el: unknown, _opts: unknown) {
        // constructor args captured via class instance
      }
    }

    vi.doMock('fabric', () => ({
      StaticCanvas: MockStaticCanvas,
    }));

    // Reset module registry so the re-import picks up the doMock
    vi.resetModules();

    const { renderAnnotationsToDataUrl: render } = await import(
      '../../../src/editor/lib/canvasFlattener'
    );

    const annotationsJson = JSON.stringify({ version: '6.0.0', objects: [] });
    const result = await render(annotationsJson, 800, 600);

    expect(result).toBe('data:image/png;base64,rendered');
    expect(mockLoadFromJSON).toHaveBeenCalledWith(annotationsJson);
    expect(mockRenderAll).toHaveBeenCalled();
    expect(mockDispose).toHaveBeenCalled();

    vi.doUnmock('fabric');
  });

  it('strips backgroundImage and uses its scaleX for display dimensions', async () => {
    const mockDispose = vi.fn();
    const mockRenderAll = vi.fn();
    const mockToDataURL = vi.fn().mockReturnValue('data:image/png;base64,rendered');
    const mockLoadFromJSON = vi.fn().mockResolvedValue(undefined);
    let constructorOpts: Record<string, unknown> = {};

    class MockStaticCanvas {
      loadFromJSON = mockLoadFromJSON;
      renderAll = mockRenderAll;
      toDataURL = mockToDataURL;
      dispose = mockDispose;
      constructor(_el: unknown, opts: Record<string, unknown>) {
        constructorOpts = opts;
      }
    }

    vi.doMock('fabric', () => ({
      StaticCanvas: MockStaticCanvas,
    }));

    vi.resetModules();

    const { renderAnnotationsToDataUrl: render } = await import(
      '../../../src/editor/lib/canvasFlattener'
    );

    // Screenshot is 2560x1920, editor displayed at 0.35 scale (896x672)
    const annotationsJson = JSON.stringify({
      version: '6.0.0',
      objects: [{ type: 'rect', left: 10 }],
      backgroundImage: { type: 'image', src: 'data:image/png;base64,bigScreenshot', scaleX: 0.35, scaleY: 0.35 },
    });
    await render(annotationsJson, 2560, 1920);

    // The JSON passed to loadFromJSON should NOT contain backgroundImage
    const loadedJson = mockLoadFromJSON.mock.calls[0][0];
    const parsed = JSON.parse(loadedJson);
    expect(parsed.backgroundImage).toBeUndefined();
    expect(parsed.objects).toHaveLength(1);

    // Canvas should be created at editor display dimensions (scaled down)
    expect(constructorOpts.width).toBe(Math.round(2560 * 0.35));
    expect(constructorOpts.height).toBe(Math.round(1920 * 0.35));

    // toDataURL should use multiplier to scale up to full screenshot resolution
    expect(mockToDataURL).toHaveBeenCalledWith(
      expect.objectContaining({
        multiplier: expect.closeTo(1 / 0.35, 1),
        format: 'png',
      }),
    );

    vi.doUnmock('fabric');
  });

  it('returns null when Fabric.js import fails', async () => {
    vi.doMock('fabric', () => {
      throw new Error('Module not found');
    });

    vi.resetModules();

    const { renderAnnotationsToDataUrl: render } = await import(
      '../../../src/editor/lib/canvasFlattener'
    );

    const result = await render(JSON.stringify({ objects: [] }), 800, 600);
    expect(result).toBeNull();

    vi.doUnmock('fabric');
  });
});
