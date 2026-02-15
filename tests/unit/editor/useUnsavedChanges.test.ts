import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/preact';
import { useUnsavedChanges } from '../../../src/editor/hooks/useUnsavedChanges';

describe('useUnsavedChanges', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(window, 'addEventListener');
    removeSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('adds beforeunload listener when dirty', () => {
    renderHook(() => useUnsavedChanges(true));
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('does not add listener when not dirty', () => {
    renderHook(() => useUnsavedChanges(false));
    const beforeUnloadCalls = addSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === 'beforeunload',
    );
    expect(beforeUnloadCalls).toHaveLength(0);
  });

  it('removes listener on unmount', () => {
    const { unmount } = renderHook(() => useUnsavedChanges(true));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });
});
