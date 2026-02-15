import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startPreClickBuffer } from '../../../src/content/preClickBuffer';

vi.mock('../../../src/shared/messaging', () => ({
  sendMessage: vi.fn().mockResolvedValue({ status: 'ok' }),
}));

vi.mock('../../../src/content/screenshotLock', () => ({
  lockForScreenshot: vi.fn(),
  unlockScreenshot: vi.fn(),
}));

import { sendMessage } from '../../../src/shared/messaging';
import { lockForScreenshot, unlockScreenshot } from '../../../src/content/screenshotLock';

function makeToolbar() {
  return {
    hideForScreenshot: vi.fn(),
  };
}

/** Flush double-rAF + setTimeout(0) used by waitForPaint(). */
async function flushPaint(): Promise<void> {
  // Trigger the first rAF callback
  await new Promise((r) => requestAnimationFrame(r));
  // Trigger the second rAF callback
  await new Promise((r) => requestAnimationFrame(r));
  // Trigger the setTimeout(0) inside the second rAF
  await new Promise((r) => setTimeout(r, 0));
}

describe('startPreClickBuffer', () => {
  let cleanup: () => void;
  let toolbar: ReturnType<typeof makeToolbar>;
  let toolbarHost: HTMLElement;

  beforeEach(() => {
    vi.mocked(sendMessage).mockClear();
    toolbar = makeToolbar();
    toolbarHost = document.createElement('div');
    toolbarHost.id = 'praxis-toolbar';
    document.body.appendChild(toolbarHost);
    cleanup = startPreClickBuffer(toolbar, toolbarHost);
  });

  afterEach(async () => {
    cleanup();
    toolbarHost.remove();
    // Flush any pending rAF/setTimeout from this test to prevent leaks
    await flushPaint();
  });

  it('hides toolbar synchronously on mousedown', () => {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(toolbar.hideForScreenshot).toHaveBeenCalled();
  });

  it('sends PRE_CLICK_BUFFER after repaint on mousedown', async () => {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    // Message is NOT sent synchronously — it waits for repaint
    expect(sendMessage).not.toHaveBeenCalled();

    await flushPaint();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PRE_CLICK_BUFFER',
        payload: expect.objectContaining({ timestamp: expect.any(Number) }),
      }),
    );
  });

  it('ignores mousedown on toolbar host', async () => {
    const child = document.createElement('button');
    toolbarHost.appendChild(child);

    // Dispatch mousedown directly on the child inside toolbarHost
    child.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));

    await flushPaint();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(toolbar.hideForScreenshot).not.toHaveBeenCalled();
  });

  it('sends on every mousedown (after paint)', async () => {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flushPaint();
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flushPaint();
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flushPaint();

    expect(sendMessage).toHaveBeenCalledTimes(3);
  });

  it('stops sending after cleanup', async () => {
    cleanup();
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flushPaint();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('acquires screenshot lock on mousedown', () => {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(lockForScreenshot).toHaveBeenCalled();
  });

  it('releases screenshot lock after PRE_CLICK_BUFFER response', async () => {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flushPaint();
    // Allow the sendMessage promise (.then) to resolve
    await new Promise((r) => setTimeout(r, 0));
    expect(unlockScreenshot).toHaveBeenCalled();
  });
});
