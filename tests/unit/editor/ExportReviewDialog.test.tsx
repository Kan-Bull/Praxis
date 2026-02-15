import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { ExportReviewDialog } from '../../../src/editor/components/ExportReviewDialog';
import type { SensitiveMatch } from '../../../src/editor/lib/sensitiveTextScanner';
import type { ExportSettings } from '../../../src/editor/components/ExportReviewDialog';

describe('ExportReviewDialog', () => {
  const defaultProps = {
    title: 'My Workflow Guide',
    sensitiveMatches: [] as SensitiveMatch[],
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title input with default value', () => {
    const { getByTestId } = render(<ExportReviewDialog {...defaultProps} />);
    const input = getByTestId('export-title-input') as HTMLInputElement;
    expect(input.value).toBe('My Workflow Guide');
  });

  it('renders author input (empty by default)', () => {
    const { getByTestId } = render(<ExportReviewDialog {...defaultProps} />);
    const input = getByTestId('export-author-input') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('Author name');
  });

  it('renders date input (auto-populated with today)', () => {
    const { getByTestId } = render(<ExportReviewDialog {...defaultProps} />);
    const input = getByTestId('export-date-input') as HTMLInputElement;
    // Should have a non-empty date string
    expect(input.value.length).toBeGreaterThan(0);
    // Should contain the current year
    expect(input.value).toContain(String(new Date().getFullYear()));
  });

  it('renders page size toggle with A4 selected by default', () => {
    const { getByTestId } = render(<ExportReviewDialog {...defaultProps} />);
    const a4Btn = getByTestId('page-size-a4') as HTMLButtonElement;
    const letterBtn = getByTestId('page-size-letter') as HTMLButtonElement;
    // A4 should be active (blue bg) — jsdom normalizes hex to rgb()
    expect(a4Btn.style.backgroundColor).toBe('rgb(59, 130, 246)');
    expect(letterBtn.style.backgroundColor).toBe('rgb(15, 23, 42)');
  });

  it('renders include URLs checkbox (checked by default)', () => {
    const { getByTestId } = render(<ExportReviewDialog {...defaultProps} />);
    const checkbox = getByTestId('include-urls-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('clicking Letter toggles page size', () => {
    const { getByTestId } = render(<ExportReviewDialog {...defaultProps} />);
    const letterBtn = getByTestId('page-size-letter');
    fireEvent.click(letterBtn);

    // Now Letter should be active — jsdom normalizes hex to rgb()
    expect((getByTestId('page-size-letter') as HTMLButtonElement).style.backgroundColor).toBe('rgb(59, 130, 246)');
    expect((getByTestId('page-size-a4') as HTMLButtonElement).style.backgroundColor).toBe('rgb(15, 23, 42)');
  });

  it('unchecking URLs checkbox updates state', () => {
    const { getByTestId } = render(<ExportReviewDialog {...defaultProps} />);
    const checkbox = getByTestId('include-urls-checkbox') as HTMLInputElement;
    fireEvent.change(checkbox, { target: { checked: false } });
    expect(checkbox.checked).toBe(false);
  });

  it('fires onConfirm with full ExportSettings object', () => {
    const onConfirm = vi.fn();
    const { getByTestId } = render(
      <ExportReviewDialog {...defaultProps} onConfirm={onConfirm} />,
    );
    fireEvent.click(getByTestId('export-confirm'));

    expect(onConfirm).toHaveBeenCalledOnce();
    const settings: ExportSettings = onConfirm.mock.calls[0][0];
    expect(settings.title).toBe('My Workflow Guide');
    expect(settings.author).toBe('');
    expect(settings.date).toBeTruthy();
    expect(settings.pageSize).toBe('a4');
    expect(settings.includeUrls).toBe(true);
  });

  it('fires onConfirm with edited fields', () => {
    const onConfirm = vi.fn();
    const { getByTestId } = render(
      <ExportReviewDialog {...defaultProps} onConfirm={onConfirm} />,
    );

    // Edit title
    fireEvent.input(getByTestId('export-title-input'), { target: { value: 'Custom Title' } });
    // Edit author
    fireEvent.input(getByTestId('export-author-input'), { target: { value: 'Alice' } });
    // Switch to Letter
    fireEvent.click(getByTestId('page-size-letter'));
    // Uncheck URLs
    fireEvent.change(getByTestId('include-urls-checkbox'), { target: { checked: false } });

    fireEvent.click(getByTestId('export-confirm'));

    const settings: ExportSettings = onConfirm.mock.calls[0][0];
    expect(settings.title).toBe('Custom Title');
    expect(settings.author).toBe('Alice');
    expect(settings.pageSize).toBe('letter');
    expect(settings.includeUrls).toBe(false);
  });

  it('fires onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    const { getByTestId } = render(
      <ExportReviewDialog {...defaultProps} onCancel={onCancel} />,
    );
    fireEvent.click(getByTestId('export-cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renders export confirm button with "Export PDF" text', () => {
    const { getByTestId } = render(<ExportReviewDialog {...defaultProps} />);
    expect(getByTestId('export-confirm').textContent).toBe('Export PDF');
  });

  describe('sensitive data summary', () => {
    it('does not show warning when no sensitive matches', () => {
      const { queryByTestId } = render(
        <ExportReviewDialog {...defaultProps} sensitiveMatches={[]} />,
      );
      expect(queryByTestId('sensitive-warning')).toBeNull();
    });

    it('shows summary line when sensitive matches exist', () => {
      const matches: SensitiveMatch[] = [
        { pattern: 'email', match: 'user@test.com', stepId: 's2' },
      ];
      const { getByTestId } = render(
        <ExportReviewDialog {...defaultProps} sensitiveMatches={matches} />,
      );
      const warning = getByTestId('sensitive-warning');
      expect(warning.textContent).toContain('1 potential sensitive item');
      expect(warning.textContent).toContain('step');
    });

    it('shows plural form for multiple matches across steps', () => {
      const matches: SensitiveMatch[] = [
        { pattern: 'email', match: 'user@test.com', stepId: 's1' },
        { pattern: 'phone', match: '555-1234', stepId: 's3' },
      ];
      const { getByTestId } = render(
        <ExportReviewDialog {...defaultProps} sensitiveMatches={matches} />,
      );
      const warning = getByTestId('sensitive-warning');
      expect(warning.textContent).toContain('2 potential sensitive items');
      expect(warning.textContent).toContain('steps');
      expect(warning.textContent).toContain('1, 2');
    });
  });

  describe('logo upload', () => {
    it('renders logo upload section when onLogoChange is provided', () => {
      const { getByTestId, getByText } = render(
        <ExportReviewDialog {...defaultProps} onLogoChange={vi.fn()} logoDataUrl={null} />,
      );
      expect(getByText('Logo watermark (optional)')).toBeTruthy();
      expect(getByTestId('logo-upload-btn')).toBeTruthy();
    });

    it('does not render logo upload when onLogoChange is not provided', () => {
      const { queryByText } = render(
        <ExportReviewDialog {...defaultProps} />,
      );
      expect(queryByText('Logo watermark (optional)')).toBeNull();
    });

    it('calls onLogoChange with data URL when file is selected', async () => {
      const onLogoChange = vi.fn();
      const { getByTestId } = render(
        <ExportReviewDialog {...defaultProps} onLogoChange={onLogoChange} logoDataUrl={null} />,
      );

      const fileInput = getByTestId('logo-file-input') as HTMLInputElement;

      // Create a mock file and mock FileReader
      const mockFile = new File(['pixel-data'], 'logo.png', { type: 'image/png' });
      const mockResult = 'data:image/png;base64,mockLogoData';

      // Mock FileReader — must use `function` (not arrow) so `new FileReader()` works
      const originalFileReader = globalThis.FileReader;
      let capturedOnload: (() => void) | null = null;
      const MockFileReaderClass = vi.fn(function (this: Record<string, unknown>) {
        this.result = mockResult;
        this.readAsDataURL = vi.fn();
        Object.defineProperty(this, 'onload', {
          set(fn: () => void) { capturedOnload = fn; },
          get() { return capturedOnload; },
        });
      });
      globalThis.FileReader = MockFileReaderClass as unknown as typeof FileReader;

      // Set files and trigger change
      Object.defineProperty(fileInput, 'files', { value: [mockFile], writable: false });
      fireEvent.change(fileInput);

      // Simulate FileReader completion
      (capturedOnload as (() => void) | null)?.();

      expect(onLogoChange).toHaveBeenCalledWith(mockResult);

      globalThis.FileReader = originalFileReader;
    });

    it('shows preview thumbnail when logoDataUrl is set', () => {
      const { getByTestId } = render(
        <ExportReviewDialog
          {...defaultProps}
          onLogoChange={vi.fn()}
          logoDataUrl="data:image/png;base64,abc"
        />,
      );
      const preview = getByTestId('logo-preview') as HTMLImageElement;
      expect(preview.src).toBe('data:image/png;base64,abc');
    });

    it('calls onLogoChange(null) when remove button is clicked', () => {
      const onLogoChange = vi.fn();
      const { getByTestId } = render(
        <ExportReviewDialog
          {...defaultProps}
          onLogoChange={onLogoChange}
          logoDataUrl="data:image/png;base64,abc"
        />,
      );
      fireEvent.click(getByTestId('logo-remove'));
      expect(onLogoChange).toHaveBeenCalledWith(null);
    });
  });
});
