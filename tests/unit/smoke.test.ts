import { describe, it, expect } from 'vitest';

describe('Test Infrastructure', () => {
  it('should run a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have chrome API mocked', () => {
    expect(chrome).toBeDefined();
    expect(chrome.runtime).toBeDefined();
    expect(chrome.runtime.id).toBe('test-extension-id');
  });

  it('should have chrome.tabs mocked', () => {
    expect(chrome.tabs).toBeDefined();
    expect(chrome.tabs.query).toBeDefined();
  });

  it('should have chrome.storage mocked', () => {
    expect(chrome.storage).toBeDefined();
    expect(chrome.storage.local).toBeDefined();
  });

  it('should have chrome.scripting mocked', () => {
    expect(chrome.scripting).toBeDefined();
    expect(chrome.scripting.executeScript).toBeDefined();
  });
});
