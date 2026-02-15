import { describe, it, expect } from 'vitest';
import { scanStepsForSensitiveData } from '../../../src/editor/lib/sensitiveTextScanner';

describe('sensitiveTextScanner', () => {
  it('detects email addresses', () => {
    const matches = scanStepsForSensitiveData([
      { id: 's1', description: 'Enter user@example.com in the field' },
    ]);
    expect(matches).toEqual([
      { pattern: 'email', match: 'user@example.com', stepId: 's1' },
    ]);
  });

  it('detects SSN patterns', () => {
    const matches = scanStepsForSensitiveData([
      { id: 's1', description: 'Type 123-45-6789 in SSN box' },
    ]);
    expect(matches.some((m) => m.pattern === 'ssn' && m.match === '123-45-6789')).toBe(true);
  });

  it('detects credit card patterns', () => {
    const matches = scanStepsForSensitiveData([
      { id: 's1', description: 'Enter 4111111111111111 as card number' },
    ]);
    expect(matches.some((m) => m.pattern === 'credit-card')).toBe(true);
  });

  it('detects phone numbers', () => {
    const matches = scanStepsForSensitiveData([
      { id: 's1', description: 'Call (555) 123-4567 for support' },
    ]);
    expect(matches.some((m) => m.pattern === 'phone')).toBe(true);
  });

  it('does not false-positive on dates', () => {
    const matches = scanStepsForSensitiveData([
      { id: 's1', description: 'Created on 2024-01-15' },
    ]);
    // Dates should not match SSN (format is YYYY-MM-DD, not DDD-DD-DDDD)
    const ssnMatches = matches.filter((m) => m.pattern === 'ssn');
    expect(ssnMatches).toHaveLength(0);
  });

  it('does not false-positive on short order numbers', () => {
    const matches = scanStepsForSensitiveData([
      { id: 's1', description: 'Order #12345 confirmed' },
    ]);
    // 5-digit number should not trigger credit card
    const ccMatches = matches.filter((m) => m.pattern === 'credit-card');
    expect(ccMatches).toHaveLength(0);
  });

  it('returns multiple matches across multiple steps', () => {
    const matches = scanStepsForSensitiveData([
      { id: 's1', description: 'Email: alice@test.com' },
      { id: 's2', description: 'SSN: 111-22-3333' },
    ]);
    expect(matches).toHaveLength(2);
    expect(matches[0].stepId).toBe('s1');
    expect(matches[1].stepId).toBe('s2');
  });

  it('returns empty array for clean descriptions', () => {
    const matches = scanStepsForSensitiveData([
      { id: 's1', description: 'Click the submit button' },
      { id: 's2', description: 'Navigate to settings page' },
    ]);
    expect(matches).toHaveLength(0);
  });

  it('handles empty input', () => {
    expect(scanStepsForSensitiveData([])).toEqual([]);
  });
});
