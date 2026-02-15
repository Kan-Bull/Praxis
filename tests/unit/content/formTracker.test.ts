import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startFormTracker } from '../../../src/content/formTracker';
import { INPUT_DEBOUNCE } from '../../../src/shared/constants';

vi.mock('../../../src/shared/messaging', () => ({
  sendMessage: vi.fn().mockResolvedValue({ status: 'ok' }),
}));

import { sendMessage } from '../../../src/shared/messaging';

describe('formTracker', () => {
  let toolbarHost: HTMLDivElement;
  let cleanup: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    toolbarHost = document.createElement('div');
    document.body.appendChild(toolbarHost);
    cleanup = startFormTracker(toolbarHost);
    vi.mocked(sendMessage).mockClear();
  });

  afterEach(() => {
    cleanup();
    toolbarHost.remove();
    vi.useRealTimers();
  });

  it('sends debounced input event after INPUT_DEBOUNCE', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'search';
    document.body.appendChild(input);

    input.value = 'hello';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Not sent yet
    expect(sendMessage).not.toHaveBeenCalled();

    vi.advanceTimersByTime(INPUT_DEBOUNCE);

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INTERACTION_EVENT',
        payload: expect.objectContaining({
          event: expect.objectContaining({ type: 'input' }),
        }),
      }),
    );
    input.remove();
  });

  it('debounces multiple rapid input events per element', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'query';
    document.body.appendChild(input);

    input.value = 'h';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(100);

    input.value = 'he';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(100);

    input.value = 'hel';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(INPUT_DEBOUNCE);

    // Only one message sent (the last debounced one)
    expect(sendMessage).toHaveBeenCalledTimes(1);
    input.remove();
  });

  it('sends immediate change event for select', () => {
    const select = document.createElement('select');
    const opt = document.createElement('option');
    opt.value = 'choice1';
    select.appendChild(opt);
    document.body.appendChild(select);

    select.value = 'choice1';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    // No debounce — immediate
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INTERACTION_EVENT',
        payload: expect.objectContaining({
          event: expect.objectContaining({ type: 'change' }),
        }),
      }),
    );
    select.remove();
  });

  it('sends immediate change event for checkbox', () => {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    document.body.appendChild(cb);

    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    cb.remove();
  });

  it('redacts value for sensitive fields', () => {
    const input = document.createElement('input');
    input.type = 'password';
    input.name = 'password';
    document.body.appendChild(input);

    input.value = 'secret123';
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          event: expect.objectContaining({
            value: '[REDACTED]',
          }),
        }),
      }),
    );
    input.remove();
  });

  it('ignores events inside toolbar host', () => {
    const input = document.createElement('input');
    toolbarHost.appendChild(input);

    input.value = 'test';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(INPUT_DEBOUNCE);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('removes listeners on cleanup', () => {
    cleanup();

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.value = 'test';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(INPUT_DEBOUNCE);

    expect(sendMessage).not.toHaveBeenCalled();
    input.remove();
  });

  it('debounces independently per element', () => {
    const input1 = document.createElement('input');
    input1.name = 'field1';
    const input2 = document.createElement('input');
    input2.name = 'field2';
    document.body.appendChild(input1);
    document.body.appendChild(input2);

    input1.value = 'a';
    input1.dispatchEvent(new Event('input', { bubbles: true }));
    input2.value = 'b';
    input2.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(INPUT_DEBOUNCE);

    // Both should fire
    expect(sendMessage).toHaveBeenCalledTimes(2);
    input1.remove();
    input2.remove();
  });

  it('uses event-time timestamp for debounced input, not debounce-fire time', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'search';
    document.body.appendChild(input);

    // Capture time when event fires
    const eventFireTime = Date.now();

    input.value = 'hello';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Advance past debounce — Date.now() will be eventFireTime + INPUT_DEBOUNCE
    vi.advanceTimersByTime(INPUT_DEBOUNCE);

    const call = vi.mocked(sendMessage).mock.calls[0][0] as {
      payload: { event: { timestamp: number } };
    };
    const sentTimestamp = call.payload.event.timestamp;

    // The timestamp should be close to eventFireTime, NOT eventFireTime + INPUT_DEBOUNCE
    // Allow 50ms tolerance for test execution
    expect(sentTimestamp - eventFireTime).toBeLessThan(50);
    input.remove();
  });

  it('includes current URL in events', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    input.value = 'test';
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          event: expect.objectContaining({
            url: expect.any(String),
          }),
        }),
      }),
    );
    input.remove();
  });
});
