import type { ExtensionMessage } from './types';

/** Send a message to the service worker (background). */
export function sendMessage(message: ExtensionMessage): Promise<unknown> {
  try {
    if (!chrome.runtime?.id) {
      return Promise.reject(new Error('Extension context invalidated'));
    }
    return chrome.runtime.sendMessage(message);
  } catch {
    return Promise.reject(new Error('Extension context invalidated'));
  }
}

/** Send a message to a specific tab's content script. */
export function sendTabMessage(
  tabId: number,
  message: ExtensionMessage,
): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, message);
}

type MessageHandler = (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => void | boolean;

/** Register a message listener. Returns an unsubscribe function. */
export function onMessage(handler: MessageHandler): () => void {
  chrome.runtime.onMessage.addListener(handler);
  return () => {
    try {
      chrome.runtime.onMessage.removeListener(handler);
    } catch {
      // Extension context invalidated — listener already dead
    }
  };
}
