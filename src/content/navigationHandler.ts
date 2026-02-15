import type { ExtensionMessage, InteractionEvent, ElementInfo, BoundingRectLike } from '../shared/types';
import { sendMessage, onMessage } from '../shared/messaging';

/** Handle NAVIGATION_DETECTED messages from the service worker. Returns cleanup function. */
export function startNavigationHandler(): () => void {
  const emptyRect: BoundingRectLike = { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };

  return onMessage((message: ExtensionMessage) => {
    if (message.type !== 'NAVIGATION_DETECTED') return;

    const element: ElementInfo = {
      tagName: 'window',
      boundingRect: emptyRect,
      isInIframe: false,
    };

    const event: InteractionEvent = {
      type: 'navigation',
      timestamp: Date.now(),
      url: message.payload.url,
      element,
    };

    sendMessage({ type: 'INTERACTION_EVENT', payload: { event } }).catch(() => {});
  });
}
