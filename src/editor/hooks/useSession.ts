import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { sendMessage } from '../../shared/messaging';
import { SCREENSHOT_LRU_SIZE } from '../../shared/constants';
import { LRUCache } from '../lib/lruCache';
import type { CaptureSession, CaptureStep } from '../../shared/types';

export interface UseSessionReturn {
  session: CaptureSession | null;
  loading: boolean;
  error: string | null;
  selectedStepId: string | null;
  screenshotDataUrl: string | null;
  screenshotLoading: boolean;
  dirtySteps: Set<string>;
  selectStep: (stepId: string) => void;
  updateDescription: (stepId: string, text: string) => void;
  updateAnnotations: (stepId: string, json: string) => void;
  updateScreenshot: (stepId: string, dataUrl: string) => void;
  deleteStep: (stepId: string) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
  getCachedScreenshot: (stepId: string) => string | null;
}

export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [dirtySteps] = useState(() => new Set<string>());

  const cacheRef = useRef(new LRUCache<string, string>(SCREENSHOT_LRU_SIZE));
  const latestRequestRef = useRef<string | null>(null);

  // Load session metadata on mount
  useEffect(() => {
    sendMessage({ type: 'GET_SESSION_DATA', payload: {} })
      .then((response: unknown) => {
        const res = response as { status: string; session: CaptureSession | null };
        if (res.status === 'ok' && res.session) {
          setSession(res.session);
          // Auto-select first step and pre-set screenshot loading to avoid
          // AnnotationCanvas mounting before screenshot data is available
          if (res.session.steps.length > 0) {
            setSelectedStepId(res.session.steps[0].id);
            setScreenshotLoading(true);
          }
        } else if (res.status === 'ok') {
          setSession(null);
        } else {
          setError('Failed to load session');
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  // Load screenshot when selected step changes
  useEffect(() => {
    if (!selectedStepId) {
      setScreenshotDataUrl(null);
      return;
    }

    // Check cache first
    const cached = cacheRef.current.get(selectedStepId);
    if (cached) {
      setScreenshotDataUrl(cached);
      return;
    }

    // Fetch from SW
    latestRequestRef.current = selectedStepId;
    setScreenshotLoading(true);

    sendMessage({ type: 'GET_STEP_SCREENSHOT', payload: { stepId: selectedStepId } })
      .then((response: unknown) => {
        const res = response as { status: string; screenshotDataUrl: string | null };
        // Guard against stale responses
        if (latestRequestRef.current !== selectedStepId) return;
        if (res.screenshotDataUrl) {
          cacheRef.current.set(selectedStepId, res.screenshotDataUrl);
          setScreenshotDataUrl(res.screenshotDataUrl);
        } else {
          setScreenshotDataUrl(null);
        }
        setScreenshotLoading(false);
      })
      .catch(() => {
        if (latestRequestRef.current === selectedStepId) {
          setScreenshotLoading(false);
        }
      });
  }, [selectedStepId]);

  const selectStep = useCallback((stepId: string) => {
    setSelectedStepId(stepId);
  }, []);

  const updateDescription = useCallback(
    (stepId: string, text: string) => {
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === stepId ? { ...s, description: text } : s,
          ),
        };
      });
      dirtySteps.add(stepId);
      sendMessage({
        type: 'UPDATE_STEP_DESCRIPTION',
        payload: { stepId, description: text },
      }).catch(() => {});
    },
    [dirtySteps],
  );

  const updateAnnotations = useCallback(
    (stepId: string, json: string) => {
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === stepId ? { ...s, annotations: json } : s,
          ),
        };
      });
      dirtySteps.add(stepId);
      sendMessage({
        type: 'UPDATE_STEP_ANNOTATIONS',
        payload: { stepId, annotations: json },
      }).catch(() => {});
    },
    [dirtySteps],
  );

  const updateScreenshot = useCallback(
    (stepId: string, dataUrl: string) => {
      cacheRef.current.set(stepId, dataUrl);
      if (selectedStepId === stepId) {
        setScreenshotDataUrl(dataUrl);
      }
      // Persist to service worker so export fetches the updated screenshot
      sendMessage({
        type: 'UPDATE_STEP_SCREENSHOT',
        payload: { stepId, screenshotDataUrl: dataUrl },
      }).catch(() => {});
    },
    [selectedStepId],
  );

  const deleteStep = useCallback(
    (stepId: string) => {
      setSession((prev) => {
        if (!prev) return prev;
        const idx = prev.steps.findIndex((s) => s.id === stepId);
        if (idx === -1) return prev;

        const newSteps = prev.steps.filter((s) => s.id !== stepId);

        // Migrate selection
        if (selectedStepId === stepId) {
          if (newSteps.length === 0) {
            setSelectedStepId(null);
          } else if (idx < newSteps.length) {
            setSelectedStepId(newSteps[idx].id);
          } else {
            setSelectedStepId(newSteps[newSteps.length - 1].id);
          }
        }

        // Evict from screenshot cache
        cacheRef.current.delete(stepId);

        return { ...prev, steps: newSteps };
      });

      sendMessage({
        type: 'DELETE_STEP',
        payload: { stepId },
      }).catch(() => {});
    },
    [selectedStepId],
  );

  const reorderSteps = useCallback(
    (fromIndex: number, toIndex: number) => {
      setSession((prev) => {
        if (!prev) return prev;
        const steps = [...prev.steps];
        const [moved] = steps.splice(fromIndex, 1);
        steps.splice(toIndex, 0, moved);
        steps.forEach((s, i) => { s.stepNumber = i + 1; });
        return { ...prev, steps };
      });
      // Read-only pass to get latest state for the persistence message
      setSession((prev) => {
        if (prev) {
          sendMessage({
            type: 'REORDER_STEPS',
            payload: { stepIds: prev.steps.map((s) => s.id) },
          }).catch(() => {});
        }
        return prev;
      });
    },
    [],
  );

  const getCachedScreenshot = useCallback(
    (stepId: string): string | null => {
      return cacheRef.current.get(stepId) ?? null;
    },
    [],
  );

  return {
    session,
    loading,
    error,
    selectedStepId,
    screenshotDataUrl,
    screenshotLoading,
    dirtySteps,
    selectStep,
    updateDescription,
    updateAnnotations,
    updateScreenshot,
    deleteStep,
    reorderSteps,
    getCachedScreenshot,
  };
}
