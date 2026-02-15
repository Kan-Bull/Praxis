import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';

// Mock the useAnnotationCanvas hook entirely — Fabric.js integration tested in E2E
vi.mock('../../../src/editor/hooks/useAnnotationCanvas', () => ({
  useAnnotationCanvas: vi.fn().mockReturnValue({
    deleteActiveObject: vi.fn(),
    canvas: null,
  }),
}));

import { AnnotationCanvas } from '../../../src/editor/components/AnnotationCanvas';
import { useAnnotationCanvas } from '../../../src/editor/hooks/useAnnotationCanvas';

describe('AnnotationCanvas', () => {
  const mockDeleteActive = vi.fn();

  const defaultProps = {
    screenshotDataUrl: 'data:image/png;base64,abc',
    tool: 'select' as const,
    color: '#ef4444',
    annotations: undefined,
    onAnnotationsChange: vi.fn(),
    onBlurConfirm: vi.fn(),
    onCropConfirm: vi.fn(),
    onDeleteActive: vi.fn(),
    clickX: undefined as number | undefined,
    clickY: undefined as number | undefined,
    viewportWidth: undefined as number | undefined,
    viewportHeight: undefined as number | undefined,
    boundingRect: undefined as import('../../../src/shared/types').BoundingRectLike | undefined,
    stepNumber: undefined as number | undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAnnotationCanvas as ReturnType<typeof vi.fn>).mockReturnValue({
      deleteActiveObject: mockDeleteActive,
      canvas: null,
    });
  });

  it('renders canvas element', () => {
    const { getByTestId } = render(<AnnotationCanvas {...defaultProps} />);
    expect(getByTestId('canvas-host')).toBeTruthy();
  });

  it('passes correct options to useAnnotationCanvas', () => {
    render(<AnnotationCanvas {...defaultProps} />);
    expect(useAnnotationCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        screenshotDataUrl: 'data:image/png;base64,abc',
        tool: 'select',
        color: '#ef4444',
        containerRef: expect.objectContaining({ current: expect.anything() }),
        canvasHostRef: expect.objectContaining({ current: expect.anything() }),
      }),
    );
  });

  it('does not show blur dialog initially', () => {
    const { queryByTestId } = render(<AnnotationCanvas {...defaultProps} />);
    expect(queryByTestId('blur-confirm-dialog')).toBeNull();
  });

  it('shows blur dialog when onBlurRequest is invoked', () => {
    // Capture the onBlurRequest callback passed to the hook
    let capturedOnBlurRequest: ((region: { x: number; y: number; width: number; height: number }) => void) | null = null;
    (useAnnotationCanvas as ReturnType<typeof vi.fn>).mockImplementation((opts: { onBlurRequest: typeof capturedOnBlurRequest }) => {
      capturedOnBlurRequest = opts.onBlurRequest;
      return { deleteActiveObject: mockDeleteActive, canvas: null };
    });

    const { getByTestId, queryByTestId, rerender } = render(
      <AnnotationCanvas {...defaultProps} />,
    );

    // Initially no dialog
    expect(queryByTestId('blur-confirm-dialog')).toBeNull();

    // Trigger blur request
    capturedOnBlurRequest!({ x: 10, y: 20, width: 100, height: 50 });

    // Re-render to see state change
    rerender(<AnnotationCanvas {...defaultProps} />);

    expect(getByTestId('blur-confirm-dialog')).toBeTruthy();
  });

  it('calls onBlurConfirm and hides dialog on confirm', () => {
    const onBlurConfirm = vi.fn();
    let capturedOnBlurRequest: ((region: { x: number; y: number; width: number; height: number }) => void) | null = null;
    (useAnnotationCanvas as ReturnType<typeof vi.fn>).mockImplementation((opts: { onBlurRequest: typeof capturedOnBlurRequest }) => {
      capturedOnBlurRequest = opts.onBlurRequest;
      return { deleteActiveObject: mockDeleteActive, canvas: null };
    });

    const { getByTestId, queryByTestId, rerender } = render(
      <AnnotationCanvas {...defaultProps} onBlurConfirm={onBlurConfirm} />,
    );

    capturedOnBlurRequest!({ x: 10, y: 20, width: 100, height: 50 });
    rerender(<AnnotationCanvas {...defaultProps} onBlurConfirm={onBlurConfirm} />);

    fireEvent.click(getByTestId('blur-confirm'));

    rerender(<AnnotationCanvas {...defaultProps} onBlurConfirm={onBlurConfirm} />);

    expect(onBlurConfirm).toHaveBeenCalledWith({ x: 10, y: 20, width: 100, height: 50 });
    expect(queryByTestId('blur-confirm-dialog')).toBeNull();
  });

  it('hides dialog on cancel without calling onBlurConfirm', () => {
    const onBlurConfirm = vi.fn();
    let capturedOnBlurRequest: ((region: { x: number; y: number; width: number; height: number }) => void) | null = null;
    (useAnnotationCanvas as ReturnType<typeof vi.fn>).mockImplementation((opts: { onBlurRequest: typeof capturedOnBlurRequest }) => {
      capturedOnBlurRequest = opts.onBlurRequest;
      return { deleteActiveObject: mockDeleteActive, canvas: null };
    });

    const { getByTestId, queryByTestId, rerender } = render(
      <AnnotationCanvas {...defaultProps} onBlurConfirm={onBlurConfirm} />,
    );

    capturedOnBlurRequest!({ x: 10, y: 20, width: 100, height: 50 });
    rerender(<AnnotationCanvas {...defaultProps} onBlurConfirm={onBlurConfirm} />);

    fireEvent.click(getByTestId('blur-cancel'));

    rerender(<AnnotationCanvas {...defaultProps} onBlurConfirm={onBlurConfirm} />);

    expect(onBlurConfirm).not.toHaveBeenCalled();
    expect(queryByTestId('blur-confirm-dialog')).toBeNull();
  });

  it('renders delete trigger button', () => {
    const { getByTestId } = render(<AnnotationCanvas {...defaultProps} />);
    expect(getByTestId('delete-trigger')).toBeTruthy();
  });

  it('passes click indicator props to useAnnotationCanvas', () => {
    const clickProps = {
      ...defaultProps,
      clickX: 150,
      clickY: 200,
      viewportWidth: 1920,
      viewportHeight: 1080,
      boundingRect: { x: 100, y: 180, width: 100, height: 40, top: 180, right: 200, bottom: 220, left: 100 },
      stepNumber: 3,
    };
    render(<AnnotationCanvas {...clickProps} />);
    expect(useAnnotationCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        clickX: 150,
        clickY: 200,
        viewportWidth: 1920,
        viewportHeight: 1080,
        boundingRect: expect.objectContaining({ x: 100, y: 180, width: 100 }),
        stepNumber: 3,
      }),
    );
  });

  it('passes undefined click props when no click data provided', () => {
    render(<AnnotationCanvas {...defaultProps} />);
    expect(useAnnotationCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        clickX: undefined,
        clickY: undefined,
        viewportWidth: undefined,
        viewportHeight: undefined,
        boundingRect: undefined,
        stepNumber: undefined,
      }),
    );
  });

  it('does not show crop dialog initially', () => {
    const { queryByTestId } = render(<AnnotationCanvas {...defaultProps} />);
    expect(queryByTestId('crop-confirm-dialog')).toBeNull();
  });

  it('shows crop dialog when onCropRequest is invoked', () => {
    let capturedOnCropRequest: ((region: { x: number; y: number; width: number; height: number }) => void) | null = null;
    (useAnnotationCanvas as ReturnType<typeof vi.fn>).mockImplementation((opts: { onCropRequest: typeof capturedOnCropRequest; onBlurRequest: unknown }) => {
      capturedOnCropRequest = opts.onCropRequest;
      return { deleteActiveObject: mockDeleteActive, canvas: null };
    });

    const { getByTestId, queryByTestId, rerender } = render(
      <AnnotationCanvas {...defaultProps} />,
    );

    expect(queryByTestId('crop-confirm-dialog')).toBeNull();

    capturedOnCropRequest!({ x: 50, y: 60, width: 200, height: 150 });
    rerender(<AnnotationCanvas {...defaultProps} />);

    expect(getByTestId('crop-confirm-dialog')).toBeTruthy();
  });

  it('calls onCropConfirm and hides dialog on confirm', () => {
    const onCropConfirm = vi.fn();
    let capturedOnCropRequest: ((region: { x: number; y: number; width: number; height: number }) => void) | null = null;
    (useAnnotationCanvas as ReturnType<typeof vi.fn>).mockImplementation((opts: { onCropRequest: typeof capturedOnCropRequest; onBlurRequest: unknown }) => {
      capturedOnCropRequest = opts.onCropRequest;
      return { deleteActiveObject: mockDeleteActive, canvas: null };
    });

    const { getByTestId, queryByTestId, rerender } = render(
      <AnnotationCanvas {...defaultProps} onCropConfirm={onCropConfirm} />,
    );

    capturedOnCropRequest!({ x: 50, y: 60, width: 200, height: 150 });
    rerender(<AnnotationCanvas {...defaultProps} onCropConfirm={onCropConfirm} />);

    fireEvent.click(getByTestId('crop-confirm'));
    rerender(<AnnotationCanvas {...defaultProps} onCropConfirm={onCropConfirm} />);

    expect(onCropConfirm).toHaveBeenCalledWith({ x: 50, y: 60, width: 200, height: 150 });
    expect(queryByTestId('crop-confirm-dialog')).toBeNull();
  });

  it('hides crop dialog on cancel without calling onCropConfirm', () => {
    const onCropConfirm = vi.fn();
    let capturedOnCropRequest: ((region: { x: number; y: number; width: number; height: number }) => void) | null = null;
    (useAnnotationCanvas as ReturnType<typeof vi.fn>).mockImplementation((opts: { onCropRequest: typeof capturedOnCropRequest; onBlurRequest: unknown }) => {
      capturedOnCropRequest = opts.onCropRequest;
      return { deleteActiveObject: mockDeleteActive, canvas: null };
    });

    const { getByTestId, queryByTestId, rerender } = render(
      <AnnotationCanvas {...defaultProps} onCropConfirm={onCropConfirm} />,
    );

    capturedOnCropRequest!({ x: 50, y: 60, width: 200, height: 150 });
    rerender(<AnnotationCanvas {...defaultProps} onCropConfirm={onCropConfirm} />);

    fireEvent.click(getByTestId('crop-cancel'));
    rerender(<AnnotationCanvas {...defaultProps} onCropConfirm={onCropConfirm} />);

    expect(onCropConfirm).not.toHaveBeenCalled();
    expect(queryByTestId('crop-confirm-dialog')).toBeNull();
  });
});
