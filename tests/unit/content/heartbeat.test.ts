import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startHeartbeat } from '../../../src/content/heartbeat';
import { HEARTBEAT_INTERVAL } from '../../../src/shared/constants';

vi.mock('../../../src/shared/messaging', () => ({
  sendMessage: vi.fn().mockResolvedValue({ status: 'ok' }),
}));

import { sendMessage } from '../../../src/shared/messaging';

describe('startHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(sendMessage).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends HEARTBEAT at each interval', () => {
    const cleanup = startHeartbeat();

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HEARTBEAT' }),
    );

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
    expect(sendMessage).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it('does not send before interval elapses', () => {
    const cleanup = startHeartbeat();

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL - 1);
    expect(sendMessage).not.toHaveBeenCalled();

    cleanup();
  });

  it('stops sending after cleanup', () => {
    const cleanup = startHeartbeat();

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
    expect(sendMessage).toHaveBeenCalledTimes(1);

    cleanup();

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL * 3);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
