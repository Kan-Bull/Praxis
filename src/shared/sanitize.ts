import { SANITIZE_MAX } from './constants';

/** Strip angle brackets, control characters, trim, and truncate. */
export function sanitizeText(text: string, maxLength = SANITIZE_MAX): string {
  if (!text) return '';
  return text
    .replace(/[<>]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/** Allow only http/https hrefs. Returns undefined for anything else. */
export function sanitizeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return href;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Strip control characters and truncate class names. */
export function sanitizeClassName(className: string, maxLength = SANITIZE_MAX): string {
  if (!className) return '';
  return className
    .replace(/[\x00-\x1F\x7F]/g, '')
    .slice(0, maxLength);
}

/** Validate URL via URL constructor, allow only http/https. */
export function sanitizeUrl(url: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
