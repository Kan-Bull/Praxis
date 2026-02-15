import { sendMessage } from '../shared/messaging';
import { hideScrollbars } from './scrollbarHide';
import { lockForScreenshot, unlockScreenshot } from './screenshotLock';

interface ToolbarScreenshotHandle {
  hideForScreenshot: () => void;
}

/**
 * Wait for the browser to actually composite the CSS changes.
 * Double-rAF ensures two animation frames have passed — the first rAF fires
 * before the current paint, the second fires before the NEXT paint, so by
 * the time the inner setTimeout runs, the compositor has committed the frame
 * with the CSS changes (opacity:0, visibility:hidden).
 */
function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
    });
  });
}

/** Start sending PRE_CLICK_BUFFER on mousedown. Returns cleanup function. */
export function startPreClickBuffer(
  toolbar: ToolbarScreenshotHandle,
  toolbarHost: HTMLElement,
): () => void {
  function onMouseDown(e: MouseEvent): void {
    // Ignore clicks on the toolbar itself
    if (toolbarHost.contains(e.target as Node)) return;

    // Lock prevents incoming SHOW_TOOLBAR (from a previous step's pipeline)
    // from re-showing the toolbar before captureVisibleTab runs.
    lockForScreenshot();
    toolbar.hideForScreenshot();
    hideScrollbars();
    waitForPaint().then(() => {
      sendMessage({ type: 'PRE_CLICK_BUFFER', payload: { timestamp: Date.now() } })
        .then(() => {
          unlockScreenshot();
        })
        .catch(() => {
          unlockScreenshot();
        });
    });
  }

  document.addEventListener('mousedown', onMouseDown, { capture: true });

  return () => {
    document.removeEventListener('mousedown', onMouseDown, { capture: true });
  };
}
