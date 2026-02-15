import { h } from 'preact';
import { useState, useCallback, useEffect } from 'preact/hooks';
import { useSession } from './hooks/useSession';
import { useUnsavedChanges } from './hooks/useUnsavedChanges';
import { useExport } from './hooks/useExport';
import { ANNOTATION_COLORS, BLUR_MIN_BLOCK_SIZE } from '../shared/constants';
import { applyPixelBlur } from './lib/blurTool';
import { cropScreenshot } from '../shared/imageProcessor';
import { adjustClickForCrop } from './lib/coordinateScaler';
import { TipsBanner } from './components/TipsBanner';
import { Timeline } from './components/Timeline';
import { DescriptionEditor } from './components/DescriptionEditor';
import { AnnotationCanvas } from './components/AnnotationCanvas';
import { ToolPalette, type ToolType } from './components/ToolPalette';
import { ExportReviewDialog } from './components/ExportReviewDialog';
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog';
import { DescriptionModal } from './components/DescriptionModal';

export function App() {
  const {
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
  } = useSession();

  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [activeColor, setActiveColor] = useState<string>(ANNOTATION_COLORS[0]);
  const [pendingDeleteStepId, setPendingDeleteStepId] = useState<string | null>(null);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [imageSpaceClick, setImageSpaceClick] = useState<{ x: number; y: number } | null>(null);

  const {
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
  } = useExport(session, getCachedScreenshot);

  const [clipboardFeedback, setClipboardFeedback] = useState(false);
  const [showScreenshotMenu, setShowScreenshotMenu] = useState(false);

  // Reset tool to Select when switching steps — avoids stale tool state on the
  // new canvas (blur/rect handlers reference the previous screenshot's data).
  useEffect(() => {
    setActiveTool('select');
    setImageSpaceClick(null);
  }, [selectedStepId]);

  // Close screenshot dropdown on click-outside or Escape
  useEffect(() => {
    if (!showScreenshotMenu) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-testid="screenshot-export-button"]') && !target.closest('[data-testid="screenshot-export-menu"]')) {
        setShowScreenshotMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowScreenshotMenu(false);
    };
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showScreenshotMenu]);

  useUnsavedChanges(dirtySteps.size > 0);

  const selectedStepIndex = session?.steps.findIndex((s) => s.id === selectedStepId) ?? -1;
  const selectedStep = selectedStepIndex >= 0 ? session!.steps[selectedStepIndex] : null;

  // After crop, use adjusted image-space click coords so the indicator
  // appears at the correct position in the cropped image.
  const effectiveClickX = imageSpaceClick ? imageSpaceClick.x : selectedStep?.interaction?.clickX;
  const effectiveClickY = imageSpaceClick ? imageSpaceClick.y : selectedStep?.interaction?.clickY;
  const effectiveVpW = imageSpaceClick ? undefined : selectedStep?.interaction?.viewportWidth;
  const effectiveVpH = imageSpaceClick ? undefined : selectedStep?.interaction?.viewportHeight;

  const handleDescriptionChange = useCallback(
    (text: string) => {
      if (selectedStepId) {
        updateDescription(selectedStepId, text);
      }
    },
    [selectedStepId, updateDescription],
  );

  const handleAnnotationsChange = useCallback(
    (json: string) => {
      if (selectedStepId) {
        updateAnnotations(selectedStepId, json);
      }
    },
    [selectedStepId, updateAnnotations],
  );

  const handleBlurConfirm = useCallback(
    (region: { x: number; y: number; width: number; height: number }) => {
      if (!screenshotDataUrl || !selectedStepId) return;

      // Create a temporary canvas to apply the blur
      const img = new Image();
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);

        const blurred = applyPixelBlur(
          imageData.data,
          img.width,
          img.height,
          region,
          BLUR_MIN_BLOCK_SIZE,
        );

        const clamped = new Uint8ClampedArray(blurred.length);
        clamped.set(blurred);
        const newImageData = new ImageData(clamped, img.width, img.height);
        ctx.putImageData(newImageData, 0, 0);

        const newDataUrl = tempCanvas.toDataURL('image/png');
        updateScreenshot(selectedStepId, newDataUrl);
      };
      img.src = screenshotDataUrl;
    },
    [screenshotDataUrl, selectedStepId, updateScreenshot],
  );

  const handleCropConfirm = useCallback(
    async (region: { x: number; y: number; width: number; height: number; imageWidth: number; imageHeight: number }) => {
      if (!screenshotDataUrl || !selectedStepId) return;

      // Compute adjusted click position for the cropped image
      let adjustedClick: { x: number; y: number } | null = null;
      if (imageSpaceClick) {
        // Chained crop: imageSpaceClick is already in current image-space
        adjustedClick = adjustClickForCrop(imageSpaceClick.x, imageSpaceClick.y, region);
      } else {
        // First crop: convert viewport → image space, then adjust
        const origClickX = selectedStep?.interaction?.clickX;
        const origClickY = selectedStep?.interaction?.clickY;
        const origVpW = selectedStep?.interaction?.viewportWidth;
        const origVpH = selectedStep?.interaction?.viewportHeight;

        if (origClickX != null && origClickY != null && origVpW && origVpH) {
          const imgClickX = origClickX * (region.imageWidth / origVpW);
          const imgClickY = origClickY * (region.imageHeight / origVpH);
          adjustedClick = adjustClickForCrop(imgClickX, imgClickY, region);
        }
      }

      const croppedDataUrl = await cropScreenshot(screenshotDataUrl, region);
      updateScreenshot(selectedStepId, croppedDataUrl);

      if (adjustedClick) {
        setImageSpaceClick(adjustedClick);
        updateAnnotations(selectedStepId, ''); // Allow auto-placement with adjusted coords
      } else {
        setImageSpaceClick(null);
        updateAnnotations(selectedStepId, '{"objects":[]}'); // Suppress indicator
      }

      setActiveTool('select');
    },
    [screenshotDataUrl, selectedStepId, selectedStep, imageSpaceClick, updateScreenshot, updateAnnotations],
  );

  const handleDeleteStepRequest = useCallback((stepId: string) => {
    setPendingDeleteStepId(stepId);
  }, []);

  const confirmDeleteStep = useCallback(() => {
    if (pendingDeleteStepId) {
      deleteStep(pendingDeleteStepId);
      setPendingDeleteStepId(null);
    }
  }, [pendingDeleteStepId, deleteStep]);

  const cancelDeleteStep = useCallback(() => {
    setPendingDeleteStepId(null);
  }, []);

  const handleDelete = useCallback(() => {
    // Triggers delete via the hidden delete-trigger in AnnotationCanvas
    const trigger = document.querySelector<HTMLButtonElement>('[data-testid="delete-trigger"]');
    trigger?.click();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div key="loading" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }} data-testid="loading">
        Loading session...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div key="error" style={{ padding: '32px', textAlign: 'center', color: '#f87171' }} data-testid="error">
        Error: {error}
      </div>
    );
  }

  // Empty state
  if (!session || session.steps.length === 0) {
    return (
      <div key="empty" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }} data-testid="empty">
        No capture session found
      </div>
    );
  }

  return (
    <div
      key="editor"
      style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
      data-testid="editor-layout"
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: '1px solid #1e293b',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          boxShadow: 'none',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 800,
              color: '#ffffff',
              flexShrink: 0,
            }}
          >
            P
          </div>
          <h1 style={{ fontSize: '16px', margin: 0, fontWeight: 600, color: '#f8fafc' }}>
            {session?.mode === 'screenshot' ? 'Screenshot Editor' : 'Praxis Editor'}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Export Screenshot dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              disabled={exporting || !selectedStep}
              data-testid="screenshot-export-button"
              onClick={() => setShowScreenshotMenu((v) => !v)}
              style={{
                padding: '7px 18px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: exporting || !selectedStep ? '#93c5fd' : '#3b82f6',
                color: '#ffffff',
                cursor: exporting || !selectedStep ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'inherit',
                boxShadow: '0 1px 2px rgba(59,130,246,0.25)',
                opacity: !selectedStep ? 0.4 : 1,
              }}
            >
              Export Screenshot
            </button>
            {showScreenshotMenu && (
              <div
                data-testid="screenshot-export-menu"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  zIndex: 100,
                  minWidth: '170px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                <button
                  type="button"
                  data-testid="screenshot-download-png"
                  onClick={() => {
                    if (selectedStep) exportPng(selectedStep);
                    setShowScreenshotMenu(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 16px',
                    border: 'none',
                    background: 'transparent',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.12)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  Download PNG
                </button>
                <button
                  type="button"
                  data-testid="screenshot-copy-clipboard"
                  onClick={async () => {
                    if (!selectedStep) return;
                    const ok = await copyToClipboard(selectedStep);
                    if (ok) {
                      setClipboardFeedback(true);
                      setTimeout(() => setClipboardFeedback(false), 1500);
                    }
                    setShowScreenshotMenu(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 16px',
                    border: 'none',
                    background: 'transparent',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.12)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  Copy to Clipboard
                </button>
              </div>
            )}
            {clipboardFeedback && (
              <div
                data-testid="clipboard-toast"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  padding: '6px 14px',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid #22c55e',
                  borderRadius: '4px',
                  color: '#86efac',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  zIndex: 100,
                }}
              >
                Copied to clipboard
              </div>
            )}
          </div>

          {/* Export PDF — hidden in screenshot mode */}
          {session?.mode !== 'screenshot' && (
            <button
              type="button"
              disabled={exporting}
              data-testid="export-button"
              onClick={startExport}
              style={{
                padding: '7px 18px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: exporting ? '#93c5fd' : '#3b82f6',
                color: '#ffffff',
                cursor: exporting ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'inherit',
                boxShadow: '0 1px 2px rgba(59,130,246,0.25)',
              }}
            >
              {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div
          style={{
            width: '280px',
            minWidth: '280px',
            borderRight: '1px solid #1e293b',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
          }}
          data-testid="sidebar"
        >
          <Timeline
            steps={session.steps}
            selectedStepId={selectedStepId}
            onSelectStep={selectStep}
            onDeleteStep={handleDeleteStepRequest}
            onReorderStep={reorderSteps}
          />
        </div>

        {/* Main content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <TipsBanner selectedStepId={selectedStepId} />

          <div style={{
            flex: 1,
            overflow: 'auto',
          }}>
            {screenshotLoading ? (
              <div
                style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}
                data-testid="screenshot-loading"
              >
                Loading screenshot...
              </div>
            ) : (
              <AnnotationCanvas
                screenshotDataUrl={screenshotDataUrl}
                tool={activeTool}
                color={activeColor}
                annotations={selectedStep?.annotations}
                onAnnotationsChange={handleAnnotationsChange}
                onBlurConfirm={handleBlurConfirm}
                onCropConfirm={handleCropConfirm}
                onDeleteActive={handleDelete}
                onToolChange={setActiveTool}
                clickX={effectiveClickX}
                clickY={effectiveClickY}
                viewportWidth={effectiveVpW}
                viewportHeight={effectiveVpH}
                boundingRect={selectedStep?.element?.boundingRect}
                stepNumber={selectedStepIndex >= 0 ? selectedStepIndex + 1 : undefined}
              />
            )}
          </div>

          <div style={{ padding: '12px 20px 16px', backgroundColor: '#111827', borderTop: '1px solid #1e293b' }}>
            <ToolPalette
              activeTool={activeTool}
              activeColor={activeColor}
              onToolChange={setActiveTool}
              onColorChange={setActiveColor}
              onDelete={handleDelete}
            />
            {selectedStep && (
              <div style={{ marginTop: '12px' }}>
                <DescriptionEditor
                  description={selectedStep.description}
                  onChange={handleDescriptionChange}
                  {...(session?.mode === 'screenshot'
                    ? { label: 'Screenshot title' }
                    : { onEditClick: () => setShowDescriptionModal(true) }
                  )}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {exportError && (
        <div
          data-testid="export-error"
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #f87171',
            borderRadius: '4px',
            color: '#fca5a5',
            fontSize: '13px',
            zIndex: 10001,
          }}
        >
          {exportError}
        </div>
      )}

      {showReview && session && (
        <ExportReviewDialog
          title={session.title}
          sensitiveMatches={sensitiveMatches}
          logoDataUrl={logoDataUrl}
          onLogoChange={setLogoDataUrl}
          onConfirm={(settings) => confirmExport(settings, logoDataUrl)}
          onCancel={cancelExport}
        />
      )}

      {showDescriptionModal && selectedStep && (
        <DescriptionModal
          description={selectedStep.description}
          onSave={(text) => {
            handleDescriptionChange(text);
            setShowDescriptionModal(false);
          }}
          onCancel={() => setShowDescriptionModal(false)}
        />
      )}

      {pendingDeleteStepId && (() => {
        const step = session.steps.find((s) => s.id === pendingDeleteStepId);
        return step ? (
          <ConfirmDeleteDialog
            stepNumber={step.stepNumber}
            onConfirm={confirmDeleteStep}
            onCancel={cancelDeleteStep}
          />
        ) : null;
      })()}
    </div>
  );
}
