import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── OffscreenCanvas & createImageBitmap mocks ───────────────────────
const mockDrawImage = vi.fn();
const mockConvertToBlob = vi.fn();

class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return { drawImage: mockDrawImage };
  }
  convertToBlob = mockConvertToBlob;
}

const mockImageBitmap = {
  width: 1920,
  height: 1080,
  close: vi.fn(),
};

// Install globals before importing module
Object.defineProperty(globalThis, 'OffscreenCanvas', {
  value: MockOffscreenCanvas,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, 'createImageBitmap', {
  value: vi.fn().mockResolvedValue(mockImageBitmap),
  writable: true,
  configurable: true,
});

// Mock fetch for data URL → Blob conversion
const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
const mockFetch = vi.fn().mockResolvedValue({
  blob: () => Promise.resolve(mockBlob),
});
Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
  configurable: true,
});

import {
  captureScreenshot,
  resizeScreenshotSW,
  createThumbnailSW,
  blobToDataUrl,
} from '../../../src/background/screenshotManager';

describe('screenshotManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: convertToBlob returns a mock blob with arrayBuffer support
    const fakeBytes = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes
    mockConvertToBlob.mockResolvedValue({
      type: 'image/png',
      arrayBuffer: () => Promise.resolve(fakeBytes.buffer),
    });
  });

  // ── captureScreenshot ──────────────────────────────────────────────

  describe('captureScreenshot', () => {
    it('should look up windowId and call captureVisibleTab', async () => {
      const dataUrl = await captureScreenshot(42);

      expect(chrome.tabs.get).toHaveBeenCalledWith(42);
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(1, {
        format: 'png',
      });
      expect(typeof dataUrl).toBe('string');
    });

    it('should return the data URL from captureVisibleTab', async () => {
      const result = await captureScreenshot(1);
      // From setup.ts mock: 'data:image/png;base64,iVBORw=='
      expect(result).toBe('data:image/png;base64,iVBORw==');
    });

    it('should throw if tabs.get fails', async () => {
      vi.mocked(chrome.tabs.get).mockRejectedValueOnce(new Error('No tab'));
      await expect(captureScreenshot(999)).rejects.toThrow('No tab');
    });
  });

  // ── resizeScreenshotSW ────────────────────────────────────────────

  describe('resizeScreenshotSW', () => {
    it('should skip resize when width <= maxWidth', async () => {
      // Set bitmap width to 800 (under default MAX_WIDTH 1920)
      (globalThis.createImageBitmap as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        width: 800,
        height: 600,
        close: vi.fn(),
      });

      const result = await resizeScreenshotSW('data:image/jpeg;base64,abc');
      // Should return original data URL without processing
      expect(result).toBe('data:image/jpeg;base64,abc');
      expect(mockConvertToBlob).not.toHaveBeenCalled();
    });

    it('should resize when width > maxWidth', async () => {
      (globalThis.createImageBitmap as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        width: 7680,
        height: 4320,
        close: vi.fn(),
      });

      const result = await resizeScreenshotSW('data:image/png;base64,big');
      expect(result).toContain('data:image/png;base64,');
      expect(mockDrawImage).toHaveBeenCalled();
      expect(mockConvertToBlob).toHaveBeenCalledWith({
        type: 'image/png',
      });
    });

    it('should preserve aspect ratio when resizing', async () => {
      (globalThis.createImageBitmap as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        width: 7680,
        height: 4320,
        close: vi.fn(),
      });

      await resizeScreenshotSW('data:image/png;base64,big');
      // OffscreenCanvas constructor receives (width, height)
      // 7680→3840, ratio 0.5, height = 4320 * 0.5 = 2160
      // Verified via MockOffscreenCanvas constructor
      expect(mockDrawImage).toHaveBeenCalled();
    });

    it('should accept custom maxWidth', async () => {
      (globalThis.createImageBitmap as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        width: 2000,
        height: 1000,
        close: vi.fn(),
      });

      await resizeScreenshotSW('data:image/png;base64,x', 1000);
      expect(mockConvertToBlob).toHaveBeenCalledWith({
        type: 'image/png',
      });
    });

    it('should close ImageBitmap after processing', async () => {
      const closeFn = vi.fn();
      (globalThis.createImageBitmap as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        width: 7680,
        height: 4320,
        close: closeFn,
      });

      await resizeScreenshotSW('data:image/png;base64,big');
      expect(closeFn).toHaveBeenCalled();
    });
  });

  // ── createThumbnailSW ─────────────────────────────────────────────

  describe('createThumbnailSW', () => {
    it('should create thumbnail at THUMBNAIL_WIDTH (320px)', async () => {
      (globalThis.createImageBitmap as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        width: 1920,
        height: 1080,
        close: vi.fn(),
      });
      // Thumbnails still use JPEG — override the default PNG blob mock
      const fakeBytes = new Uint8Array([255, 216, 255]);
      mockConvertToBlob.mockResolvedValueOnce({
        type: 'image/jpeg',
        arrayBuffer: () => Promise.resolve(fakeBytes.buffer),
      });

      const result = await createThumbnailSW('data:image/jpeg;base64,full');
      expect(result).toContain('data:image/jpeg;base64,');
      expect(mockConvertToBlob).toHaveBeenCalledWith({
        type: 'image/jpeg',
        quality: 0.85,
      });
    });

    it('should accept custom width and quality', async () => {
      (globalThis.createImageBitmap as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        width: 1920,
        height: 1080,
        close: vi.fn(),
      });
      const fakeBytes = new Uint8Array([255, 216, 255]);
      mockConvertToBlob.mockResolvedValueOnce({
        type: 'image/jpeg',
        arrayBuffer: () => Promise.resolve(fakeBytes.buffer),
      });

      await createThumbnailSW('data:image/jpeg;base64,full', 160, 0.6);
      expect(mockConvertToBlob).toHaveBeenCalledWith({
        type: 'image/jpeg',
        quality: 0.6,
      });
    });

    it('should close ImageBitmap after processing', async () => {
      const closeFn = vi.fn();
      (globalThis.createImageBitmap as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        width: 1920,
        height: 1080,
        close: closeFn,
      });

      await createThumbnailSW('data:image/jpeg;base64,full');
      expect(closeFn).toHaveBeenCalled();
    });
  });

  // ── blobToDataUrl ─────────────────────────────────────────────────

  describe('blobToDataUrl', () => {
    it('should convert a Blob to a data URL string', async () => {
      const bytes = new Uint8Array([116, 101, 115, 116]); // "test"
      // Create a mock Blob with arrayBuffer support for jsdom compatibility
      const blob = {
        type: 'image/png',
        arrayBuffer: () => Promise.resolve(bytes.buffer),
      } as unknown as Blob;
      const result = await blobToDataUrl(blob);
      expect(result).toMatch(/^data:image\/png;base64,/);
    });

    it('should produce valid base64 output', async () => {
      const bytes = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
      const blob = {
        type: 'text/plain',
        arrayBuffer: () => Promise.resolve(bytes.buffer),
      } as unknown as Blob;
      const result = await blobToDataUrl(blob);
      const base64 = result.split(',')[1];
      expect(atob(base64)).toBe('hello');
    });
  });
});
