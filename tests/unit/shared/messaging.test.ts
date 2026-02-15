import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendMessage, sendTabMessage, onMessage } from '@shared/messaging';
import type { ExtensionMessage } from '@shared/types';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendMessage', () => {
  it('should call chrome.runtime.sendMessage with the message', async () => {
    const msg: ExtensionMessage = { type: 'HEARTBEAT', payload: {} };
    await sendMessage(msg);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(msg);
  });

  it('should return the response', async () => {
    const msg: ExtensionMessage = { type: 'GET_SESSION_DATA', payload: {} };
    const result = await sendMessage(msg);
    expect(result).toEqual({ status: 'ok' });
  });

  it('should reject when extension context is invalidated (id undefined)', async () => {
    const originalId = chrome.runtime.id;
    Object.defineProperty(chrome.runtime, 'id', {
      value: undefined,
      configurable: true,
    });

    await expect(
      sendMessage({ type: 'HEARTBEAT', payload: {} as Record<string, never> }),
    ).rejects.toThrow('Extension context invalidated');

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();

    Object.defineProperty(chrome.runtime, 'id', {
      value: originalId,
      configurable: true,
    });
  });

  it('should reject when chrome.runtime.sendMessage throws synchronously', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(() => {
      throw new Error('Extension context invalidated.');
    });

    await expect(
      sendMessage({ type: 'HEARTBEAT', payload: {} as Record<string, never> }),
    ).rejects.toThrow('Extension context invalidated');
  });
});

describe('sendTabMessage', () => {
  it('should call chrome.tabs.sendMessage with tabId and message', async () => {
    const msg: ExtensionMessage = { type: 'HIDE_TOOLBAR', payload: {} };
    await sendTabMessage(42, msg);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, msg);
  });
});

describe('onMessage', () => {
  it('should register a listener via chrome.runtime.onMessage.addListener', () => {
    const handler = vi.fn();
    onMessage(handler);
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it('should return an unsubscribe function', () => {
    const handler = vi.fn();
    const unsubscribe = onMessage(handler);
    expect(typeof unsubscribe).toBe('function');
  });

  it('should remove the listener when unsubscribe is called', () => {
    const handler = vi.fn();
    const unsubscribe = onMessage(handler);
    unsubscribe();
    expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalled();
  });
});
