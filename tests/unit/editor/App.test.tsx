import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, act } from '@testing-library/preact';

// Mock useSession hook
const mockUseSession = vi.fn();
vi.mock('../../../src/editor/hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

// Mock useUnsavedChanges
vi.mock('../../../src/editor/hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: vi.fn(),
}));

// Mock useAnnotationCanvas to avoid Fabric.js
vi.mock('../../../src/editor/hooks/useAnnotationCanvas', () => ({
  useAnnotationCanvas: vi.fn().mockReturnValue({
    deleteActiveObject: vi.fn(),
    canvas: null,
  }),
}));

// Mock cropScreenshot
vi.mock('../../../src/shared/imageProcessor', () => ({
  cropScreenshot: vi.fn().mockResolvedValue('data:image/png;base64,cropped'),
}));

// Mock useExport
const mockStartExport = vi.fn();
const mockConfirmExport = vi.fn();
const mockCancelExport = vi.fn();
const mockUseExport = vi.fn();
vi.mock('../../../src/editor/hooks/useExport', () => ({
  useExport: (...args: unknown[]) => mockUseExport(...args),
}));

import { App } from '../../../src/editor/App';
import { useAnnotationCanvas } from '../../../src/editor/hooks/useAnnotationCanvas';
import { cropScreenshot } from '../../../src/shared/imageProcessor';
import type { CaptureSession } from '../../../src/shared/types';

const mockCropScreenshot = vi.mocked(cropScreenshot);

function makeSession(overrides: Partial<CaptureSession> = {}): CaptureSession {
  return {
    id: 'session-1',
    tabId: 1,
    status: 'editing',
    title: 'Test Session',
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        description: 'Clicked button',
        screenshotDataUrl: '',
        element: {
          tagName: 'BUTTON',
          boundingRect: { x: 0, y: 0, width: 100, height: 40, top: 0, right: 100, bottom: 40, left: 0 },
          isInIframe: false,
        },
        interaction: {
          type: 'click',
          timestamp: 1000,
          url: 'https://example.com',
          element: {
            tagName: 'BUTTON',
            boundingRect: { x: 0, y: 0, width: 100, height: 40, top: 0, right: 100, bottom: 40, left: 0 },
            isInIframe: false,
          },
        },
        timestamp: 1000,
        url: 'https://example.com',
      },
    ],
    startUrl: 'https://example.com',
    startedAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

const baseReturn = {
  session: null as CaptureSession | null,
  loading: false,
  error: null as string | null,
  selectedStepId: null as string | null,
  screenshotDataUrl: null as string | null,
  screenshotLoading: false,
  dirtySteps: new Set<string>(),
  selectStep: vi.fn(),
  updateDescription: vi.fn(),
  updateAnnotations: vi.fn(),
  updateScreenshot: vi.fn(),
  deleteStep: vi.fn(),
  getCachedScreenshot: vi.fn().mockReturnValue(null),
};

const mockExportPng = vi.fn();
const mockCopyToClipboard = vi.fn().mockResolvedValue(true);

const baseExportReturn = {
  showReview: false,
  exporting: false,
  sensitiveMatches: [],
  exportError: null as string | null,
  logoDataUrl: null as string | null,
  setLogoDataUrl: vi.fn(),
  startExport: mockStartExport,
  confirmExport: mockConfirmExport,
  cancelExport: mockCancelExport,
  exportPng: mockExportPng,
  copyToClipboard: mockCopyToClipboard,
};

describe('App', () => {
  beforeEach(() => {
    mockUseSession.mockReset();
    mockUseExport.mockReset();
    mockStartExport.mockReset();
    mockConfirmExport.mockReset();
    mockCancelExport.mockReset();
    mockUseExport.mockReturnValue(baseExportReturn);
  });

  it('shows loading state', () => {
    mockUseSession.mockReturnValue({ ...baseReturn, loading: true });
    const { getByTestId } = render(<App />);
    expect(getByTestId('loading')).toBeTruthy();
  });

  it('shows error state', () => {
    mockUseSession.mockReturnValue({ ...baseReturn, error: 'Something went wrong' });
    const { getByTestId } = render(<App />);
    expect(getByTestId('error').textContent).toContain('Something went wrong');
  });

  it('shows empty state when no session', () => {
    mockUseSession.mockReturnValue({ ...baseReturn });
    const { getByTestId } = render(<App />);
    expect(getByTestId('empty')).toBeTruthy();
  });

  it('renders editor layout with session', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId, getByText } = render(<App />);
    expect(getByTestId('editor-layout')).toBeTruthy();
    expect(getByText('Praxis Editor')).toBeTruthy();
    expect(getByTestId('sidebar')).toBeTruthy();
  });

  it('shows tips banner in layout', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId } = render(<App />);
    expect(getByTestId('tips-banner')).toBeTruthy();
  });

  it('renders export button as enabled', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId } = render(<App />);
    const exportBtn = getByTestId('export-button') as HTMLButtonElement;
    expect(exportBtn.disabled).toBe(false);
    expect(exportBtn.textContent).toBe('Export PDF');
  });

  it('calls startExport when export button clicked', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId } = render(<App />);
    fireEvent.click(getByTestId('export-button'));
    expect(mockStartExport).toHaveBeenCalledOnce();
  });

  it('renders review dialog when showReview is true', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    mockUseExport.mockReturnValue({
      ...baseExportReturn,
      showReview: true,
    });
    const { getByTestId } = render(<App />);
    expect(getByTestId('export-review-dialog')).toBeTruthy();
  });

  it('renders description editor for selected step', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId } = render(<App />);
    expect(getByTestId('description-edit-trigger').textContent).toBe('Clicked button');
  });

  it('renders inline input with "Screenshot title" label in screenshot mode', () => {
    const session = makeSession({ mode: 'screenshot' });
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId, getByText, queryByTestId } = render(<App />);
    expect(getByText('Screenshot title')).toBeTruthy();
    expect(getByTestId('description-inline-input')).toBeTruthy();
    expect(queryByTestId('description-edit-trigger')).toBeNull();
  });

  it('does not open description modal in screenshot mode', () => {
    const session = makeSession({ mode: 'screenshot' });
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { queryByTestId } = render(<App />);
    // No modal trigger button exists, so modal cannot open
    expect(queryByTestId('description-edit-trigger')).toBeNull();
    expect(queryByTestId('description-modal')).toBeNull();
  });

  it('shows "Screenshot Editor" header in screenshot mode', () => {
    const session = makeSession({ mode: 'screenshot' });
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByText, queryByText } = render(<App />);
    expect(getByText('Screenshot Editor')).toBeTruthy();
    expect(queryByText('Praxis Editor')).toBeNull();
  });

  it('hides Export PDF button in screenshot mode', () => {
    const session = makeSession({ mode: 'screenshot' });
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { queryByTestId, getByTestId } = render(<App />);
    expect(queryByTestId('export-button')).toBeNull();
    // Screenshot export should still be visible
    expect(getByTestId('screenshot-export-button')).toBeTruthy();
  });

  it('passes click indicator data to AnnotationCanvas via useAnnotationCanvas', () => {
    const session = makeSession({
      steps: [
        {
          id: 'step-1',
          stepNumber: 1,
          description: 'Clicked button',
          screenshotDataUrl: '',
          element: {
            tagName: 'BUTTON',
            boundingRect: { x: 50, y: 80, width: 100, height: 40, top: 80, right: 150, bottom: 120, left: 50 },
            isInIframe: false,
          },
          interaction: {
            type: 'click',
            timestamp: 1000,
            url: 'https://example.com',
            element: {
              tagName: 'BUTTON',
              boundingRect: { x: 50, y: 80, width: 100, height: 40, top: 80, right: 150, bottom: 120, left: 50 },
              isInIframe: false,
            },
            clickX: 100,
            clickY: 95,
            viewportWidth: 1920,
            viewportHeight: 1080,
          },
          timestamp: 1000,
          url: 'https://example.com',
        },
      ],
    });
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    render(<App />);
    expect(useAnnotationCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        clickX: 100,
        clickY: 95,
        viewportWidth: 1920,
        viewportHeight: 1080,
        boundingRect: expect.objectContaining({ x: 50, y: 80, width: 100 }),
        stepNumber: 1,
      }),
    );
  });

  it('shows confirmation dialog when step delete is triggered', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId, queryByTestId } = render(<App />);
    // No dialog initially
    expect(queryByTestId('confirm-delete-dialog')).toBeNull();
    // Click the delete button on the step card
    fireEvent.click(getByTestId('delete-step-step-1'));
    // Dialog should appear
    expect(getByTestId('confirm-delete-dialog')).toBeTruthy();
  });

  it('calls deleteStep only after confirmation', () => {
    const mockDeleteStep = vi.fn();
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
      deleteStep: mockDeleteStep,
    });
    const { getByTestId } = render(<App />);
    // Trigger delete
    fireEvent.click(getByTestId('delete-step-step-1'));
    // Not yet deleted
    expect(mockDeleteStep).not.toHaveBeenCalled();
    // Confirm
    fireEvent.click(getByTestId('confirm-delete'));
    expect(mockDeleteStep).toHaveBeenCalledWith('step-1');
  });

  it('dismisses confirmation dialog on cancel', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId, queryByTestId } = render(<App />);
    fireEvent.click(getByTestId('delete-step-step-1'));
    expect(getByTestId('confirm-delete-dialog')).toBeTruthy();
    fireEvent.click(getByTestId('confirm-cancel'));
    expect(queryByTestId('confirm-delete-dialog')).toBeNull();
  });

  it('passes undefined click props when interaction lacks coordinates', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    render(<App />);
    expect(useAnnotationCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        clickX: undefined,
        clickY: undefined,
        viewportWidth: undefined,
        viewportHeight: undefined,
        stepNumber: 1,
      }),
    );
  });

  it('crops screenshot, updates it, and clears annotations on crop confirm', async () => {
    const mockUpdateScreenshot = vi.fn();
    const mockUpdateAnnotations = vi.fn();
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
      screenshotDataUrl: 'data:image/png;base64,original',
      updateScreenshot: mockUpdateScreenshot,
      updateAnnotations: mockUpdateAnnotations,
    });

    // Capture the onCropConfirm callback passed through AnnotationCanvas → useAnnotationCanvas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedOnCropRequest: ((region: any) => void) | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useAnnotationCanvas as ReturnType<typeof vi.fn>).mockImplementation((opts: any) => {
      capturedOnCropRequest = opts.onCropRequest;
      return { deleteActiveObject: vi.fn(), canvas: null };
    });

    mockCropScreenshot.mockResolvedValue('data:image/png;base64,cropped');

    const { getByTestId, rerender } = render(<App />);

    // Simulate crop request from canvas (step has no clickX/clickY so indicator is suppressed)
    capturedOnCropRequest!({ x: 50, y: 60, width: 200, height: 150, imageWidth: 800, imageHeight: 600 });
    rerender(<App />);

    // Crop dialog should appear
    expect(getByTestId('crop-confirm-dialog')).toBeTruthy();

    // Confirm crop
    await act(async () => {
      fireEvent.click(getByTestId('crop-confirm'));
    });

    expect(mockCropScreenshot).toHaveBeenCalledWith(
      'data:image/png;base64,original',
      expect.objectContaining({ x: 50, y: 60, width: 200, height: 150 }),
    );
    expect(mockUpdateScreenshot).toHaveBeenCalledWith('step-1', 'data:image/png;base64,cropped');
    // No click coords on step → indicator suppressed
    expect(mockUpdateAnnotations).toHaveBeenCalledWith('step-1', '{"objects":[]}');
  });

  it('adjusts click indicator position after crop when click coords are present', async () => {
    const mockUpdateScreenshot = vi.fn();
    const mockUpdateAnnotations = vi.fn();
    const session = makeSession({
      steps: [
        {
          id: 'step-1',
          stepNumber: 1,
          description: 'Clicked button',
          screenshotDataUrl: '',
          element: {
            tagName: 'BUTTON',
            boundingRect: { x: 500, y: 300, width: 100, height: 40, top: 300, right: 600, bottom: 340, left: 500 },
            isInIframe: false,
          },
          interaction: {
            type: 'click',
            timestamp: 1000,
            url: 'https://example.com',
            element: {
              tagName: 'BUTTON',
              boundingRect: { x: 500, y: 300, width: 100, height: 40, top: 300, right: 600, bottom: 340, left: 500 },
              isInIframe: false,
            },
            clickX: 550,
            clickY: 320,
            viewportWidth: 1920,
            viewportHeight: 1080,
          },
          timestamp: 1000,
          url: 'https://example.com',
        },
      ],
    });
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
      screenshotDataUrl: 'data:image/png;base64,original',
      updateScreenshot: mockUpdateScreenshot,
      updateAnnotations: mockUpdateAnnotations,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedOnCropRequest: ((region: any) => void) | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useAnnotationCanvas as ReturnType<typeof vi.fn>).mockImplementation((opts: any) => {
      capturedOnCropRequest = opts.onCropRequest;
      return { deleteActiveObject: vi.fn(), canvas: null };
    });

    mockCropScreenshot.mockResolvedValue('data:image/png;base64,cropped');

    const { getByTestId, rerender } = render(<App />);

    // Crop region: (400, 200, 400x300) in a 1920x1080 image
    // Click at viewport (550, 320) → image-space (550, 320) since image=viewport (1:1)
    // Adjusted for crop: (550-400, 320-200) = (150, 120) — inside crop bounds
    capturedOnCropRequest!({ x: 400, y: 200, width: 400, height: 300, imageWidth: 1920, imageHeight: 1080 });
    rerender(<App />);

    await act(async () => {
      fireEvent.click(getByTestId('crop-confirm'));
    });

    // Click is inside crop → annotations cleared to '' (allows auto-placement with adjusted coords)
    expect(mockUpdateAnnotations).toHaveBeenCalledWith('step-1', '');

    // Verify adjusted coords are passed to AnnotationCanvas via useAnnotationCanvas
    expect(useAnnotationCanvas).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clickX: 150,
        clickY: 120,
        viewportWidth: undefined,
        viewportHeight: undefined,
      }),
    );
  });

  it('suppresses click indicator when click falls outside crop region', async () => {
    const mockUpdateScreenshot = vi.fn();
    const mockUpdateAnnotations = vi.fn();
    const session = makeSession({
      steps: [
        {
          id: 'step-1',
          stepNumber: 1,
          description: 'Clicked button',
          screenshotDataUrl: '',
          element: {
            tagName: 'BUTTON',
            boundingRect: { x: 50, y: 50, width: 100, height: 40, top: 50, right: 150, bottom: 90, left: 50 },
            isInIframe: false,
          },
          interaction: {
            type: 'click',
            timestamp: 1000,
            url: 'https://example.com',
            element: {
              tagName: 'BUTTON',
              boundingRect: { x: 50, y: 50, width: 100, height: 40, top: 50, right: 150, bottom: 90, left: 50 },
              isInIframe: false,
            },
            clickX: 100,
            clickY: 70,
            viewportWidth: 1920,
            viewportHeight: 1080,
          },
          timestamp: 1000,
          url: 'https://example.com',
        },
      ],
    });
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
      screenshotDataUrl: 'data:image/png;base64,original',
      updateScreenshot: mockUpdateScreenshot,
      updateAnnotations: mockUpdateAnnotations,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedOnCropRequest: ((region: any) => void) | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useAnnotationCanvas as ReturnType<typeof vi.fn>).mockImplementation((opts: any) => {
      capturedOnCropRequest = opts.onCropRequest;
      return { deleteActiveObject: vi.fn(), canvas: null };
    });

    mockCropScreenshot.mockResolvedValue('data:image/png;base64,cropped');

    const { getByTestId, rerender } = render(<App />);

    // Crop at (800, 500, 400x300) — click at (100, 70) is far outside this region
    capturedOnCropRequest!({ x: 800, y: 500, width: 400, height: 300, imageWidth: 1920, imageHeight: 1080 });
    rerender(<App />);

    await act(async () => {
      fireEvent.click(getByTestId('crop-confirm'));
    });

    // Click outside crop → indicator suppressed
    expect(mockUpdateAnnotations).toHaveBeenCalledWith('step-1', '{"objects":[]}');
  });

  it('renders Export Screenshot dropdown button', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId } = render(<App />);
    expect(getByTestId('screenshot-export-button')).toBeTruthy();
  });

  it('disables Export Screenshot button when no step is selected', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: null,
    });
    const { getByTestId } = render(<App />);
    expect((getByTestId('screenshot-export-button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows dropdown menu on Export Screenshot button click', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId, queryByTestId } = render(<App />);
    expect(queryByTestId('screenshot-export-menu')).toBeNull();
    fireEvent.click(getByTestId('screenshot-export-button'));
    expect(getByTestId('screenshot-export-menu')).toBeTruthy();
  });

  it('calls exportPng when Download PNG menu item is clicked', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId } = render(<App />);
    fireEvent.click(getByTestId('screenshot-export-button'));
    fireEvent.click(getByTestId('screenshot-download-png'));
    expect(mockExportPng).toHaveBeenCalledWith(session.steps[0]);
  });

  it('calls copyToClipboard when Copy to Clipboard menu item is clicked', async () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId } = render(<App />);
    fireEvent.click(getByTestId('screenshot-export-button'));
    await act(async () => {
      fireEvent.click(getByTestId('screenshot-copy-clipboard'));
    });
    expect(mockCopyToClipboard).toHaveBeenCalledWith(session.steps[0]);
  });

  it('closes dropdown after Download PNG is clicked', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId, queryByTestId } = render(<App />);
    fireEvent.click(getByTestId('screenshot-export-button'));
    expect(getByTestId('screenshot-export-menu')).toBeTruthy();
    fireEvent.click(getByTestId('screenshot-download-png'));
    expect(queryByTestId('screenshot-export-menu')).toBeNull();
  });

  it('shows clipboard toast after copy to clipboard', async () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId, queryByTestId } = render(<App />);
    fireEvent.click(getByTestId('screenshot-export-button'));
    await act(async () => {
      fireEvent.click(getByTestId('screenshot-copy-clipboard'));
    });
    expect(getByTestId('clipboard-toast')).toBeTruthy();
    expect(getByTestId('clipboard-toast').textContent).toContain('Copied to clipboard');
  });

  it('closes dropdown on Escape key', () => {
    const session = makeSession();
    mockUseSession.mockReturnValue({
      ...baseReturn,
      session,
      selectedStepId: 'step-1',
    });
    const { getByTestId, queryByTestId } = render(<App />);
    fireEvent.click(getByTestId('screenshot-export-button'));
    expect(getByTestId('screenshot-export-menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(queryByTestId('screenshot-export-menu')).toBeNull();
  });
});
