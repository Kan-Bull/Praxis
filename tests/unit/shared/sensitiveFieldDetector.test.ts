import { describe, it, expect } from 'vitest';
import {
  isSensitiveField,
  redactValue,
  redactUrlParams,
} from '@shared/sensitiveFieldDetector';
import type { ElementInfo } from '@shared/types';

function makeElement(overrides: Partial<ElementInfo> = {}): ElementInfo {
  return {
    tagName: 'INPUT',
    boundingRect: { x: 0, y: 0, width: 100, height: 30, top: 0, right: 100, bottom: 30, left: 0 },
    isInIframe: false,
    ...overrides,
  };
}

describe('isSensitiveField', () => {
  it('should detect type=password', () => {
    expect(isSensitiveField(makeElement({ type: 'password' }))).toBe(true);
  });

  it('should detect autocomplete=cc-number', () => {
    expect(isSensitiveField(makeElement({ autocomplete: 'cc-number' }))).toBe(true);
  });

  it('should detect autocomplete=cc-exp', () => {
    expect(isSensitiveField(makeElement({ autocomplete: 'cc-exp' }))).toBe(true);
  });

  it('should detect autocomplete=cc-csc', () => {
    expect(isSensitiveField(makeElement({ autocomplete: 'cc-csc' }))).toBe(true);
  });

  it('should detect name containing "password"', () => {
    expect(isSensitiveField(makeElement({ name: 'user_password' }))).toBe(true);
  });

  it('should detect name containing "ssn"', () => {
    expect(isSensitiveField(makeElement({ name: 'ssn_field' }))).toBe(true);
  });

  it('should detect id containing "pin" with word boundaries', () => {
    expect(isSensitiveField(makeElement({ id: 'user-pin' }))).toBe(true);
  });

  it('should NOT match "pin" inside words like "opinion"', () => {
    expect(isSensitiveField(makeElement({ id: 'opinion-field' }))).toBe(false);
  });

  it('should NOT match "pin" inside words like "spinning"', () => {
    expect(isSensitiveField(makeElement({ name: 'spinning-wheel' }))).toBe(false);
  });

  it('should detect id containing "secret"', () => {
    expect(isSensitiveField(makeElement({ id: 'client-secret' }))).toBe(true);
  });

  it('should detect name containing "token"', () => {
    expect(isSensitiveField(makeElement({ name: 'auth_token' }))).toBe(true);
  });

  it('should detect name containing "cvv"', () => {
    expect(isSensitiveField(makeElement({ name: 'card-cvv' }))).toBe(true);
  });

  it('should return false for regular text input', () => {
    expect(isSensitiveField(makeElement({ type: 'text', name: 'username' }))).toBe(false);
  });

  it('should return false for non-input elements', () => {
    expect(isSensitiveField(makeElement({ tagName: 'DIV' }))).toBe(false);
  });

  it('should detect name containing "social_security"', () => {
    expect(isSensitiveField(makeElement({ name: 'social_security_number' }))).toBe(true);
  });

  it('should detect name containing "routing_number"', () => {
    expect(isSensitiveField(makeElement({ name: 'routing_number' }))).toBe(true);
  });

  it('should detect name containing "account_number"', () => {
    expect(isSensitiveField(makeElement({ name: 'account_number' }))).toBe(true);
  });

  it('should detect name containing "dob"', () => {
    expect(isSensitiveField(makeElement({ name: 'user-dob' }))).toBe(true);
  });

  it('should detect name containing "date_of_birth"', () => {
    expect(isSensitiveField(makeElement({ name: 'date_of_birth' }))).toBe(true);
  });

  it('should detect name containing "passport"', () => {
    expect(isSensitiveField(makeElement({ name: 'passport-number' }))).toBe(true);
  });

  it('should detect name containing "driver_license"', () => {
    expect(isSensitiveField(makeElement({ name: 'driver_license' }))).toBe(true);
  });

  it('should detect name containing "api_key"', () => {
    expect(isSensitiveField(makeElement({ name: 'api_key' }))).toBe(true);
  });

  it('should detect sensitive placeholder text', () => {
    expect(isSensitiveField(makeElement({ placeholder: 'Enter your SSN' }))).toBe(true);
  });

  it('should detect sensitive ariaLabel text', () => {
    expect(isSensitiveField(makeElement({ ariaLabel: 'password-field' }))).toBe(true);
  });

  it('should NOT flag non-sensitive placeholder', () => {
    expect(isSensitiveField(makeElement({ placeholder: 'Enter your name' }))).toBe(false);
  });
});

describe('redactValue', () => {
  it('should return [REDACTED]', () => {
    expect(redactValue()).toBe('[REDACTED]');
  });
});

describe('redactUrlParams', () => {
  it('should redact token param', () => {
    const result = redactUrlParams('https://example.com/path?token=abc123&page=1');
    expect(result).toContain('token=%5BREDACTED%5D');
    expect(result).toContain('page=1');
  });

  it('should redact session param', () => {
    const result = redactUrlParams('https://example.com?session=xyz');
    expect(result).toContain('session=%5BREDACTED%5D');
  });

  it('should redact apiKey param', () => {
    const result = redactUrlParams('https://example.com?apiKey=secret123');
    expect(result).toContain('apiKey=%5BREDACTED%5D');
  });

  it('should redact clientId param', () => {
    const result = redactUrlParams('https://example.com?clientId=id123');
    expect(result).toContain('clientId=%5BREDACTED%5D');
  });

  it('should handle URLs without sensitive params', () => {
    const url = 'https://example.com/path?page=1&sort=asc';
    expect(redactUrlParams(url)).toBe(url);
  });

  it('should handle invalid URLs gracefully', () => {
    expect(redactUrlParams('not-a-url')).toBe('not-a-url');
  });
});
