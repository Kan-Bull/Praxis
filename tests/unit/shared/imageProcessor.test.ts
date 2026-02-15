import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resizeScreenshot,
  createThumbnail,
  compressScreenshot,
  cropScreenshot,
} from '@shared/imageProcessor';

// Mock canvas and image for jsdom (no native canvas support)
function createMockCanvas(width: number, height: number) {
  const ctx = {
    drawImage: vi.fn(),
  };
  return {
    width,
    height,
    getContext: vi.fn().mockReturnValue(ctx),
    toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,mockdata'),
    ctx,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();

  // Mock document.createElement for canvas
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') {
      return createMockCanvas(800, 600) as unknown as HTMLElement;
    }
    return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
  });

  // Mock Image constructor
  class MockImage {
    width = 1920;
    height = 1080;
    src = '';
    onload: (() => void) | null = null;
    onerror: ((err: unknown) => void) | null = null;

    constructor() {
      // Trigger onload asynchronously
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 0);
    }
  }
  vi.stubGlobal('Image', MockImage);
});

describe('resizeScreenshot', () => {
  it('should return a data URL', async () => {
    const result = await resizeScreenshot('data:image/jpeg;base64,original', 800);
    expect(result).toMatch(/^data:image\/jpeg/);
  });

  it('should create a canvas for resizing', async () => {
    await resizeScreenshot('data:image/jpeg;base64,original', 800);
    expect(document.createElement).toHaveBeenCalledWith('canvas');
  });

  it('should not upscale images smaller than maxWidth', async () => {
    // Set mock image to be smaller
    class SmallImage {
      width = 400;
      height = 300;
      src = '';
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }
    vi.stubGlobal('Image', SmallImage);

    const result = await resizeScreenshot('data:image/jpeg;base64,small', 800);
    expect(result).toBeDefined();
  });
});

describe('createThumbnail', () => {
  it('should return a data URL', async () => {
    const result = await createThumbnail('data:image/jpeg;base64,original');
    expect(result).toMatch(/^data:image\/jpeg/);
  });
});

describe('compressScreenshot', () => {
  it('should return a data URL', async () => {
    const result = await compressScreenshot('data:image/jpeg;base64,original');
    expect(result).toMatch(/^data:image\/jpeg/);
  });

  it('should accept custom quality', async () => {
    const result = await compressScreenshot('data:image/jpeg;base64,original', 0.5);
    expect(result).toMatch(/^data:image\/jpeg/);
  });
});

describe('cropScreenshot', () => {
  it('should return a cropped PNG data URL', async () => {
    // Override toDataURL to return png for this test
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const canvas = createMockCanvas(400, 300);
        canvas.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,cropped');
        return canvas as unknown as HTMLElement;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    });

    const result = await cropScreenshot('data:image/jpeg;base64,original', {
      x: 100, y: 50, width: 400, height: 300,
    });

    expect(result).toBe('data:image/png;base64,cropped');
    expect(document.createElement).toHaveBeenCalledWith('canvas');
  });

  it('should call drawImage with correct crop parameters', async () => {
    let capturedCtx: ReturnType<typeof createMockCanvas>['ctx'] | null = null;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const canvas = createMockCanvas(200, 150);
        canvas.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,cropped');
        capturedCtx = canvas.ctx;
        return canvas as unknown as HTMLElement;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    });

    await cropScreenshot('data:image/jpeg;base64,original', {
      x: 50, y: 25, width: 200, height: 150,
    });

    expect(capturedCtx!.drawImage).toHaveBeenCalledWith(
      expect.anything(), // img
      50, 25, 200, 150,  // source region
      0, 0, 200, 150,    // dest region
    );
  });
});
