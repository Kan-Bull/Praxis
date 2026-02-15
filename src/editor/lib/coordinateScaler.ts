import type { BoundingRectLike } from '@shared/types';

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScaleContext {
  viewportWidth: number;
  viewportHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Transform viewport-relative coordinates to Fabric.js canvas coordinates.
 *
 * The scaling formula is:
 *   canvasX = viewportX * (canvasWidth / viewportWidth)
 *   canvasY = viewportY * (canvasHeight / viewportHeight)
 *
 * Guards against division by zero when viewportWidth or viewportHeight is 0.
 */
export function viewportToCanvas(
  viewportX: number,
  viewportY: number,
  ctx: ScaleContext,
): { x: number; y: number } {
  if (ctx.viewportWidth === 0 || ctx.viewportHeight === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: viewportX * (ctx.canvasWidth / ctx.viewportWidth),
    y: viewportY * (ctx.canvasHeight / ctx.viewportHeight),
  };
}

/**
 * Compute the center point of a bounding rect.
 * Used as a fallback when exact click coordinates (clickX/clickY) are absent.
 */
export function boundingRectCenter(
  rect: BoundingRectLike,
): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

const DEFAULT_PADDING = 200;
const DEFAULT_PADDING_PERCENT = 15;
const MIN_CROP_WIDTH = 400;

/**
 * Compute a crop region around an interacted element, scaled from viewport
 * space to image space. Adds generous padding and clamps to image bounds.
 *
 * Returns null when viewport dimensions are missing (graceful degradation).
 */
export function computeCropRegion(
  boundingRect: BoundingRectLike,
  viewportWidth: number,
  viewportHeight: number,
  imageWidth: number,
  imageHeight: number,
  padding = DEFAULT_PADDING,
  paddingPercent = DEFAULT_PADDING_PERCENT,
): CropRegion | null {
  if (viewportWidth <= 0 || viewportHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return null;
  }

  const scaleX = imageWidth / viewportWidth;
  const scaleY = imageHeight / viewportHeight;

  // Scale bounding rect from viewport to image space
  const imgLeft = boundingRect.left * scaleX;
  const imgTop = boundingRect.top * scaleY;
  const imgWidth = boundingRect.width * scaleX;
  const imgHeight = boundingRect.height * scaleY;

  // Padding: use the larger of fixed px or percentage of element size
  const percentPad = (paddingPercent / 100) * Math.max(imgWidth, imgHeight);
  const pad = Math.max(padding, percentPad);

  // Expand region by pad on all sides
  let x = imgLeft - pad;
  let y = imgTop - pad;
  let w = imgWidth + pad * 2;
  let h = imgHeight + pad * 2;

  // Enforce minimum crop width (keep aspect ratio)
  if (w < MIN_CROP_WIDTH && imageWidth >= MIN_CROP_WIDTH) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const aspectRatio = h / w;
    w = MIN_CROP_WIDTH;
    h = w * aspectRatio;
    x = cx - w / 2;
    y = cy - h / 2;
  }

  // Clamp to image bounds
  x = Math.max(0, x);
  y = Math.max(0, y);
  w = Math.min(w, imageWidth - x);
  h = Math.min(h, imageHeight - y);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(w),
    height: Math.round(h),
  };
}

/**
 * Adjust a click position (in image-space pixels) for a crop operation.
 * Returns the click position relative to the crop origin, or null if the
 * click falls outside the crop region.
 */
export function adjustClickForCrop(
  imgClickX: number,
  imgClickY: number,
  crop: CropRegion,
): { x: number; y: number } | null {
  if (
    imgClickX < crop.x || imgClickX > crop.x + crop.width ||
    imgClickY < crop.y || imgClickY > crop.y + crop.height
  ) {
    return null;
  }
  return {
    x: imgClickX - crop.x,
    y: imgClickY - crop.y,
  };
}
