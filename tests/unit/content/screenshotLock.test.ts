import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  lockForScreenshot,
  unlockScreenshot,
  isScreenshotLocked,
  deferShowToolbar,
} from '../../../src/content/screenshotLock';

describe('screenshotLock', () => {
  afterEach(() => {
    // Ensure clean state between tests
    if (isScreenshotLocked()) {
      unlockScreenshot();
    }
  });

  it('starts unlocked', () => {
    expect(isScreenshotLocked()).toBe(false);
  });

  it('lockForScreenshot sets the lock', () => {
    lockForScreenshot();
    expect(isScreenshotLocked()).toBe(true);
  });

  it('unlockScreenshot clears the lock', () => {
    lockForScreenshot();
    unlockScreenshot();
    expect(isScreenshotLocked()).toBe(false);
  });

  it('unlockScreenshot invokes deferred show callback', () => {
    const callback = vi.fn();
    lockForScreenshot();
    deferShowToolbar(callback);
    expect(callback).not.toHaveBeenCalled();

    unlockScreenshot();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('deferShowToolbar replaces previous deferred callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    lockForScreenshot();
    deferShowToolbar(first);
    deferShowToolbar(second);

    unlockScreenshot();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('unlockScreenshot without deferred callback is safe', () => {
    lockForScreenshot();
    expect(() => unlockScreenshot()).not.toThrow();
  });

  it('lockForScreenshot clears any pending deferred callback', () => {
    const callback = vi.fn();
    lockForScreenshot();
    deferShowToolbar(callback);

    // Re-lock (new mousedown) clears the old deferred
    lockForScreenshot();
    unlockScreenshot();
    expect(callback).not.toHaveBeenCalled();
  });
});
