import { vi } from 'vitest';

// Chrome API mock factory
function createChromeApiMocks() {
  return {
    runtime: {
      id: 'test-extension-id',
      sendMessage: vi.fn().mockResolvedValue({ status: 'ok' }),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
      },
      getURL: vi.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
      onInstalled: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
      },
      onStartup: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
      },
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      captureVisibleTab: vi.fn().mockResolvedValue('data:image/png;base64,iVBORw=='),
      get: vi
        .fn()
        .mockResolvedValue({
          id: 1,
          windowId: 1,
          url: 'https://example.com',
          title: 'Example',
        }),
      create: vi.fn().mockResolvedValue({ id: 2, url: 'about:blank' }),
      sendMessage: vi.fn().mockResolvedValue({ status: 'ok' }),
      onCreated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
      },
      onRemoved: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
      },
      onUpdated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
      },
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([{ result: undefined }]),
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
        getBytesInUse: vi.fn().mockResolvedValue(0),
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
          hasListener: vi.fn().mockReturnValue(false),
        },
      },
    },
    webNavigation: {
      onHistoryStateUpdated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
      },
      onCommitted: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
      },
      onCompleted: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
      },
    },
  };
}

// Install mocks globally
const chromeMock = createChromeApiMocks();
Object.defineProperty(globalThis, 'chrome', {
  value: chromeMock,
  writable: true,
  configurable: true,
});

// Helper: jsdom getBoundingClientRect returns all zeros; use this to mock per element
export function mockBoundingRect(
  el: Element,
  rect: Partial<DOMRect>,
): void {
  const full = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({}),
    ...rect,
  };
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(full as DOMRect);
}

export { chromeMock };
