import { describe, it, expect, afterEach } from 'vitest';
import { hideScrollbars, showScrollbars } from '../../../src/content/scrollbarHide';

describe('scrollbarHide', () => {
  afterEach(() => {
    showScrollbars(); // cleanup
  });

  it('injects a style element that hides scrollbars', () => {
    hideScrollbars();
    const style = document.getElementById('__praxis-scrollbar-hide');
    expect(style).not.toBeNull();
    expect(style?.tagName).toBe('STYLE');
    expect(style?.textContent).toContain('::-webkit-scrollbar');
    expect(style?.textContent).toContain('scrollbar-width:none');
  });

  it('is idempotent — calling twice does not duplicate the style', () => {
    hideScrollbars();
    hideScrollbars();
    const styles = document.querySelectorAll('#__praxis-scrollbar-hide');
    expect(styles.length).toBe(1);
  });

  it('removes the style element on showScrollbars', () => {
    hideScrollbars();
    expect(document.getElementById('__praxis-scrollbar-hide')).not.toBeNull();
    showScrollbars();
    expect(document.getElementById('__praxis-scrollbar-hide')).toBeNull();
  });

  it('showScrollbars is safe to call when nothing is hidden', () => {
    expect(() => showScrollbars()).not.toThrow();
  });
});
