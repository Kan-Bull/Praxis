import type { InteractionEvent } from '../shared/types';
import { sendMessage } from '../shared/messaging';
import { extractElementInfo } from './elementExtractor';
import { flashHighlight } from './highlighter';

/** Tags that are natively interactive (focusable or clickable). */
const INTERACTIVE_TAGS = new Set([
  'a', 'button', 'input', 'select', 'textarea', 'label',
  'details', 'summary', 'audio', 'video',
]);

/** ARIA roles that indicate interactive widgets. */
const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'tab', 'menuitem', 'menuitemcheckbox',
  'menuitemradio', 'option', 'switch', 'checkbox', 'radio',
  'combobox', 'listbox', 'searchbox', 'slider', 'spinbutton',
  'textbox', 'treeitem',
]);

/** Check if an element is semantically interactive. */
function isInteractive(el: Element): boolean {
  if (INTERACTIVE_TAGS.has(el.tagName.toLowerCase())) return true;
  const role = el.getAttribute('role');
  if (role && INTERACTIVE_ROLES.has(role)) return true;
  if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/**
 * Walk up from click target to find the nearest interactive ancestor.
 * Returns the interactive element, or null if none found within limit.
 */
function findInteractiveTarget(target: Element, limit = 5): Element | null {
  let el: Element | null = target;
  let depth = 0;
  while (el && el !== document.body && el !== document.documentElement && depth <= limit) {
    if (isInteractive(el)) return el;
    el = el.parentElement;
    depth++;
  }
  return null;
}

/** Start tracking clicks. Returns a cleanup function. */
export function startClickTracker(toolbarHost: HTMLElement): () => void {
  function handler(e: MouseEvent): void {
    const target = e.target as Element | null;
    if (!target) return;

    // Ignore clicks inside the toolbar
    const path = e.composedPath();
    if (path.includes(toolbarHost)) return;

    // Ignore meaningless targets
    const tag = target.tagName.toLowerCase();
    if (tag === 'html' || tag === 'body') return;

    // Find the nearest interactive element (target or ancestor).
    // Skips accidental clicks on page background / layout containers.
    const interactiveEl = findInteractiveTarget(target);
    if (!interactiveEl) return;

    const info = extractElementInfo(interactiveEl);

    // Skip zero-size elements
    if (info.boundingRect.width === 0 && info.boundingRect.height === 0) return;

    const event: InteractionEvent = {
      type: 'click',
      timestamp: Date.now(),
      url: location.href,
      element: info,
      clickX: e.clientX,
      clickY: e.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };

    sendMessage({ type: 'INTERACTION_EVENT', payload: { event } }).catch(() => {
      // Extension context invalidated — ignore
    });
    flashHighlight(info.boundingRect);
  }

  document.addEventListener('click', handler, { capture: true });

  return () => {
    document.removeEventListener('click', handler, { capture: true });
  };
}
