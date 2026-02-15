import { describe, it, expect, beforeAll } from 'vitest';
import { viewportToCanvas, boundingRectCenter, computeCropRegion } from '../../../src/editor/lib/coordinateScaler';
import type { BoundingRectLike } from '@shared/types';

describe('viewportToCanvas', () => {
  it('returns coordinates unchanged when viewport equals canvas (identity scaling)', () => {
    const result = viewportToCanvas(100, 200, {
      viewportWidth: 1920,
      viewportHeight: 1080,
      canvasWidth: 1920,
      canvasHeight: 1080,
    });
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('halves coordinates when canvas is half the viewport (downscale)', () => {
    const result = viewportToCanvas(400, 600, {
      viewportWidth: 1920,
      viewportHeight: 1080,
      canvasWidth: 960,
      canvasHeight: 540,
    });
    expect(result).toEqual({ x: 200, y: 300 });
  });

  it('doubles coordinates when canvas is twice the viewport (upscale)', () => {
    const result = viewportToCanvas(100, 50, {
      viewportWidth: 800,
      viewportHeight: 600,
      canvasWidth: 1600,
      canvasHeight: 1200,
    });
    expect(result).toEqual({ x: 200, y: 100 });
  });

  it('returns { x: 0, y: 0 } when viewportWidth is zero (avoid division by zero)', () => {
    const result = viewportToCanvas(100, 200, {
      viewportWidth: 0,
      viewportHeight: 0,
      canvasWidth: 960,
      canvasHeight: 540,
    });
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('handles origin coordinates (0, 0)', () => {
    const result = viewportToCanvas(0, 0, {
      viewportWidth: 1920,
      viewportHeight: 1080,
      canvasWidth: 960,
      canvasHeight: 540,
    });
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('handles max edge coordinates (viewportWidth, viewportHeight)', () => {
    const result = viewportToCanvas(1920, 1080, {
      viewportWidth: 1920,
      viewportHeight: 1080,
      canvasWidth: 960,
      canvasHeight: 540,
    });
    expect(result).toEqual({ x: 960, y: 540 });
  });

  it('handles non-uniform scaling (different x and y ratios)', () => {
    const result = viewportToCanvas(100, 100, {
      viewportWidth: 1000,
      viewportHeight: 500,
      canvasWidth: 500,
      canvasHeight: 250,
    });
    expect(result).toEqual({ x: 50, y: 50 });
  });
});

describe('boundingRectCenter', () => {
  it('returns the midpoint of a bounding rect', () => {
    const rect: BoundingRectLike = {
      x: 100,
      y: 200,
      width: 80,
      height: 40,
      top: 200,
      right: 180,
      bottom: 240,
      left: 100,
    };
    const result = boundingRectCenter(rect);
    expect(result).toEqual({ x: 140, y: 220 });
  });

  it('returns the midpoint of a small 1x1 rect', () => {
    const rect: BoundingRectLike = {
      x: 50,
      y: 75,
      width: 1,
      height: 1,
      top: 75,
      right: 51,
      bottom: 76,
      left: 50,
    };
    const result = boundingRectCenter(rect);
    expect(result).toEqual({ x: 50.5, y: 75.5 });
  });

  it('returns the midpoint of a large 1920x1080 rect', () => {
    const rect: BoundingRectLike = {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      top: 0,
      right: 1920,
      bottom: 1080,
      left: 0,
    };
    const result = boundingRectCenter(rect);
    expect(result).toEqual({ x: 960, y: 540 });
  });

  it('handles rect with non-zero origin', () => {
    const rect: BoundingRectLike = {
      x: 300,
      y: 400,
      width: 200,
      height: 100,
      top: 400,
      right: 500,
      bottom: 500,
      left: 300,
    };
    const result = boundingRectCenter(rect);
    expect(result).toEqual({ x: 400, y: 450 });
  });
});

function makeRect(left: number, top: number, width: number, height: number): BoundingRectLike {
  return {
    x: left, y: top, width, height,
    top, left,
    right: left + width,
    bottom: top + height,
  };
}

describe('computeCropRegion', () => {
  it('crops around element center with padding', () => {
    // Small button at (500, 300) sized 100x40 in a 1920x1080 viewport
    // Image is same size as viewport (1:1 scale)
    const rect = makeRect(500, 300, 100, 40);
    const result = computeCropRegion(rect, 1920, 1080, 1920, 1080);

    expect(result).not.toBeNull();
    // Padding should be 200px (fixed > 15% of max(100, 40) = 15)
    // Region: x=300, y=100, w=500, h=440 → but min width is 400, and 500>400 so no adjustment
    expect(result!.x).toBe(300);
    expect(result!.y).toBe(100);
    expect(result!.width).toBe(500);
    expect(result!.height).toBe(440);
  });

  it('clamps to image bounds when element is near top-left edge', () => {
    const rect = makeRect(10, 10, 50, 30);
    const result = computeCropRegion(rect, 1920, 1080, 1920, 1080);

    expect(result).not.toBeNull();
    expect(result!.x).toBe(0); // clamped
    expect(result!.y).toBe(0); // clamped
    expect(result!.width).toBeGreaterThan(0);
    expect(result!.height).toBeGreaterThan(0);
  });

  it('clamps to image bounds when element is near bottom-right edge', () => {
    const rect = makeRect(1800, 1000, 100, 50);
    const result = computeCropRegion(rect, 1920, 1080, 1920, 1080);

    expect(result).not.toBeNull();
    // Right edge should not exceed image width
    expect(result!.x + result!.width).toBeLessThanOrEqual(1920);
    expect(result!.y + result!.height).toBeLessThanOrEqual(1080);
  });

  it('returns null when viewport dimensions are zero', () => {
    const rect = makeRect(100, 100, 50, 30);
    expect(computeCropRegion(rect, 0, 0, 800, 600)).toBeNull();
  });

  it('returns null when image dimensions are zero', () => {
    const rect = makeRect(100, 100, 50, 30);
    expect(computeCropRegion(rect, 1920, 1080, 0, 0)).toBeNull();
  });

  it('enforces minimum crop width', () => {
    // Tiny element: 10x5 → padded region = 10+400=410 wide (200px each side)
    // 410 > 400 so min crop width doesn't kick in here
    // For min to kick in, the padded width needs to be < 400
    const rect = makeRect(500, 300, 2, 2);
    const result = computeCropRegion(rect, 1920, 1080, 1920, 1080, 100);

    expect(result).not.toBeNull();
    // With 100px padding: w = 2 + 200 = 202 < 400, so min kicks in
    expect(result!.width).toBe(400);
  });

  it('percentage-based padding wins when element is large', () => {
    // Large element: 1000x800, 15% of max(1000,1000)=150 > default 200? No.
    // 15% of 1000 = 150. Still < 200.
    // Use a very large element where 15% > 200
    const rect = makeRect(100, 100, 1500, 1200);
    const result = computeCropRegion(rect, 1920, 1080, 1920, 1080);

    expect(result).not.toBeNull();
    // 15% of max(1500, 1200) = 225 > 200, so percentage pad = 225 is used
    // x = 100 - 225 = 0 (clamped), y = 100 - 225 = 0 (clamped)
    // w = 1500 + 450 = 1950 → clamped to 1920 (from x=0)
    expect(result!.x).toBe(0);
    expect(result!.y).toBe(0);
  });

  it('scales bounding rect from viewport to image space', () => {
    // Viewport 1920x1080, image 960x540 (half size)
    const rect = makeRect(400, 200, 100, 40);
    const result = computeCropRegion(rect, 1920, 1080, 960, 540);

    expect(result).not.toBeNull();
    // Scaled rect: left=200, top=100, width=50, height=20
    // Pad = max(200, 15% of max(50,20)) = max(200, 7.5) = 200
    // Region: x=0 (clamped from 200-200=0), y=0 (clamped from 100-200=-100)
    expect(result!.x).toBe(0);
    expect(result!.y).toBe(0);
    // w = 50 + 400 = 450, but clamped to 960 - 0 = 960 → min(450, 960) = 450
    expect(result!.width).toBe(450);
  });
});

describe('adjustClickForCrop', () => {
  // Import lazily so earlier tests don't break if the function doesn't exist yet
  let adjustClickForCrop: typeof import('../../../src/editor/lib/coordinateScaler').adjustClickForCrop;

  beforeAll(async () => {
    const mod = await import('../../../src/editor/lib/coordinateScaler');
    adjustClickForCrop = mod.adjustClickForCrop;
  });

  it('returns adjusted coords when click is inside crop region', () => {
    // Click at (500, 300) in image-space, crop at (100, 50, 800, 600)
    const result = adjustClickForCrop(500, 300, { x: 100, y: 50, width: 800, height: 600 });
    expect(result).toEqual({ x: 400, y: 250 });
  });

  it('returns null when click is left of crop', () => {
    const result = adjustClickForCrop(50, 300, { x: 100, y: 50, width: 800, height: 600 });
    expect(result).toBeNull();
  });

  it('returns null when click is above crop', () => {
    const result = adjustClickForCrop(500, 10, { x: 100, y: 50, width: 800, height: 600 });
    expect(result).toBeNull();
  });

  it('returns null when click is right of crop', () => {
    const result = adjustClickForCrop(950, 300, { x: 100, y: 50, width: 800, height: 600 });
    expect(result).toBeNull();
  });

  it('returns null when click is below crop', () => {
    const result = adjustClickForCrop(500, 700, { x: 100, y: 50, width: 800, height: 600 });
    expect(result).toBeNull();
  });

  it('includes click exactly on crop boundary (top-left corner)', () => {
    const result = adjustClickForCrop(100, 50, { x: 100, y: 50, width: 800, height: 600 });
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('includes click exactly on crop boundary (bottom-right corner)', () => {
    const result = adjustClickForCrop(900, 650, { x: 100, y: 50, width: 800, height: 600 });
    expect(result).toEqual({ x: 800, y: 600 });
  });
});
