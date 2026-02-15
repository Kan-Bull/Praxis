import { describe, it, expect } from 'vitest';
import { applyPixelBlur } from '../../../src/editor/lib/blurTool';

/** Create a flat RGBA pixel array for a given width/height, filled with a color. */
function createPixels(
  width: number,
  height: number,
  fill: [number, number, number, number] = [0, 0, 0, 255],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  }
  return data;
}

/** Get RGBA at (x, y). */
function getPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const idx = (y * width + x) * 4;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
}

describe('applyPixelBlur', () => {
  it('averages pixels within a block', () => {
    // 2×2 image: TL=red, TR=blue, BL=green, BR=white
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 0, 255, 255,
      0, 255, 0, 255, 255, 255, 255, 255,
    ]);
    const result = applyPixelBlur(pixels, 2, 2, { x: 0, y: 0, width: 2, height: 2 }, 2);
    // All 4 pixels should be the average
    const avg = getPixel(result, 2, 0, 0);
    expect(avg[0]).toBe(Math.round((255 + 0 + 0 + 255) / 4)); // R
    expect(avg[1]).toBe(Math.round((0 + 0 + 255 + 255) / 4)); // G
    expect(avg[2]).toBe(Math.round((0 + 255 + 0 + 255) / 4)); // B
    expect(avg[3]).toBe(255); // A — all 255
    // All pixels in the block should be the same
    expect(getPixel(result, 2, 1, 1)).toEqual(avg);
  });

  it('preserves pixels outside the blur region', () => {
    // 4×1 image: all red
    const pixels = createPixels(4, 1, [255, 0, 0, 255]);
    // Blur only center 2 pixels with blockSize=2
    const result = applyPixelBlur(pixels, 4, 1, { x: 1, y: 0, width: 2, height: 1 }, 2);
    // Outside pixels unchanged
    expect(getPixel(result, 4, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(getPixel(result, 4, 3, 0)).toEqual([255, 0, 0, 255]);
  });

  it('clamps region to image bounds', () => {
    const pixels = createPixels(2, 2, [100, 100, 100, 255]);
    // Region extends beyond image
    const result = applyPixelBlur(pixels, 2, 2, { x: -1, y: -1, width: 10, height: 10 }, 2);
    // Should not throw, and all pixels become averaged (uniform input → same output)
    expect(getPixel(result, 2, 0, 0)).toEqual([100, 100, 100, 255]);
  });

  it('handles blockSize=1 (each pixel becomes itself)', () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255,
    ]);
    const result = applyPixelBlur(pixels, 2, 1, { x: 0, y: 0, width: 2, height: 1 }, 1);
    // Each pixel is its own block, so unchanged
    expect(getPixel(result, 2, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(getPixel(result, 2, 1, 0)).toEqual([0, 255, 0, 255]);
  });

  it('handles single pixel region', () => {
    const pixels = createPixels(3, 3, [50, 100, 150, 200]);
    const result = applyPixelBlur(pixels, 3, 3, { x: 1, y: 1, width: 1, height: 1 }, 10);
    // Single pixel averaged with itself
    expect(getPixel(result, 3, 1, 1)).toEqual([50, 100, 150, 200]);
  });

  it('handles full image as region', () => {
    const pixels = createPixels(2, 2, [128, 64, 32, 255]);
    // Block covers entire image
    const result = applyPixelBlur(pixels, 2, 2, { x: 0, y: 0, width: 2, height: 2 }, 100);
    // Uniform input → uniform output
    expect(getPixel(result, 2, 0, 0)).toEqual([128, 64, 32, 255]);
  });

  it('does not mutate the original pixel array', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
    const original = new Uint8ClampedArray(pixels);
    applyPixelBlur(pixels, 2, 1, { x: 0, y: 0, width: 2, height: 1 }, 2);
    expect(pixels).toEqual(original);
  });

  it('produces different blocks for large blockSize on varied data', () => {
    // 4×2 image: left half red, right half blue
    const pixels = new Uint8ClampedArray(4 * 2 * 4);
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 4; x++) {
        const idx = (y * 4 + x) * 4;
        if (x < 2) {
          pixels[idx] = 255; pixels[idx + 1] = 0; pixels[idx + 2] = 0; pixels[idx + 3] = 255;
        } else {
          pixels[idx] = 0; pixels[idx + 1] = 0; pixels[idx + 2] = 255; pixels[idx + 3] = 255;
        }
      }
    }
    // blockSize=2 → two 2×2 blocks
    const result = applyPixelBlur(pixels, 4, 2, { x: 0, y: 0, width: 4, height: 2 }, 2);
    // Left block should be red, right block should be blue
    expect(getPixel(result, 4, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(getPixel(result, 4, 2, 0)).toEqual([0, 0, 255, 255]);
  });

  it('handles zero-area region gracefully', () => {
    const pixels = createPixels(2, 2, [100, 100, 100, 255]);
    const result = applyPixelBlur(pixels, 2, 2, { x: 0, y: 0, width: 0, height: 0 }, 5);
    // No pixels changed
    expect(result).toEqual(pixels);
  });

  it('handles non-integer region coordinates', () => {
    const pixels = createPixels(4, 4, [200, 100, 50, 255]);
    // Should floor the coordinates
    const result = applyPixelBlur(
      pixels, 4, 4,
      { x: 0.5, y: 0.7, width: 2.8, height: 2.3 },
      10,
    );
    // Floors to x:0, y:0, end at floor(0.5+2.8)=3, floor(0.7+2.3)=3
    // Uniform input → uniform output in blurred region
    expect(getPixel(result, 4, 0, 0)).toEqual([200, 100, 50, 255]);
  });
});
