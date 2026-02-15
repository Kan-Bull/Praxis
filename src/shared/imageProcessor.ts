import { MAX_WIDTH, JPEG_QUALITY, THUMBNAIL_WIDTH } from './constants';

/** Load a data URL into an Image, resolving when loaded. */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}

/** Resize a screenshot data URL to fit within maxWidth, preserving aspect ratio. */
export async function resizeScreenshot(
  dataUrl: string,
  maxWidth = MAX_WIDTH,
  quality = JPEG_QUALITY,
): Promise<string> {
  const img = await loadImage(dataUrl);

  // Don't upscale
  if (img.width <= maxWidth) {
    return dataUrl;
  }

  const ratio = maxWidth / img.width;
  const newWidth = maxWidth;
  const newHeight = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2d context');

  ctx.drawImage(img, 0, 0, newWidth, newHeight);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Create a small thumbnail from a screenshot data URL. */
export async function createThumbnail(
  dataUrl: string,
  thumbnailWidth = THUMBNAIL_WIDTH,
  quality = JPEG_QUALITY,
): Promise<string> {
  const img = await loadImage(dataUrl);

  const ratio = thumbnailWidth / img.width;
  const newWidth = thumbnailWidth;
  const newHeight = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2d context');

  ctx.drawImage(img, 0, 0, newWidth, newHeight);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Crop a screenshot data URL to the specified region, returning a PNG data URL. */
export async function cropScreenshot(
  dataUrl: string,
  region: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = region.width;
  canvas.height = region.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2d context');

  ctx.drawImage(
    img,
    region.x, region.y, region.width, region.height,
    0, 0, region.width, region.height,
  );
  return canvas.toDataURL('image/png');
}

/** Re-compress a screenshot data URL at the given quality. */
export async function compressScreenshot(
  dataUrl: string,
  quality = JPEG_QUALITY,
): Promise<string> {
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2d context');

  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}
