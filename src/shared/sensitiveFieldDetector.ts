import type { ElementInfo } from './types';

/**
 * Patterns that indicate sensitive data.
 * Use (?:^|[-_\s]) and (?:[-_\s]|$) as boundaries instead of \b,
 * because \b treats underscore as a word char (so "ssn_field" would
 * fail with \bssn\b since _ is adjacent to n).
 */
const SENSITIVE_PATTERNS = [
  /(?:^|[-_\s])password(?:[-_\s]|$)/i,
  /(?:^|[-_\s])passwd(?:[-_\s]|$)/i,
  /(?:^|[-_\s])secret(?:[-_\s]|$)/i,
  /(?:^|[-_\s])token(?:[-_\s]|$)/i,
  /(?:^|[-_\s])ssn(?:[-_\s]|$)/i,
  /(?:^|[-_\s])cvv(?:[-_\s]|$)/i,
  /(?:^|[-_\s])cvc(?:[-_\s]|$)/i,
  /(?:^|[-_\s])pin(?:[-_\s]|$)/i,
  /(?:^|[-_\s])creditcard(?:[-_\s]|$)/i,
  /(?:^|[-_\s])credit[-_\s.]card(?:[-_\s]|$)/i,
  /(?:^|[-_\s])card[-_\s.]number(?:[-_\s]|$)/i,
  /(?:^|[-_\s])social[-_\s.]?security(?:[-_\s]|$)/i,
  /(?:^|[-_\s])routing[-_\s.]?number(?:[-_\s]|$)/i,
  /(?:^|[-_\s])account[-_\s.]?number(?:[-_\s]|$)/i,
  /(?:^|[-_\s])dob(?:[-_\s]|$)/i,
  /(?:^|[-_\s])date[-_\s.]?of[-_\s.]?birth(?:[-_\s]|$)/i,
  /(?:^|[-_\s])passport(?:[-_\s]|$)/i,
  /(?:^|[-_\s])driver[-_\s.]?licen/i,
  /(?:^|[-_\s])api[-_\s.]?key(?:[-_\s]|$)/i,
];

const SENSITIVE_AUTOCOMPLETE = /^cc-/;

/** Check if an element captures sensitive data. */
export function isSensitiveField(element: ElementInfo): boolean {
  // Type check
  if (element.type === 'password') return true;

  // Autocomplete check (cc-number, cc-exp, cc-csc, etc.)
  if (element.autocomplete && SENSITIVE_AUTOCOMPLETE.test(element.autocomplete)) {
    return true;
  }

  // Check name, id, placeholder, and ariaLabel against patterns
  const fieldsToCheck = [element.name, element.id, element.placeholder, element.ariaLabel].filter(Boolean) as string[];
  for (const field of fieldsToCheck) {
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(field)) return true;
    }
  }

  return false;
}

/** Returns a redacted placeholder value. */
export function redactValue(): string {
  return '[REDACTED]';
}

/** Sensitive URL parameter names to redact. */
const SENSITIVE_PARAMS = ['token', 'session', 'apikey', 'clientid', 'secret', 'password'];

/** Redact sensitive query parameters from a URL. */
export function redactUrlParams(url: string): string {
  try {
    const parsed = new URL(url);
    let changed = false;
    for (const key of parsed.searchParams.keys()) {
      if (SENSITIVE_PARAMS.includes(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]');
        changed = true;
      }
    }
    return changed ? parsed.href : url;
  } catch {
    return url;
  }
}
