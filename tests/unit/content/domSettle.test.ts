import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitForDomSettle } from '../../../src/content/domSettle';
import { MUTATION_SETTLE_TIME, MUTATION_MAX_WAIT } from '../../../src/shared/constants';

vi.mock('../../../src/shared/messaging', () => ({
  sendMessage: vi.fn().mockResolvedValue({ status: 'ok' }),
}));

import { sendMessage } from '../../../src/shared/messaging';

describe('waitForDomSettle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(sendMessage).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after MUTATION_SETTLE_TIME of quiet', async () => {
    const promise = waitForDomSettle();

    vi.advanceTimersByTime(MUTATION_SETTLE_TIME);
    await promise;

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DOM_SETTLED',
        payload: expect.objectContaining({ url: expect.any(String) }),
      }),
    );
  });

  it('eventually resolves after mutations stop', async () => {
    const promise = waitForDomSettle();

    // Add a DOM mutation
    const div = document.createElement('div');
    document.body.appendChild(div);

    // Advance past the max settle time to guarantee resolution
    vi.advanceTimersByTime(MUTATION_MAX_WAIT);
    await promise;

    expect(sendMessage).toHaveBeenCalledTimes(1);
    div.remove();
  });

  it('resolves at MUTATION_MAX_WAIT even with continuous mutations', async () => {
    const promise = waitForDomSettle();

    // Add mutations every 100ms — never lets settle timer fire
    const interval = setInterval(() => {
      const el = document.createElement('span');
      document.body.appendChild(el);
    }, 100);

    vi.advanceTimersByTime(MUTATION_MAX_WAIT);

    clearInterval(interval);
    await promise;

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('sends DOM_SETTLED with current URL', async () => {
    const promise = waitForDomSettle();
    vi.advanceTimersByTime(MUTATION_SETTLE_TIME);
    await promise;

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'DOM_SETTLED',
      payload: { url: location.href },
    });
  });

  it('resolves immediately when no mutations after settle time', async () => {
    let resolved = false;
    const promise = waitForDomSettle().then(() => { resolved = true; });

    expect(resolved).toBe(false);
    vi.advanceTimersByTime(MUTATION_SETTLE_TIME);
    await promise;
    expect(resolved).toBe(true);
  });
});
