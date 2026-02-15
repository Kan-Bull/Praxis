import { useEffect } from 'preact/hooks';

/**
 * Registers a `beforeunload` listener when `isDirty` is true.
 * Triggers the browser's "unsaved changes" confirmation dialog.
 */
export function useUnsavedChanges(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers require returnValue
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [isDirty]);
}
