/**
 * Coordination lock between the pre-click buffer (hides toolbar on mousedown)
 * and the SHOW_TOOLBAR message handler. Prevents SHOW_TOOLBAR from a previous
 * step's pipeline from re-showing the toolbar while a pre-click capture is
 * in flight.
 */

let locked = false;
let pendingShow: (() => void) | null = null;

/** Lock: toolbar hide is in progress for a pre-click capture. */
export function lockForScreenshot(): void {
  locked = true;
  pendingShow = null;
}

/** Unlock: pre-click capture is complete, safe to show toolbar. */
export function unlockScreenshot(): void {
  locked = false;
  if (pendingShow) {
    const fn = pendingShow;
    pendingShow = null;
    fn();
  }
}

/** True while a pre-click capture is in progress. */
export function isScreenshotLocked(): boolean {
  return locked;
}

/** Defer a show-toolbar call until the screenshot lock is released. */
export function deferShowToolbar(fn: () => void): void {
  pendingShow = fn;
}
