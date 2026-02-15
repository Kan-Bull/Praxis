import { h } from 'preact';
import { useRef, useState, useCallback } from 'preact/hooks';
import { useAnnotationCanvas } from '../hooks/useAnnotationCanvas';
import type { ToolType } from './ToolPalette';
import type { BoundingRectLike } from '@shared/types';

export interface AnnotationCanvasProps {
  screenshotDataUrl: string | null;
  tool: ToolType;
  color: string;
  annotations: string | undefined;
  onAnnotationsChange: (json: string) => void;
  onBlurConfirm: (region: { x: number; y: number; width: number; height: number }) => void;
  onCropConfirm: (region: { x: number; y: number; width: number; height: number; imageWidth: number; imageHeight: number }) => void;
  onDeleteActive: () => void;
  onToolChange?: (tool: ToolType) => void;
  clickX?: number;
  clickY?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  boundingRect?: BoundingRectLike;
  stepNumber?: number;
}

const blueprintStyle = {
  backgroundColor: '#0f172a',
  backgroundImage: [
    'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
    'linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
    'linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
  ].join(', '),
  backgroundSize: '80px 80px, 80px 80px, 20px 20px, 20px 20px',
};

export function AnnotationCanvas({
  screenshotDataUrl,
  tool,
  color,
  annotations,
  onAnnotationsChange,
  onBlurConfirm,
  onCropConfirm,
  onToolChange,
  clickX,
  clickY,
  viewportWidth,
  viewportHeight,
  boundingRect,
  stepNumber,
}: AnnotationCanvasProps) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [blurRegion, setBlurRegion] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const [cropRegion, setCropRegion] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    imageWidth: number;
    imageHeight: number;
  } | null>(null);

  const handleBlurRequest = useCallback(
    (region: { x: number; y: number; width: number; height: number }) => {
      setBlurRegion(region);
    },
    [],
  );

  const handleCropRequest = useCallback(
    (region: { x: number; y: number; width: number; height: number; imageWidth: number; imageHeight: number }) => {
      setCropRegion(region);
    },
    [],
  );

  const { deleteActiveObject } = useAnnotationCanvas({
    canvasHostRef,
    containerRef,
    screenshotDataUrl,
    tool,
    color,
    annotations,
    onAnnotationsChange,
    onBlurRequest: handleBlurRequest,
    onCropRequest: handleCropRequest,
    onToolChange,
    clickX,
    clickY,
    viewportWidth,
    viewportHeight,
    boundingRect,
    stepNumber,
  });

  function handleBlurConfirm() {
    if (blurRegion) {
      onBlurConfirm(blurRegion);
      setBlurRegion(null);
    }
  }

  function handleBlurCancel() {
    setBlurRegion(null);
  }

  function handleCropConfirm() {
    if (cropRegion) {
      onCropConfirm(cropRegion);
      setCropRegion(null);
    }
  }

  function handleCropCancel() {
    setCropRegion(null);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', minHeight: '100%', ...blueprintStyle }} data-testid="annotation-canvas-wrapper">
      <div style={{ flex: 1, minWidth: '20px' }} data-testid="gutter-left" />
      <div ref={canvasHostRef} data-testid="canvas-host" style={{ flexShrink: 0, paddingTop: '20px', paddingBottom: '20px' }} />
      <div style={{ flex: 1, minWidth: '20px' }} data-testid="gutter-right" />

      {blurRegion && (
        <div
          data-testid="blur-confirm-dialog"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            zIndex: 10,
            textAlign: 'center',
            maxWidth: '300px',
          }}
        >
          <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#e2e8f0' }}>
            Blur permanently removes pixel data. Cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleBlurCancel}
              data-testid="blur-cancel"
              style={{
                padding: '6px 16px',
                border: '1px solid #334155',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                color: '#e2e8f0',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBlurConfirm}
              data-testid="blur-confirm"
              style={{
                padding: '6px 16px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'inherit',
              }}
            >
              Blur Region
            </button>
          </div>
        </div>
      )}

      {cropRegion && (
        <div
          data-testid="crop-confirm-dialog"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            zIndex: 10,
            textAlign: 'center',
            maxWidth: '320px',
          }}
        >
          <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#e2e8f0' }}>
            Crop will resize the screenshot and clear all annotations.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleCropCancel}
              data-testid="crop-cancel"
              style={{
                padding: '6px 16px',
                border: '1px solid #334155',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                color: '#e2e8f0',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCropConfirm}
              data-testid="crop-confirm"
              style={{
                padding: '6px 16px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'inherit',
              }}
            >
              Crop
            </button>
          </div>
        </div>
      )}

      {/* Expose deleteActiveObject for parent */}
      <button
        type="button"
        onClick={deleteActiveObject}
        style={{ display: 'none' }}
        data-testid="delete-trigger"
      />
    </div>
  );
}
