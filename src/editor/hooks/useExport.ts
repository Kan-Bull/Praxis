import { useState, useCallback } from 'preact/hooks';
import { sendMessage } from '../../shared/messaging';
import { EXPORT_FILENAME_PREFIX } from '../../shared/constants';
import { scanStepsForSensitiveData, type SensitiveMatch } from '../lib/sensitiveTextScanner';
import { compositeScreenshotWithOverlay, renderAnnotationsToDataUrl } from '../lib/canvasFlattener';
import { generateExportPdf } from '../lib/pdfExporter';
import type { CaptureSession, CaptureStep } from '../../shared/types';
import type { ExportSettings } from '../components/ExportReviewDialog';

export interface UseExportReturn {
  showReview: boolean;
  exporting: boolean;
  sensitiveMatches: SensitiveMatch[];
  exportError: string | null;
  logoDataUrl: string | null;
  setLogoDataUrl: (url: string | null) => void;
  startExport: () => void;
  confirmExport: (settings: ExportSettings, logoDataUrl?: string | null) => Promise<void>;
  cancelExport: () => void;
  exportPng: (step: CaptureStep) => Promise<void>;
  copyToClipboard: (step: CaptureStep) => Promise<boolean>;
}

export function useExport(
  session: CaptureSession | null,
  getCachedScreenshot?: (stepId: string) => string | null,
): UseExportReturn {
  const [showReview, setShowReview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sensitiveMatches, setSensitiveMatches] = useState<SensitiveMatch[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const startExport = useCallback(() => {
    if (!session || session.steps.length === 0) return;
    const matches = scanStepsForSensitiveData(session.steps);
    setSensitiveMatches(matches);
    setExportError(null);
    setShowReview(true);
  }, [session]);

  const cancelExport = useCallback(() => {
    setShowReview(false);
    setSensitiveMatches([]);
    setExportError(null);
  }, []);

  const confirmExport = useCallback(async (settings: ExportSettings, logoOverride?: string | null) => {
    if (!session) return;
    setExporting(true);
    setShowReview(false);
    setExportError(null);

    try {
      // Fetch screenshots and composite with annotations
      const exportSteps = await Promise.all(
        session.steps.map(async (step) => {
          // Use locally-cached screenshot first (survives SW termination),
          // fall back to fetching from SW if not in cache
          let screenshotDataUrl = getCachedScreenshot?.(step.id) ?? '';
          if (!screenshotDataUrl) {
            const res = (await sendMessage({
              type: 'GET_STEP_SCREENSHOT',
              payload: { stepId: step.id },
            })) as { screenshotDataUrl: string | null };
            screenshotDataUrl = res.screenshotDataUrl ?? '';
          }

          // Load screenshot dimensions (needed for annotations + cropping)
          let imgDims = { width: 0, height: 0 };
          if (screenshotDataUrl) {
            imgDims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve({ width: img.width, height: img.height });
              img.onerror = () => reject(new Error('Failed to load screenshot for dimensions'));
              img.src = screenshotDataUrl;
            });
          }

          // Composite with per-step annotation overlay if available
          let finalScreenshot = screenshotDataUrl;
          if (screenshotDataUrl && step.annotations && imgDims.width > 0) {
            const overlay = await renderAnnotationsToDataUrl(
              step.annotations,
              imgDims.width,
              imgDims.height,
            );
            if (overlay) {
              finalScreenshot = await compositeScreenshotWithOverlay(screenshotDataUrl, overlay);
            }
          }

          return {
            stepNumber: step.stepNumber,
            description: step.description,
            screenshotDataUrl: finalScreenshot,
            url: step.url,
          };
        }),
      );

      // Generate PDF
      const effectiveLogo = logoOverride !== undefined ? logoOverride : logoDataUrl;
      const blob = await generateExportPdf({
        title: settings.title,
        steps: exportSteps,
        author: settings.author,
        date: settings.date,
        pageSize: settings.pageSize,
        includeUrls: settings.includeUrls,
        ...(effectiveLogo ? { logoDataUrl: effectiveLogo } : {}),
      });

      // Trigger download — use guide title as filename
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = settings.title
        .replace(/[^a-zA-Z0-9 _-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 100) || EXPORT_FILENAME_PREFIX;
      a.download = `${safeName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      // Signal export complete to clear session data
      await sendMessage({
        type: 'EXPORT_COMPLETE',
        payload: {},
      });
    } catch (err) {
      setExportError(String(err));
    } finally {
      setExporting(false);
    }
  }, [session, getCachedScreenshot, logoDataUrl]);

  /** Composite a step's screenshot with its annotations, returning a PNG data URL. */
  const compositeStep = useCallback(async (step: CaptureStep): Promise<string> => {
    let screenshotDataUrl = getCachedScreenshot?.(step.id) ?? '';
    if (!screenshotDataUrl) {
      const res = (await sendMessage({
        type: 'GET_STEP_SCREENSHOT',
        payload: { stepId: step.id },
      })) as { screenshotDataUrl: string | null };
      screenshotDataUrl = res.screenshotDataUrl ?? '';
    }
    if (!screenshotDataUrl) throw new Error('Screenshot not available');

    const imgDims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error('Failed to load screenshot'));
      img.src = screenshotDataUrl;
    });

    if (step.annotations && imgDims.width > 0) {
      const overlay = await renderAnnotationsToDataUrl(
        step.annotations,
        imgDims.width,
        imgDims.height,
      );
      if (overlay) {
        return compositeScreenshotWithOverlay(screenshotDataUrl, overlay);
      }
    }
    return screenshotDataUrl;
  }, [getCachedScreenshot]);

  const exportPng = useCallback(async (step: CaptureStep) => {
    setExporting(true);
    setExportError(null);
    try {
      const dataUrl = await compositeStep(step);
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const rawName = step.description || session?.title || 'screenshot';
      const safeName = rawName
        .replace(/[^a-zA-Z0-9 _-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 100) || 'screenshot';
      const suffix = (session?.steps.length ?? 0) > 1 ? `-step-${step.stepNumber}` : '';
      a.download = `${safeName}${suffix}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(String(err));
    } finally {
      setExporting(false);
    }
  }, [session, compositeStep]);

  const copyToClipboard = useCallback(async (step: CaptureStep): Promise<boolean> => {
    setExporting(true);
    setExportError(null);
    try {
      const dataUrl = await compositeStep(step);
      const blob = await fetch(dataUrl).then((r) => r.blob());
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      return true;
    } catch (err) {
      setExportError(String(err));
      return false;
    } finally {
      setExporting(false);
    }
  }, [compositeStep]);

  return {
    showReview,
    exporting,
    sensitiveMatches,
    exportError,
    logoDataUrl,
    setLogoDataUrl,
    startExport,
    confirmExport,
    cancelExport,
    exportPng,
    copyToClipboard,
  };
}
