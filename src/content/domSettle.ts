import { sendMessage } from '../shared/messaging';
import { MUTATION_SETTLE_TIME, MUTATION_MAX_WAIT } from '../shared/constants';

/** Wait for DOM mutations to settle, then send DOM_SETTLED message. */
export function waitForDomSettle(): Promise<void> {
  return new Promise<void>((resolve) => {
    let settleTimer: number | undefined;
    let maxTimer: number | undefined;

    function done(): void {
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      if (maxTimer !== undefined) clearTimeout(maxTimer);
      observer.disconnect();
      sendMessage({ type: 'DOM_SETTLED', payload: { url: location.href } }).catch(() => {});
      resolve();
    }

    function resetSettle(): void {
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      settleTimer = window.setTimeout(done, MUTATION_SETTLE_TIME);
    }

    const observer = new MutationObserver(() => {
      resetSettle();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    // Start the settle timer (will fire if no mutations happen)
    resetSettle();

    // Max wait safety cap
    maxTimer = window.setTimeout(done, MUTATION_MAX_WAIT);
  });
}
