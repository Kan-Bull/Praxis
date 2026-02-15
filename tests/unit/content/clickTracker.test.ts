import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startClickTracker } from '../../../src/content/clickTracker';
import { mockBoundingRect } from '../../setup';

// Mock sendMessage
vi.mock('../../../src/shared/messaging', () => ({
  sendMessage: vi.fn().mockResolvedValue({ status: 'ok' }),
}));

// Mock highlighter
vi.mock('../../../src/content/highlighter', () => ({
  flashHighlight: vi.fn(),
}));

import { sendMessage } from '../../../src/shared/messaging';
import { flashHighlight } from '../../../src/content/highlighter';

describe('clickTracker', () => {
  let toolbarHost: HTMLDivElement;
  let cleanup: () => void;

  beforeEach(() => {
    toolbarHost = document.createElement('div');
    document.body.appendChild(toolbarHost);
    cleanup = startClickTracker(toolbarHost);
    vi.mocked(sendMessage).mockClear();
    vi.mocked(flashHighlight).mockClear();
  });

  afterEach(() => {
    cleanup();
    toolbarHost.remove();
  });

  it('sends INTERACTION_EVENT on click with element info', () => {
    const btn = document.createElement('button');
    btn.textContent = 'Submit';
    document.body.appendChild(btn);
    mockBoundingRect(btn, { width: 80, height: 30, left: 10, top: 20, right: 90, bottom: 50 });

    btn.click();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INTERACTION_EVENT',
        payload: expect.objectContaining({
          event: expect.objectContaining({
            type: 'click',
            element: expect.objectContaining({ tagName: 'button' }),
          }),
        }),
      }),
    );
    btn.remove();
  });

  it('calls flashHighlight on click', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    mockBoundingRect(btn, { width: 80, height: 30 });

    btn.click();

    expect(flashHighlight).toHaveBeenCalledWith(
      expect.objectContaining({ width: 80, height: 30 }),
    );
    btn.remove();
  });

  it('ignores clicks inside toolbar host', () => {
    const innerBtn = document.createElement('button');
    toolbarHost.appendChild(innerBtn);
    mockBoundingRect(innerBtn, { width: 50, height: 20 });

    innerBtn.click();

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('ignores clicks on <html> and <body>', () => {
    document.body.click();
    expect(sendMessage).not.toHaveBeenCalled();

    document.documentElement.click();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('ignores zero-size elements', () => {
    const span = document.createElement('span');
    document.body.appendChild(span);
    // jsdom default: 0x0 — no mock needed
    span.click();
    expect(sendMessage).not.toHaveBeenCalled();
    span.remove();
  });

  it('removes listener on cleanup', () => {
    cleanup();

    const btn = document.createElement('button');
    document.body.appendChild(btn);
    mockBoundingRect(btn, { width: 80, height: 30 });
    btn.click();

    expect(sendMessage).not.toHaveBeenCalled();
    btn.remove();
  });

  it('includes current URL in the event', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    mockBoundingRect(btn, { width: 80, height: 30 });

    btn.click();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          event: expect.objectContaining({
            url: expect.any(String),
          }),
        }),
      }),
    );
    btn.remove();
  });

  it('includes clickX and clickY from MouseEvent coordinates', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    mockBoundingRect(btn, { width: 80, height: 30, left: 10, top: 20, right: 90, bottom: 50 });

    btn.dispatchEvent(new MouseEvent('click', { clientX: 150, clientY: 200, bubbles: true }));

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          event: expect.objectContaining({
            clickX: 150,
            clickY: 200,
          }),
        }),
      }),
    );
    btn.remove();
  });

  it('includes viewportWidth and viewportHeight', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    mockBoundingRect(btn, { width: 80, height: 30 });

    btn.dispatchEvent(new MouseEvent('click', { clientX: 50, clientY: 60, bubbles: true }));

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          event: expect.objectContaining({
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
          }),
        }),
      }),
    );
    btn.remove();
  });

  it('click coordinates match the dispatched MouseEvent values', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    mockBoundingRect(btn, { width: 100, height: 40, left: 50, top: 100, right: 150, bottom: 140 });

    btn.dispatchEvent(new MouseEvent('click', { clientX: 375, clientY: 812, bubbles: true }));

    const call = vi.mocked(sendMessage).mock.calls[0][0] as {
      payload: { event: { clickX: number; clickY: number; viewportWidth: number; viewportHeight: number } };
    };
    expect(call.payload.event.clickX).toBe(375);
    expect(call.payload.event.clickY).toBe(812);
    expect(call.payload.event.viewportWidth).toBe(window.innerWidth);
    expect(call.payload.event.viewportHeight).toBe(window.innerHeight);
    btn.remove();
  });

  it('ignores clicks on non-interactive elements (plain divs)', () => {
    const div = document.createElement('div');
    div.textContent = 'Just a layout container';
    document.body.appendChild(div);
    mockBoundingRect(div, { width: 500, height: 300 });

    div.click();

    expect(sendMessage).not.toHaveBeenCalled();
    div.remove();
  });

  it('ignores clicks on non-interactive section/nav/main elements', () => {
    const nav = document.createElement('nav');
    nav.textContent = 'Home About Contact';
    document.body.appendChild(nav);
    mockBoundingRect(nav, { width: 800, height: 50 });

    nav.click();

    expect(sendMessage).not.toHaveBeenCalled();
    nav.remove();
  });

  it('captures clicks on span inside a button (walks up to interactive ancestor)', () => {
    const btn = document.createElement('button');
    const span = document.createElement('span');
    span.textContent = 'Click me';
    btn.appendChild(span);
    document.body.appendChild(btn);
    mockBoundingRect(btn, { width: 100, height: 40 });
    mockBoundingRect(span, { width: 60, height: 20 });

    span.click();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INTERACTION_EVENT',
        payload: expect.objectContaining({
          event: expect.objectContaining({
            element: expect.objectContaining({ tagName: 'button' }),
          }),
        }),
      }),
    );
    btn.remove();
  });

  it('captures clicks on elements with role="button"', () => {
    const div = document.createElement('div');
    div.setAttribute('role', 'button');
    div.textContent = 'Custom button';
    document.body.appendChild(div);
    mockBoundingRect(div, { width: 100, height: 40 });

    div.click();

    expect(sendMessage).toHaveBeenCalled();
    div.remove();
  });

  it('captures clicks on elements with tabindex', () => {
    const div = document.createElement('div');
    div.setAttribute('tabindex', '0');
    div.textContent = 'Focusable element';
    document.body.appendChild(div);
    mockBoundingRect(div, { width: 100, height: 40 });

    div.click();

    expect(sendMessage).toHaveBeenCalled();
    div.remove();
  });

  it('finds interactive ancestor through nested non-interactive elements', () => {
    const anchor = document.createElement('a');
    anchor.href = 'https://example.com';
    const wrapper = document.createElement('div');
    const icon = document.createElement('span');
    icon.textContent = 'icon';
    wrapper.appendChild(icon);
    anchor.appendChild(wrapper);
    document.body.appendChild(anchor);
    mockBoundingRect(anchor, { width: 120, height: 30 });
    mockBoundingRect(icon, { width: 16, height: 16 });

    icon.click();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          event: expect.objectContaining({
            element: expect.objectContaining({ tagName: 'a' }),
          }),
        }),
      }),
    );
    anchor.remove();
  });
});
