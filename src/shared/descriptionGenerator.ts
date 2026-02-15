import type { InteractionEvent, ElementInfo } from './types';
import { TRUNCATE_LENGTH } from './constants';
import { sanitizeText, sanitizeHref } from './sanitize';
import { isSensitiveField } from './sensitiveFieldDetector';

/** Get the best human-readable label for an element, following priority chain. */
function getElementLabel(element: ElementInfo): string | undefined {
  const candidates = [
    element.ariaLabel,
    element.textContent,
    element.placeholder,
    element.title,
    element.id,
  ];
  for (const candidate of candidates) {
    if (candidate?.trim()) {
      return sanitizeText(candidate.trim(), TRUNCATE_LENGTH);
    }
  }
  return undefined;
}

/** Get a role-specific noun for the element. */
function getRoleNoun(element: ElementInfo): string {
  switch (element.ariaRole) {
    case 'tab':
      return 'tab';
    case 'menuitem':
      return 'menu item';
    default:
      return '';
  }
}

function describeClick(event: InteractionEvent): string {
  const { element } = event;

  // Sensitive fields get masked
  if (isSensitiveField(element)) {
    return 'Clicked sensitive field';
  }

  const label = getElementLabel(element);
  const roleNoun = getRoleNoun(element);

  let desc: string;
  if (label) {
    const noun = roleNoun ? `${roleNoun} ` : '';
    desc = `Clicked ${noun}'${label}'`;
  } else {
    desc = 'Clicked element';
  }

  // Append href for links
  if (element.tagName === 'A' && element.href) {
    const safeHref = sanitizeHref(element.href);
    if (safeHref) {
      desc += ` (${safeHref})`;
    }
  }

  return desc;
}

function describeInput(event: InteractionEvent): string {
  const { element } = event;

  if (isSensitiveField(element)) {
    return 'Typed in sensitive field';
  }

  const label = getElementLabel(element);

  // Include the typed value in the description when available and meaningful
  const value = event.value && event.value !== '[REDACTED]'
    ? `"${sanitizeText(event.value, TRUNCATE_LENGTH)}" `
    : '';

  if (element.tagName === 'TEXTAREA') {
    return label ? `Typed ${value}in textarea '${label}'` : `Typed ${value}in textarea`;
  }

  const inputType = element.type || 'text';
  return label
    ? `Typed ${value}in ${inputType} field '${label}'`
    : `Typed ${value}in ${inputType} field`;
}

function describeChange(event: InteractionEvent): string {
  const { element } = event;
  const label = getElementLabel(element);

  // Select element
  if (element.tagName === 'SELECT') {
    const value = event.value ? sanitizeText(event.value, TRUNCATE_LENGTH) : '';
    return label
      ? `Selected '${value}' from '${label}'`
      : `Selected '${value}'`;
  }

  // Checkbox
  if (element.type === 'checkbox') {
    const action = element.checked ? 'Checked' : 'Unchecked';
    return label ? `${action} '${label}'` : action;
  }

  // Radio
  if (element.type === 'radio') {
    return label ? `Selected '${label}'` : 'Selected radio option';
  }

  return label ? `Changed '${label}'` : 'Changed field';
}

/** Generate a human-readable description for a capture step. */
export function generateDescription(event: InteractionEvent): string {
  let desc: string;

  switch (event.type) {
    case 'click':
      desc = describeClick(event);
      break;
    case 'input':
      desc = describeInput(event);
      break;
    case 'change':
      desc = describeChange(event);
      break;
    case 'keypress':
      desc = `Pressed ${event.key ?? 'key'}`;
      break;
    case 'navigation':
      desc = `Navigated to ${event.url}`;
      break;
    case 'scroll':
      desc = 'Scrolled page';
      break;
    default:
      desc = 'Performed action';
  }

  // Iframe prefix
  if (event.element.isInIframe && !desc.startsWith('In iframe:')) {
    desc = `In iframe: ${desc}`;
  }

  return desc;
}
