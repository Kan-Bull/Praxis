import { MAX_WIDTH, JPEG_QUALITY, THUMBNAIL_WIDTH } from '../shared/constants';

/**
 * Capture a screenshot of the visible area of a tab's window.
 * Uses chrome.tabs.get to look up windowId, then captureVisibleTab.
 */
export async function captureScreenshot(tabId: number): Promise<string> {
  const tab = await chrome.tabs.get(tabId);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: 'png',
  });
  return dataUrl;
}

/**
 * Convert a Blob to a data URL string in a service-worker-safe way.
 * Uses arrayBuffer → Uint8Array → chunked String.fromCharCode → btoa.
 * (No FileReader available in service workers.)
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Process in chunks to avoid call stack overflow on large images
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  const base64 = btoa(binary);
  return `data:${blob.type};base64,${base64}`;
}

/**
 * Resize a screenshot data URL using OffscreenCanvas (service-worker-safe).
 * Skips resize if width <= maxWidth (no upscale).
 */
export async function resizeScreenshotSW(
  dataUrl: string,
  maxWidth = MAX_WIDTH,
): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  try {
    if (bitmap.width <= maxWidth) {
      return dataUrl;
    }

    const ratio = maxWidth / bitmap.width;
    const newWidth = maxWidth;
    const newHeight = Math.round(bitmap.height * ratio);

    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

    const resultBlob = await canvas.convertToBlob({
      type: 'image/png',
    });
    return blobToDataUrl(resultBlob);
  } finally {
    bitmap.close();
  }
}

/**
 * Create a small thumbnail from a screenshot data URL.
 * Always resizes (thumbnails are always smaller than the source).
 */
export async function createThumbnailSW(
  dataUrl: string,
  thumbnailWidth = THUMBNAIL_WIDTH,
  quality = JPEG_QUALITY,
): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  try {
    const ratio = thumbnailWidth / bitmap.width;
    const newWidth = thumbnailWidth;
    const newHeight = Math.round(bitmap.height * ratio);

    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

    const resultBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality,
    });
    return blobToDataUrl(resultBlob);
  } finally {
    bitmap.close();
  }
}
