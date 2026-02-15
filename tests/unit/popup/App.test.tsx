import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, waitFor, fireEvent, act } from '@testing-library/preact';
import { isCapturableUrl } from '../../../src/popup/App';

// We test the pure logic function isCapturableUrl, TabList, and the App component.

vi.mock('../../../src/shared/messaging', () => ({
  sendMessage: vi.fn().mockResolvedValue({ status: 'ok' }),
}));

import { sendMessage } from '../../../src/shared/messaging';

describe('isCapturableUrl', () => {
  it('returns true for http URLs', () => {
    expect(isCapturableUrl('http://example.com')).toBe(true);
  });

  it('returns true for https URLs', () => {
    expect(isCapturableUrl('https://example.com/page')).toBe(true);
  });

  it('returns false for chrome:// URLs', () => {
    expect(isCapturableUrl('chrome://settings')).toBe(false);
  });

  it('returns false for chrome-extension:// URLs', () => {
    expect(isCapturableUrl('chrome-extension://abc/popup.html')).toBe(false);
  });

  it('returns false for about: URLs', () => {
    expect(isCapturableUrl('about:blank')).toBe(false);
  });

  it('returns false for edge:// URLs', () => {
    expect(isCapturableUrl('edge://settings')).toBe(false);
  });

  it('returns false for brave:// URLs', () => {
    expect(isCapturableUrl('brave://settings')).toBe(false);
  });

  it('returns false for moz-extension:// URLs', () => {
    expect(isCapturableUrl('moz-extension://abc/popup.html')).toBe(false);
  });

  it('returns false for Chrome Web Store', () => {
    expect(isCapturableUrl('https://chromewebstore.google.com/detail/some-ext')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isCapturableUrl(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isCapturableUrl('')).toBe(false);
  });
});

// Test TabList as a pure component
import { TabList } from '../../../src/popup/TabList';

describe('TabList', () => {
  it('renders tab titles', () => {
    const tabs = [
      { id: 1, title: 'Google', url: 'https://google.com', favIconUrl: 'https://google.com/favicon.ico' },
      { id: 2, title: 'GitHub', url: 'https://github.com' },
    ];
    const { getByText } = render(<TabList tabs={tabs} onSelect={() => {}} onScreenshot={() => {}} />);
    expect(getByText('Google')).toBeTruthy();
    expect(getByText('GitHub')).toBeTruthy();
  });

  it('displays host from URL', () => {
    const tabs = [{ id: 1, title: 'Test', url: 'https://example.com/page' }];
    const { getByText } = render(<TabList tabs={tabs} onSelect={() => {}} onScreenshot={() => {}} />);
    expect(getByText('example.com')).toBeTruthy();
  });

  it('calls onSelect when Capture button is clicked', () => {
    const onSelect = vi.fn();
    const tabs = [{ id: 42, title: 'My Tab', url: 'https://example.com' }];
    const { getByTestId } = render(<TabList tabs={tabs} onSelect={onSelect} onScreenshot={() => {}} />);

    fireEvent.click(getByTestId('capture-tab-42'));

    expect(onSelect).toHaveBeenCalledWith(42);
  });

  it('calls onScreenshot when screenshot button is clicked', () => {
    const onScreenshot = vi.fn();
    const tabs = [{ id: 42, title: 'My Tab', url: 'https://example.com' }];
    const { getByTestId } = render(<TabList tabs={tabs} onSelect={() => {}} onScreenshot={onScreenshot} />);

    fireEvent.click(getByTestId('screenshot-tab-42'));

    expect(onScreenshot).toHaveBeenCalledWith(42);
  });

  it('shows "Untitled" for tabs without title', () => {
    const tabs = [{ id: 1, title: '', url: 'https://example.com' }];
    const { getByText } = render(<TabList tabs={tabs} onSelect={() => {}} onScreenshot={() => {}} />);
    expect(getByText('Untitled')).toBeTruthy();
  });

  it('renders favicon when available', () => {
    const tabs = [
      { id: 1, title: 'Test', url: 'https://example.com', favIconUrl: 'https://example.com/icon.png' },
    ];
    const { container } = render(<TabList tabs={tabs} onSelect={() => {}} onScreenshot={() => {}} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.src).toBe('https://example.com/icon.png');
  });

  it('renders without favicon gracefully', () => {
    const tabs = [{ id: 1, title: 'No Icon', url: 'https://example.com' }];
    const { container } = render(<TabList tabs={tabs} onSelect={() => {}} onScreenshot={() => {}} />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders Capture and Screenshot buttons for each tab', () => {
    const tabs = [
      { id: 1, title: 'Tab A', url: 'https://a.com' },
      { id: 2, title: 'Tab B', url: 'https://b.com' },
    ];
    const { getByTestId } = render(<TabList tabs={tabs} onSelect={() => {}} onScreenshot={() => {}} />);
    expect(getByTestId('capture-tab-1')).toBeTruthy();
    expect(getByTestId('screenshot-tab-1')).toBeTruthy();
    expect(getByTestId('capture-tab-2')).toBeTruthy();
    expect(getByTestId('screenshot-tab-2')).toBeTruthy();
  });
});

// Test the full App component (screenshot via per-tab buttons)
import { App } from '../../../src/popup/App';

describe('App — per-tab screenshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendMessage).mockResolvedValue({ status: 'ok' });
    // Mock chrome.tabs.query to return capturable tabs
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, title: 'Test', url: 'https://example.com', active: true },
      { id: 2, title: 'Other', url: 'https://other.com' },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders per-tab screenshot buttons', async () => {
    const { findByTestId } = render(<App />);
    const btn = await findByTestId('screenshot-tab-1');
    expect(btn).toBeTruthy();
  });

  it('does not render a header-level screenshot button', async () => {
    const { findByTestId, queryByTestId } = render(<App />);
    // Wait for tabs to load
    await findByTestId('screenshot-tab-1');
    expect(queryByTestId('screenshot-button')).toBeNull();
  });

  it('sends TAKE_SCREENSHOT with correct tabId on screenshot button click', async () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    const { findByTestId } = render(<App />);
    const btn = await findByTestId('screenshot-tab-1');

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'TAKE_SCREENSHOT',
      payload: { tabId: 1 },
    });

    closeSpy.mockRestore();
  });

  it('sends TAKE_SCREENSHOT for non-active tab', async () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    const { findByTestId } = render(<App />);
    const btn = await findByTestId('screenshot-tab-2');

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'TAKE_SCREENSHOT',
      payload: { tabId: 2 },
    });

    closeSpy.mockRestore();
  });

  it('shows "Select a tab" helper text', async () => {
    const { findByText } = render(<App />);
    const text = await findByText('Select a tab');
    expect(text).toBeTruthy();
  });
});
