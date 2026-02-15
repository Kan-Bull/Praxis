import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock jsPDF — jsdom has no real canvas so jsPDF cannot work natively
const mockText = vi.fn().mockReturnThis();
const mockSetFontSize = vi.fn().mockReturnThis();
const mockSetTextColor = vi.fn().mockReturnThis();
const mockSetDrawColor = vi.fn().mockReturnThis();
const mockSetFillColor = vi.fn().mockReturnThis();
const mockSetLineWidth = vi.fn().mockReturnThis();
const mockLine = vi.fn().mockReturnThis();
const mockCircle = vi.fn().mockReturnThis();
const mockTriangle = vi.fn().mockReturnThis();
const mockAddImage = vi.fn().mockReturnThis();
const mockAddPage = vi.fn().mockReturnThis();
const mockGetImageProperties = vi.fn().mockReturnValue({ width: 800, height: 600 });
const mockOutput = vi.fn().mockReturnValue(new ArrayBuffer(10));

const mockSplitTextToSize = vi.fn((text: string) => [text]);

// Approximate text width: ~0.5mm per char at 9pt
const mockGetTextWidth = vi.fn((text: string) => text.length * 0.5);

const mockSaveGraphicsState = vi.fn().mockReturnThis();
const mockRestoreGraphicsState = vi.fn().mockReturnThis();
const mockSetGState = vi.fn().mockReturnThis();

const mockDoc = {
  text: mockText,
  setFontSize: mockSetFontSize,
  setTextColor: mockSetTextColor,
  setDrawColor: mockSetDrawColor,
  setFillColor: mockSetFillColor,
  setLineWidth: mockSetLineWidth,
  setFont: vi.fn().mockReturnThis(),
  line: mockLine,
  circle: mockCircle,
  triangle: mockTriangle,
  addImage: mockAddImage,
  addPage: mockAddPage,
  getImageProperties: mockGetImageProperties,
  getTextWidth: mockGetTextWidth,
  splitTextToSize: mockSplitTextToSize,
  output: mockOutput,
  saveGraphicsState: mockSaveGraphicsState,
  restoreGraphicsState: mockRestoreGraphicsState,
  setGState: mockSetGState,
  GState: vi.fn(function (this: Record<string, unknown>, opts: Record<string, unknown>) {
    Object.assign(this, opts);
    return this;
  }),
  internal: {
    pageSize: { getWidth: () => 210, getHeight: () => 297 },
  },
};

vi.mock('jspdf', () => {
  // Must use `function` (not arrow) so `new jsPDF(...)` works as a constructor
  const MockJsPDFClass = vi.fn(function (this: Record<string, unknown>) {
    Object.assign(this, mockDoc);
    return this;
  });
  return { jsPDF: MockJsPDFClass };
});

import { generateExportPdf, type PdfExportStep, type PdfExportOptions } from '../../../src/editor/lib/pdfExporter';
import { jsPDF } from 'jspdf';

const MockJsPDF = vi.mocked(jsPDF);

function makeStep(overrides: Partial<PdfExportStep> = {}): PdfExportStep {
  return {
    stepNumber: 1,
    description: 'Click the button',
    screenshotDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    url: 'https://example.com',
    ...overrides,
  };
}

describe('pdfExporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetImageProperties.mockReturnValue({ width: 800, height: 600 });
    mockOutput.mockReturnValue(new ArrayBuffer(10));
  });

  it('returns a Blob with type application/pdf', async () => {
    const blob = await generateExportPdf({
      title: 'Test Guide',
      steps: [makeStep()],
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
  });

  it('creates jsPDF with A4 portrait config by default', async () => {
    await generateExportPdf({
      title: 'Test Guide',
      steps: [makeStep()],
    });

    expect(MockJsPDF).toHaveBeenCalledWith(
      expect.objectContaining({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      }),
    );
  });

  it('creates jsPDF with letter format when pageSize is letter', async () => {
    await generateExportPdf({
      title: 'Test Guide',
      steps: [makeStep()],
      pageSize: 'letter',
    });

    expect(MockJsPDF).toHaveBeenCalledWith(
      expect.objectContaining({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
      }),
    );
  });

  it('renders title text', async () => {
    await generateExportPdf({
      title: 'My Workflow Guide',
      steps: [makeStep()],
    });

    expect(mockText).toHaveBeenCalledWith(
      'My Workflow Guide',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('renders author and date subtitle when provided', async () => {
    await generateExportPdf({
      title: 'Test',
      steps: [makeStep()],
      author: 'Alice',
      date: 'February 14, 2026',
    });

    // Subtitle with em dash
    expect(mockText).toHaveBeenCalledWith(
      'Alice \u2014 February 14, 2026',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('renders only author when date is empty', async () => {
    await generateExportPdf({
      title: 'Test',
      steps: [makeStep()],
      author: 'Alice',
      date: '',
    });

    expect(mockText).toHaveBeenCalledWith(
      'Alice',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('renders only date when author is empty', async () => {
    await generateExportPdf({
      title: 'Test',
      steps: [makeStep()],
      author: '',
      date: 'February 14, 2026',
    });

    expect(mockText).toHaveBeenCalledWith(
      'February 14, 2026',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('omits subtitle when both author and date are empty', async () => {
    await generateExportPdf({
      title: 'Test',
      steps: [makeStep()],
      author: '',
      date: '',
    });

    // setFontSize(10) is used for the subtitle — should not be called before the step badge
    // Instead we check that the subtitle text (with em dash or standalone) is NOT present
    const textCalls = mockText.mock.calls.map((c) => c[0]);
    const hasSubtitleWithDash = textCalls.some(
      (t) => typeof t === 'string' && t.includes('\u2014'),
    );
    expect(hasSubtitleWithDash).toBe(false);
  });

  it('renders step description and URL', async () => {
    await generateExportPdf({
      title: 'Test',
      steps: [makeStep({ description: 'Fill in the form', url: 'https://app.example.com/form' })],
    });

    // Description text is now rendered via markdown renderer (word by word)
    // "Fill", "in", "the", "form" should each be rendered via doc.text()
    const textCalls = mockText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Fill');
    expect(textCalls).toContain('form');

    // URL text
    expect(mockText).toHaveBeenCalledWith(
      'https://app.example.com/form',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('shows URLs by default (backward compat)', async () => {
    await generateExportPdf({
      title: 'Test',
      steps: [makeStep({ url: 'https://example.com/page' })],
      // includeUrls not specified → should default to showing URLs
    });

    const textCalls = mockText.mock.calls.map((c) => c[0]);
    const hasUrl = textCalls.some(
      (t) => typeof t === 'string' && t.includes('example.com/page'),
    );
    expect(hasUrl).toBe(true);
  });

  it('skips URLs when includeUrls is false', async () => {
    await generateExportPdf({
      title: 'Test',
      steps: [makeStep({ url: 'https://example.com/page' })],
      includeUrls: false,
    });

    const textCalls = mockText.mock.calls.map((c) => c[0]);
    const hasUrl = textCalls.some(
      (t) => typeof t === 'string' && t.includes('example.com/page'),
    );
    expect(hasUrl).toBe(false);
  });

  it('calls addImage for each step with valid screenshot', async () => {
    await generateExportPdf({
      title: 'Test',
      steps: [makeStep(), makeStep({ stepNumber: 2 })],
    });

    expect(mockAddImage).toHaveBeenCalledTimes(2);
    expect(mockAddImage).toHaveBeenCalledWith(
      'data:image/png;base64,iVBORw0KGgo=',
      'PNG',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('adds pages for multiple steps', async () => {
    await generateExportPdf({
      title: 'Test',
      steps: [makeStep(), makeStep({ stepNumber: 2 }), makeStep({ stepNumber: 3 })],
    });

    // At least one addPage call for steps beyond the first
    expect(mockAddPage).toHaveBeenCalled();
  });

  it('returns valid Blob for empty steps array', async () => {
    const blob = await generateExportPdf({
      title: 'Empty Guide',
      steps: [],
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
    // Title should still be rendered
    expect(mockText).toHaveBeenCalledWith(
      'Empty Guide',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('auto-detects JPEG format from data URL', async () => {
    await generateExportPdf({
      title: 'Test',
      steps: [makeStep({ screenshotDataUrl: 'data:image/jpeg;base64,/9j/4AAQ' })],
    });

    expect(mockAddImage).toHaveBeenCalledWith(
      'data:image/jpeg;base64,/9j/4AAQ',
      'JPEG',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('skips image when screenshotDataUrl is empty', async () => {
    await generateExportPdf({
      title: 'Test',
      steps: [makeStep({ screenshotDataUrl: '' })],
    });

    expect(mockAddImage).not.toHaveBeenCalled();
  });

  describe('logo watermark', () => {
    it('adds logo image on first page when logoDataUrl is provided', async () => {
      await generateExportPdf({
        title: 'Test',
        steps: [makeStep()],
        logoDataUrl: 'data:image/png;base64,logoABC',
      });

      const logoCalls = mockAddImage.mock.calls.filter(
        (call) => call[0] === 'data:image/png;base64,logoABC',
      );
      expect(logoCalls.length).toBeGreaterThanOrEqual(1);
      // Should be positioned bottom-right: x = 210 - 15 - 15 = 180mm
      expect(logoCalls[0][2]).toBe(180); // x position
      // y = PAGE_HEIGHT - MARGIN - logoHeight = 297 - 15 - (15 * 600/800) = 297 - 15 - 11.25 = 270.75
      expect(logoCalls[0][3]).toBeCloseTo(270.75, 1); // y position (bottom-right)
    });

    it('renders logo with reduced opacity (watermark transparency)', async () => {
      await generateExportPdf({
        title: 'Test',
        steps: [makeStep()],
        logoDataUrl: 'data:image/png;base64,logoABC',
      });

      // Should save/restore graphics state around the logo
      expect(mockSaveGraphicsState).toHaveBeenCalled();
      expect(mockRestoreGraphicsState).toHaveBeenCalled();
      // Should set opacity via GState
      expect(mockSetGState).toHaveBeenCalled();
      const gStateArg = mockSetGState.mock.calls[0][0];
      expect(gStateArg.opacity).toBe(0.15);
    });

    it('renders logo on each page after addPage', async () => {
      mockGetImageProperties.mockReturnValue({ width: 800, height: 3000 });

      await generateExportPdf({
        title: 'Test',
        steps: [makeStep(), makeStep({ stepNumber: 2 }), makeStep({ stepNumber: 3 })],
        logoDataUrl: 'data:image/png;base64,logoXYZ',
      });

      const logoCalls = mockAddImage.mock.calls.filter(
        (call) => call[0] === 'data:image/png;base64,logoXYZ',
      );
      expect(logoCalls.length).toBeGreaterThanOrEqual(2);

      mockGetImageProperties.mockReturnValue({ width: 800, height: 600 });
    });

    it('does not add logo when logoDataUrl is undefined', async () => {
      await generateExportPdf({
        title: 'Test',
        steps: [makeStep()],
      });

      const logoCalls = mockAddImage.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('logo'),
      );
      expect(logoCalls).toHaveLength(0);
      expect(mockSaveGraphicsState).not.toHaveBeenCalled();
    });

    it('auto-detects JPEG format for logo', async () => {
      await generateExportPdf({
        title: 'Test',
        steps: [makeStep()],
        logoDataUrl: 'data:image/jpeg;base64,/9j/logo',
      });

      const logoCalls = mockAddImage.mock.calls.filter(
        (call) => call[0] === 'data:image/jpeg;base64,/9j/logo',
      );
      expect(logoCalls.length).toBeGreaterThanOrEqual(1);
      expect(logoCalls[0][1]).toBe('JPEG');
    });
  });

  describe('markdown descriptions in PDF', () => {
    it('renders bold text with bold font', async () => {
      await generateExportPdf({
        title: 'Test',
        steps: [makeStep({ description: '**Bold text**' })],
      });

      expect(mockDoc.setFont).toHaveBeenCalledWith('helvetica', 'bold');
      const textCalls = mockText.mock.calls.map((c: any[]) => c[0]);
      expect(textCalls).toContain('Bold');
      expect(textCalls).toContain('text');
    });

    it('renders colored text with setTextColor', async () => {
      await generateExportPdf({
        title: 'Test',
        steps: [makeStep({ description: '{red}danger{/red}' })],
      });

      // #ef4444 = rgb(239, 68, 68)
      expect(mockSetTextColor).toHaveBeenCalledWith(239, 68, 68);
      const textCalls = mockText.mock.calls.map((c: any[]) => c[0]);
      expect(textCalls).toContain('danger');
    });

    it('renders bullet lines with bullet character', async () => {
      await generateExportPdf({
        title: 'Test',
        steps: [makeStep({ description: '- Bullet item' })],
      });

      const textCalls = mockText.mock.calls.map((c: any[]) => c[0]);
      expect(textCalls).toContain('\u2022');
      expect(textCalls).toContain('Bullet');
      expect(textCalls).toContain('item');
    });

    it('renders plain text identically to before (backward compat)', async () => {
      await generateExportPdf({
        title: 'Test',
        steps: [makeStep({ description: 'Click the button' })],
      });

      const textCalls = mockText.mock.calls.map((c: any[]) => c[0]);
      expect(textCalls).toContain('Click');
      expect(textCalls).toContain('the');
      expect(textCalls).toContain('button');
    });
  });

  it('pushes step to new page when title would orphan from screenshot', async () => {
    // Image at 800x745 → imgHeight=(745/800)*180=167.625mm
    // After title area (~35mm) + step 1 (~193mm), y ≈ 228mm
    // Old static 50mm check: 228+50=278 ≤ 282 → no break → orphan
    // New dynamic check: 228+17.4+40=285.4 > 282 → break → keeps together
    mockGetImageProperties.mockReturnValue({ width: 800, height: 745 });

    const callSequence: string[] = [];
    mockAddPage.mockImplementation(() => { callSequence.push('addPage'); return mockDoc; });
    mockCircle.mockImplementation(() => { callSequence.push('circle'); return mockDoc; });

    await generateExportPdf({
      title: 'Test',
      steps: [makeStep(), makeStep({ stepNumber: 2 })],
    });

    // Step 2's badge (second circle) must appear AFTER an addPage
    const circlePositions = callSequence
      .map((c, i) => c === 'circle' ? i : -1)
      .filter(i => i >= 0);
    expect(circlePositions).toHaveLength(2);

    const addPageIdx = callSequence.indexOf('addPage');
    expect(addPageIdx).toBeGreaterThan(-1);
    expect(addPageIdx).toBeLessThan(circlePositions[1]);

    // Restore mock implementations for subsequent tests
    mockAddPage.mockReturnThis();
    mockCircle.mockReturnThis();
    mockGetImageProperties.mockReturnValue({ width: 800, height: 600 });
  });

  it('truncates long URLs with ellipsis', async () => {
    // Make getTextWidth return a large value to force truncation
    mockGetTextWidth.mockImplementation((text: string) => text.length * 2);

    const longUrl = 'https://example.com/' + 'a'.repeat(200);
    await generateExportPdf({
      title: 'Test',
      steps: [makeStep({ url: longUrl })],
    });

    // The URL text call should end with ellipsis and be shorter than original
    const urlCall = mockText.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].endsWith('\u2026'),
    );
    expect(urlCall).toBeDefined();
    expect(urlCall![0].length).toBeLessThan(longUrl.length);

    mockGetTextWidth.mockImplementation((text: string) => text.length * 0.5);
  });

});
