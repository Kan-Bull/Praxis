/**
 * Destructive pixel blur via block averaging.
 * Operates on raw RGBA pixel data — no canvas or Fabric.js dependency.
 */
export function applyPixelBlur(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  region: { x: number; y: number; width: number; height: number },
  blockSize: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels);

  // Clamp region to image bounds
  const x0 = Math.max(0, Math.floor(region.x));
  const y0 = Math.max(0, Math.floor(region.y));
  const x1 = Math.min(imageWidth, Math.floor(region.x + region.width));
  const y1 = Math.min(imageHeight, Math.floor(region.y + region.height));

  const bs = Math.max(1, Math.floor(blockSize));

  for (let by = y0; by < y1; by += bs) {
    for (let bx = x0; bx < x1; bx += bs) {
      // Compute block boundaries (clamped to region and image)
      const blockEndX = Math.min(bx + bs, x1);
      const blockEndY = Math.min(by + bs, y1);
      const blockPixels = (blockEndX - bx) * (blockEndY - by);

      if (blockPixels === 0) continue;

      // Average RGBA in this block
      let r = 0, g = 0, b = 0, a = 0;
      for (let py = by; py < blockEndY; py++) {
        for (let px = bx; px < blockEndX; px++) {
          const idx = (py * imageWidth + px) * 4;
          r += pixels[idx];
          g += pixels[idx + 1];
          b += pixels[idx + 2];
          a += pixels[idx + 3];
        }
      }

      const avgR = Math.round(r / blockPixels);
      const avgG = Math.round(g / blockPixels);
      const avgB = Math.round(b / blockPixels);
      const avgA = Math.round(a / blockPixels);

      // Write uniform color back
      for (let py = by; py < blockEndY; py++) {
        for (let px = bx; px < blockEndX; px++) {
          const idx = (py * imageWidth + px) * 4;
          result[idx] = avgR;
          result[idx + 1] = avgG;
          result[idx + 2] = avgB;
          result[idx + 3] = avgA;
        }
      }
    }
  }

  return result;
}
