/**
 * Canvas compositing utilities for export.
 * Validates data URLs and composites screenshot + annotation overlay.
 */

const DATA_URL_PATTERN = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

/** Validate that a string is a safe data:image URL. */
export function validateDataUrl(dataUrl: string): boolean {
  if (!dataUrl) return false;
  return DATA_URL_PATTERN.test(dataUrl);
}

/**
 * Render Fabric.js annotations JSON to a transparent PNG data URL.
 * Uses a headless StaticCanvas — no visible DOM element needed.
 * Returns null if annotations are falsy/empty or rendering fails.
 */
export async function renderAnnotationsToDataUrl(
  annotationsJson: string,
  width: number,
  height: number,
): Promise<string | null> {
  if (!annotationsJson || annotationsJson.trim() === '') return null;

  try {
    // Parse annotation JSON to extract the editor's display scale from the
    // backgroundImage. Annotation objects are stored in the editor's scaled-down
    // coordinate space (e.g., 900px canvas for a 2560px screenshot). We need to
    // render at the editor dimensions and use `multiplier` to scale up to the
    // full screenshot resolution.
    let cleanJson = annotationsJson;
    let displayScale = 1;
    try {
      const parsed = JSON.parse(annotationsJson);
      if (parsed.backgroundImage) {
        // backgroundImage.scaleX is the ratio the editor used to fit the image
        displayScale = parsed.backgroundImage.scaleX ?? 1;
        delete parsed.backgroundImage;
        cleanJson = JSON.stringify(parsed);
      }
    } catch {
      // If JSON parse fails, proceed with original string
    }

    // Render at the editor's display dimensions (where annotations were created)
    const displayWidth = Math.round(width * displayScale);
    const displayHeight = Math.round(height * displayScale);
    const multiplier = displayScale > 0 ? 1 / displayScale : 1;

    const fabric = await import('fabric');
    const canvas = new fabric.StaticCanvas(undefined, {
      width: displayWidth,
      height: displayHeight,
    });
    await canvas.loadFromJSON(cleanJson);
    canvas.renderAll();
    // Export at full screenshot resolution using multiplier
    const dataUrl = canvas.toDataURL({ multiplier, format: 'png' });
    canvas.dispose();
    return dataUrl;
  } catch {
    return null;
  }
}

/**
 * Composite a screenshot with an annotation overlay.
 * Draws the screenshot first, then the overlay on top.
 * Returns a PNG data URL.
 */
export function compositeScreenshotWithOverlay(
  screenshotDataUrl: string,
  overlayDataUrl: string | null,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);

      if (overlayDataUrl) {
        const overlay = new Image();
        overlay.onload = () => {
          ctx.drawImage(overlay, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        overlay.onerror = () => {
          // If overlay fails, return screenshot only
          resolve(canvas.toDataURL('image/png'));
        };
        overlay.src = overlayDataUrl;
      } else {
        resolve(canvas.toDataURL('image/png'));
      }
    };
    img.onerror = () => reject(new Error('Failed to load screenshot'));
    img.src = screenshotDataUrl;
  });
}
