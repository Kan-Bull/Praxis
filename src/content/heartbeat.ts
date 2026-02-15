import { sendMessage } from '../shared/messaging';
import { HEARTBEAT_INTERVAL } from '../shared/constants';

/** Start sending heartbeat messages to keep the service worker alive. Returns cleanup function. */
export function startHeartbeat(): () => void {
  const id = setInterval(() => {
    if (!chrome.runtime?.id) {
      clearInterval(id);
      return;
    }
    sendMessage({ type: 'HEARTBEAT', payload: {} as Record<string, never> }).catch(() => {
      // Extension context invalidated — stop heartbeat
      clearInterval(id);
    });
  }, HEARTBEAT_INTERVAL);

  return () => clearInterval(id);
}
