import type { ExtensionMessage } from '../shared/types';
import { onMessage } from '../shared/messaging';
import { logger } from '../shared/logger';
import { createToolbar, appendToBody } from './toolbar';
import { startClickTracker } from './clickTracker';
import { startFormTracker } from './formTracker';
import { startHeartbeat } from './heartbeat';
import { startPreClickBuffer } from './preClickBuffer';
import { startNavigationHandler } from './navigationHandler';
import { waitForDomSettle } from './domSettle';
import { hideScrollbars, showScrollbars } from './scrollbarHide';
import { isScreenshotLocked, deferShowToolbar } from './screenshotLock';

// Injection guard — prevent duplicate listeners on re-injection
if (!window.__praxisInjected) {
  window.__praxisInjected = true;

  void (async () => {
    logger.log('Content script loaded on:', location.href);

    let stepCount = 0;

    // Create toolbar — use appendToBody to handle early injection (before body exists)
    const toolbar = createToolbar(teardown, teardown);
    appendToBody(toolbar.host);

    // Start all trackers
    const cleanups = [
      startClickTracker(toolbar.host),
      startFormTracker(toolbar.host),
      startHeartbeat(),
      startPreClickBuffer(toolbar, toolbar.host),
      startNavigationHandler(),
    ];

    // Listen for toolbar hide/show commands from service worker
    const unsubscribe = onMessage((message: ExtensionMessage, _sender, sendResponse) => {
      switch (message.type) {
        case 'HIDE_TOOLBAR':
          toolbar.hideForScreenshot();
          hideScrollbars();
          waitForDomSettle().then(() => {
            sendResponse?.({ status: 'ok' });
          });
          return true; // async response
        case 'SHOW_TOOLBAR':
          stepCount++;
          toolbar.setStepCount(stepCount);
          if (isScreenshotLocked()) {
            // A pre-click capture is in flight — don't re-show the toolbar
            // yet. Defer until the screenshot lock is released.
            deferShowToolbar(() => {
              toolbar.showAfterScreenshot();
              showScrollbars();
            });
          } else {
            toolbar.showAfterScreenshot();
            showScrollbars();
          }
          sendResponse?.({ status: 'ok', stepCount });
          return false;
        case 'RESTORE_TOOLBAR':
          stepCount = message.payload.stepCount;
          toolbar.setStepCount(stepCount);
          if (message.payload.position) {
            toolbar.setPosition(message.payload.position.x, message.payload.position.y);
          }
          toolbar.show();
          sendResponse?.({ status: 'ok' });
          return false;
        default:
          return; // not handled
      }
    });

    function teardown(): void {
      logger.log('Content script tearing down');
      for (const fn of cleanups) fn();
      unsubscribe();
      toolbar.destroy();
      window.__praxisInjected = false;
    }
  })();
}
