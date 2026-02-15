import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flashHighlight } from '../../../src/content/highlighter';
import { HIGHLIGHT_DURATION } from '../../../src/shared/constants';

const SELECTOR = '[data-praxis-highlight]';

describe('flashHighlight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll(SELECTOR).forEach((el) => el.remove());
  });

  it('creates an overlay div at the specified rect', () => {
    flashHighlight({ x: 10, y: 20, width: 100, height: 50, top: 20, right: 110, bottom: 70, left: 10 });
    const overlays = document.querySelectorAll(SELECTOR);
    expect(overlays.length).toBe(1);
  });

  it('overlay has pointer-events none and position fixed', () => {
    flashHighlight({ x: 0, y: 0, width: 50, height: 30, top: 0, right: 50, bottom: 30, left: 0 });
    const overlay = document.querySelector(SELECTOR) as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.style.pointerEvents).toBe('none');
    expect(overlay.style.position).toBe('fixed');
  });

  it('positions overlay using rect coordinates', () => {
    flashHighlight({ x: 10, y: 20, width: 100, height: 50, top: 20, right: 110, bottom: 70, left: 10 });
    const overlay = document.querySelector(SELECTOR) as HTMLElement;
    expect(overlay.style.left).toBe('10px');
    expect(overlay.style.top).toBe('20px');
    expect(overlay.style.width).toBe('100px');
    expect(overlay.style.height).toBe('50px');
  });

  it('removes overlay after HIGHLIGHT_DURATION', () => {
    flashHighlight({ x: 0, y: 0, width: 50, height: 30, top: 0, right: 50, bottom: 30, left: 0 });

    // First setTimeout (0ms) sets opacity to 0
    vi.advanceTimersByTime(0);
    // Second setTimeout removes after HIGHLIGHT_DURATION
    vi.advanceTimersByTime(HIGHLIGHT_DURATION);

    expect(document.querySelectorAll(SELECTOR).length).toBe(0);
  });
});
