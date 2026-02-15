import type { InteractionEvent } from '../shared/types';
import { sendMessage } from '../shared/messaging';
import { extractElementInfo } from './elementExtractor';
import { isSensitiveField, redactValue } from '../shared/sensitiveFieldDetector';
import { sanitizeText } from '../shared/sanitize';
import { INPUT_DEBOUNCE, TRUNCATE_LENGTH } from '../shared/constants';

/** Start tracking form input/change events. Returns a cleanup function. */
export function startFormTracker(toolbarHost: HTMLElement): () => void {
  const debounceTimers = new WeakMap<Element, number>();

  function sendFormEvent(target: Element, type: 'input' | 'change', timestamp?: number): void {
    const info = extractElementInfo(target);

    let value: string | undefined;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      if (isSensitiveField(info)) {
        value = redactValue();
      } else if (target.value) {
        value = sanitizeText(target.value, TRUNCATE_LENGTH);
      }
    }

    const event: InteractionEvent = {
      type,
      timestamp: timestamp ?? Date.now(),
      url: location.href,
      element: info,
      value,
    };

    sendMessage({ type: 'INTERACTION_EVENT', payload: { event } }).catch(() => {
      // Extension context invalidated — ignore
    });
  }

  function handleInput(e: Event): void {
    const target = e.target as Element | null;
    if (!target) return;

    if (e.composedPath().includes(toolbarHost)) return;

    // Capture timestamp at event-fire time so the debounced delivery
    // carries the real interaction time (not debounce-fire time).
    // This ensures the dedup window in captureManager works correctly
    // for checkbox/radio inputs that also fire click events.
    const timestamp = Date.now();

    // Clear existing debounce for this element
    const existing = debounceTimers.get(target);
    if (existing !== undefined) {
      clearTimeout(existing);
    }

    const timer = window.setTimeout(() => {
      debounceTimers.delete(target);
      sendFormEvent(target, 'input', timestamp);
    }, INPUT_DEBOUNCE);

    debounceTimers.set(target, timer);
  }

  function handleChange(e: Event): void {
    const target = e.target as Element | null;
    if (!target) return;

    if (e.composedPath().includes(toolbarHost)) return;

    // Change is immediate (for selects, checkboxes, radios)
    sendFormEvent(target, 'change');
  }

  document.addEventListener('input', handleInput, { capture: true });
  document.addEventListener('change', handleChange, { capture: true });

  return () => {
    document.removeEventListener('input', handleInput, { capture: true });
    document.removeEventListener('change', handleChange, { capture: true });
  };
}
