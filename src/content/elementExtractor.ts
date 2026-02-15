import type { ElementInfo, BoundingRectLike } from '../shared/types';
import { sanitizeText, sanitizeHref } from '../shared/sanitize';
import { isSensitiveField, redactValue } from '../shared/sensitiveFieldDetector';
import { TRUNCATE_LENGTH } from '../shared/constants';

/** Convert DOMRect to a plain serializable object. */
function toRectLike(rect: DOMRect): BoundingRectLike {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
  };
}

/** Detect whether we're inside an iframe (cross-origin safe). */
function detectIframe(): boolean {
  try {
    return window !== window.top;
  } catch {
    // Cross-origin iframe throws SecurityError — we are in an iframe
    return true;
  }
}

/** Extract structured metadata from a DOM element. */
export function extractElementInfo(element: Element): ElementInfo {
  const el = element as HTMLElement;
  const tagName = el.tagName.toLowerCase();

  const info: ElementInfo = {
    tagName,
    boundingRect: toRectLike(el.getBoundingClientRect()),
    isInIframe: detectIframe(),
  };

  if (el.id) info.id = el.id;
  if (el.className && typeof el.className === 'string') info.className = el.className;

  const text = el.textContent?.trim();
  if (text) info.textContent = sanitizeText(text, TRUNCATE_LENGTH);

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) info.ariaLabel = ariaLabel;

  const ariaRole = el.getAttribute('role');
  if (ariaRole) info.ariaRole = ariaRole;

  // Anchor href
  if ('href' in el) {
    const href = sanitizeHref((el as HTMLAnchorElement).href);
    if (href) info.href = href;
  }

  // Form element attributes
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    if (el.type) info.type = el.type;
    if (el.name) info.name = el.name;
    if ('placeholder' in el && (el as HTMLInputElement).placeholder) {
      info.placeholder = (el as HTMLInputElement).placeholder;
    }
    if ('autocomplete' in el && (el as HTMLInputElement).autocomplete) {
      info.autocomplete = (el as HTMLInputElement).autocomplete;
    }
  }

  if (el.title) info.title = el.title;

  // Value extraction with sensitive field redaction
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    if (isSensitiveField(info)) {
      info.value = redactValue();
    } else if (el.value) {
      info.value = sanitizeText(el.value, TRUNCATE_LENGTH);
    }
  }

  // Checked state for checkboxes/radios
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    info.checked = el.checked;
  }

  return info;
}
