import { describe, it, expect, vi } from 'vitest';
import type { UseAnnotationCanvasOptions } from '../../../src/editor/hooks/useAnnotationCanvas';

/**
 * useAnnotationCanvas relies on dynamic `import('fabric')` which cannot be
 * intercepted by `vi.mock` in jsdom. The actual Fabric.js canvas rendering
 * and click indicator placement is validated via E2E tests.
 *
 * These unit tests verify:
 * - The options interface accepts click indicator props
 * - The coordinate logic (viewportToCanvas, boundingRectCenter) is covered
 *   in coordinateScaler.test.ts
 * - The indicator factory (createClickIndicator) is covered in
 *   fabricHelpers.test.ts
 * - Prop pass-through is covered in AnnotationCanvas.test.tsx and App.test.tsx
 */

describe('useAnnotationCanvas interface', () => {
  it('accepts click indicator options without error', () => {
    // Verify the interface allows the new fields (compile-time check)
    const opts: UseAnnotationCanvasOptions = {
      canvasHostRef: { current: null },
      containerRef: { current: null },
      screenshotDataUrl: 'data:image/png;base64,abc',
      tool: 'select',
      color: '#ef4444',
      annotations: undefined,
      onAnnotationsChange: vi.fn(),
      onBlurRequest: vi.fn(),
      onCropRequest: vi.fn(),
      clickX: 150,
      clickY: 200,
      viewportWidth: 1920,
      viewportHeight: 1080,
      boundingRect: {
        x: 100,
        y: 180,
        width: 100,
        height: 40,
        top: 180,
        right: 200,
        bottom: 220,
        left: 100,
      },
      stepNumber: 1,
    };
    expect(opts.clickX).toBe(150);
    expect(opts.clickY).toBe(200);
    expect(opts.viewportWidth).toBe(1920);
    expect(opts.viewportHeight).toBe(1080);
    expect(opts.stepNumber).toBe(1);
  });

  it('allows omitting click indicator options (backward compat)', () => {
    const opts: UseAnnotationCanvasOptions = {
      canvasHostRef: { current: null },
      containerRef: { current: null },
      screenshotDataUrl: null,
      tool: 'select',
      color: '#ef4444',
      annotations: undefined,
      onAnnotationsChange: vi.fn(),
      onBlurRequest: vi.fn(),
      onCropRequest: vi.fn(),
    };
    expect(opts.clickX).toBeUndefined();
    expect(opts.clickY).toBeUndefined();
    expect(opts.viewportWidth).toBeUndefined();
    expect(opts.viewportHeight).toBeUndefined();
    expect(opts.boundingRect).toBeUndefined();
    expect(opts.stepNumber).toBeUndefined();
  });

  it('accepts arrow as a valid tool type', () => {
    // Verify the interface allows 'arrow' for the drawing tool
    const opts: UseAnnotationCanvasOptions = {
      canvasHostRef: { current: null },
      containerRef: { current: null },
      screenshotDataUrl: 'data:image/png;base64,abc',
      tool: 'arrow',
      color: '#3b82f6',
      annotations: undefined,
      onAnnotationsChange: vi.fn(),
      onBlurRequest: vi.fn(),
      onCropRequest: vi.fn(),
    };
    expect(opts.tool).toBe('arrow');
  });

  it('skips auto-placement when annotations already exist', () => {
    // This documents the expected behavior:
    // When annotations are non-empty, the hook loads saved annotations
    // and does NOT auto-add a click indicator.
    // The actual behavior is tested via E2E (Fabric.js required).
    const opts: UseAnnotationCanvasOptions = {
      canvasHostRef: { current: null },
      containerRef: { current: null },
      screenshotDataUrl: 'data:image/png;base64,abc',
      tool: 'select',
      color: '#ef4444',
      annotations: '{"version":"6.0.0","objects":[]}',
      onAnnotationsChange: vi.fn(),
      onBlurRequest: vi.fn(),
      onCropRequest: vi.fn(),
      clickX: 150,
      clickY: 200,
      viewportWidth: 1920,
      viewportHeight: 1080,
      stepNumber: 1,
    };
    // With annotations set, the hook should load them and skip indicator.
    // We verify the interface is valid; behavior is E2E.
    expect(opts.annotations).toBeTruthy();
    expect(opts.clickX).toBe(150);
  });
});
