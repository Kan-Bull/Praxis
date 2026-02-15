import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@shared/logger';

describe('logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should prefix log messages with [Praxis]', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.log('hello');
    expect(spy).toHaveBeenCalledWith('[Praxis]', 'hello');
  });

  it('should prefix warn messages with [Praxis]', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('caution');
    expect(spy).toHaveBeenCalledWith('[Praxis]', 'caution');
  });

  it('should prefix error messages with [Praxis]', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('bad');
    expect(spy).toHaveBeenCalledWith('[Praxis]', 'bad');
  });

  it('should support multiple arguments', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.log('a', 'b', 3);
    expect(spy).toHaveBeenCalledWith('[Praxis]', 'a', 'b', 3);
  });

  it('should prefix group labels with [Praxis]', () => {
    const spy = vi.spyOn(console, 'group').mockImplementation(() => {});
    logger.group('test group');
    expect(spy).toHaveBeenCalledWith('[Praxis] test group');
  });

  it('should call console.groupEnd', () => {
    const spy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    logger.groupEnd();
    expect(spy).toHaveBeenCalled();
  });
});
