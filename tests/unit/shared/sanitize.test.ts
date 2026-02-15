import { describe, it, expect } from 'vitest';
import {
  sanitizeText,
  sanitizeHref,
  sanitizeClassName,
  sanitizeUrl,
} from '@shared/sanitize';

describe('sanitizeText', () => {
  it('should strip angle brackets', () => {
    expect(sanitizeText('hello <script>alert(1)</script> world')).toBe(
      'hello scriptalert(1)/script world',
    );
  });

  it('should strip control characters', () => {
    expect(sanitizeText('hello\x00\x01\x02world')).toBe('helloworld');
  });

  it('should trim whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('should truncate to max length', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeText(long).length).toBe(200);
  });

  it('should handle empty string', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('should handle undefined/null-like by returning empty string', () => {
    expect(sanitizeText(undefined as unknown as string)).toBe('');
    expect(sanitizeText(null as unknown as string)).toBe('');
  });

  it('should accept custom max length', () => {
    expect(sanitizeText('abcdefgh', 5)).toBe('abcde');
  });
});

describe('sanitizeHref', () => {
  it('should allow http URLs', () => {
    expect(sanitizeHref('http://example.com')).toBe('http://example.com');
  });

  it('should allow https URLs', () => {
    expect(sanitizeHref('https://example.com/path?q=1')).toBe(
      'https://example.com/path?q=1',
    );
  });

  it('should reject javascript: URLs', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBeUndefined();
  });

  it('should reject data: URLs', () => {
    expect(sanitizeHref('data:text/html,<h1>hi</h1>')).toBeUndefined();
  });

  it('should reject empty string', () => {
    expect(sanitizeHref('')).toBeUndefined();
  });

  it('should reject undefined', () => {
    expect(sanitizeHref(undefined)).toBeUndefined();
  });

  it('should reject malformed URLs', () => {
    expect(sanitizeHref('not-a-url')).toBeUndefined();
  });
});

describe('sanitizeClassName', () => {
  it('should strip control characters', () => {
    expect(sanitizeClassName('btn\x00primary')).toBe('btnprimary');
  });

  it('should truncate long class names', () => {
    const long = 'cls-' + 'a'.repeat(300);
    expect(sanitizeClassName(long).length).toBe(200);
  });

  it('should handle undefined', () => {
    expect(sanitizeClassName(undefined as unknown as string)).toBe('');
  });
});

describe('sanitizeUrl', () => {
  it('should accept valid http URL', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com/');
  });

  it('should accept valid https URL', () => {
    expect(sanitizeUrl('https://example.com/path')).toBe(
      'https://example.com/path',
    );
  });

  it('should reject javascript: protocol', () => {
    expect(sanitizeUrl('javascript:void(0)')).toBeUndefined();
  });

  it('should reject invalid URL', () => {
    expect(sanitizeUrl('not a url')).toBeUndefined();
  });

  it('should reject empty string', () => {
    expect(sanitizeUrl('')).toBeUndefined();
  });
});
