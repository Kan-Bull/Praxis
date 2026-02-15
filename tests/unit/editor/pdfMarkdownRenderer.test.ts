import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderMarkdownBlock } from '../../../src/editor/lib/pdfMarkdownRenderer';
import type { ParsedLine } from '../../../src/editor/lib/markdownParser';

// Mock jsPDF doc
function createMockDoc() {
  return {
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    getTextWidth: vi.fn((text: string) => text.length * 1.5), // ~1.5mm per char
    text: vi.fn(),
  };
}

describe('pdfMarkdownRenderer', () => {
  let mockDoc: ReturnType<typeof createMockDoc>;

  beforeEach(() => {
    mockDoc = createMockDoc();
  });

  it('returns starting y for empty lines array', () => {
    const finalY = renderMarkdownBlock(mockDoc as any, [], 15, 50, 180, 11);
    expect(finalY).toBe(50);
    expect(mockDoc.text).not.toHaveBeenCalled();
  });

  it('renders plain text segment', () => {
    const lines: ParsedLine[] = [
      {
        isBullet: false,
        segments: [{ text: 'Hello world', bold: false, italic: false, color: '#1e293b' }],
      },
    ];

    const finalY = renderMarkdownBlock(mockDoc as any, lines, 15, 50, 180, 11);

    expect(mockDoc.text).toHaveBeenCalledWith('Hello', expect.any(Number), expect.any(Number));
    expect(mockDoc.text).toHaveBeenCalledWith('world', expect.any(Number), expect.any(Number));
    expect(mockDoc.setFont).toHaveBeenCalledWith('helvetica', 'normal');
    expect(finalY).toBeGreaterThan(50);
  });

  it('sets bold font for bold segments', () => {
    const lines: ParsedLine[] = [
      {
        isBullet: false,
        segments: [{ text: 'Bold text', bold: true, italic: false, color: '#1e293b' }],
      },
    ];

    renderMarkdownBlock(mockDoc as any, lines, 15, 50, 180, 11);

    expect(mockDoc.setFont).toHaveBeenCalledWith('helvetica', 'bold');
  });

  it('sets italic font for italic segments', () => {
    const lines: ParsedLine[] = [
      {
        isBullet: false,
        segments: [{ text: 'Italic text', bold: false, italic: true, color: '#1e293b' }],
      },
    ];

    renderMarkdownBlock(mockDoc as any, lines, 15, 50, 180, 11);

    expect(mockDoc.setFont).toHaveBeenCalledWith('helvetica', 'italic');
  });

  it('sets bolditalic font for bold+italic segments', () => {
    const lines: ParsedLine[] = [
      {
        isBullet: false,
        segments: [{ text: 'Both', bold: true, italic: true, color: '#1e293b' }],
      },
    ];

    renderMarkdownBlock(mockDoc as any, lines, 15, 50, 180, 11);

    expect(mockDoc.setFont).toHaveBeenCalledWith('helvetica', 'bolditalic');
  });

  it('sets text color from segment color', () => {
    const lines: ParsedLine[] = [
      {
        isBullet: false,
        segments: [{ text: 'Red text', bold: false, italic: false, color: '#ef4444' }],
      },
    ];

    renderMarkdownBlock(mockDoc as any, lines, 15, 50, 180, 11);

    // #ef4444 = rgb(239, 68, 68)
    expect(mockDoc.setTextColor).toHaveBeenCalledWith(239, 68, 68);
  });

  it('renders bullet character for bullet lines', () => {
    const lines: ParsedLine[] = [
      {
        isBullet: true,
        segments: [{ text: 'Item one', bold: false, italic: false, color: '#1e293b' }],
      },
    ];

    renderMarkdownBlock(mockDoc as any, lines, 15, 50, 180, 11);

    // Should render bullet char '\u2022'
    expect(mockDoc.text).toHaveBeenCalledWith('\u2022', 16, 50);
    // Item text should be indented (x + 4mm for bullet indent)
    const itemCalls = mockDoc.text.mock.calls.filter(
      (call: any[]) => call[0] === 'Item' || call[0] === 'one',
    );
    expect(itemCalls.length).toBe(2);
    // First word should start at x + BULLET_INDENT = 15 + 4 = 19
    expect(itemCalls[0][1]).toBe(19);
  });

  it('advances y for empty lines', () => {
    const lines: ParsedLine[] = [
      {
        isBullet: false,
        segments: [{ text: 'Before', bold: false, italic: false, color: '#1e293b' }],
      },
      { isBullet: false, segments: [] },
      {
        isBullet: false,
        segments: [{ text: 'After', bold: false, italic: false, color: '#1e293b' }],
      },
    ];

    const finalY = renderMarkdownBlock(mockDoc as any, lines, 15, 50, 180, 11);

    // Should have advanced past 3 lines worth of height
    // lineHeight = 11 * 1.4 * 0.3528 ≈ 5.43
    expect(finalY).toBeGreaterThan(50 + 5 * 3);
  });

  it('wraps long text to next line when exceeding maxWidth', () => {
    // Make text measurement return large values to force wrapping
    mockDoc.getTextWidth.mockImplementation((text: string) => text.length * 10);

    const lines: ParsedLine[] = [
      {
        isBullet: false,
        segments: [
          {
            text: 'This is a very long line that should wrap',
            bold: false,
            italic: false,
            color: '#1e293b',
          },
        ],
      },
    ];

    const finalY = renderMarkdownBlock(mockDoc as any, lines, 15, 50, 100, 11);

    // With 100mm max width and ~10mm per char, words will wrap frequently
    // Final y should be well past the starting point
    expect(finalY).toBeGreaterThan(55);
  });

  it('renders multiple segments with different styles on one line', () => {
    const lines: ParsedLine[] = [
      {
        isBullet: false,
        segments: [
          { text: 'Normal ', bold: false, italic: false, color: '#1e293b' },
          { text: 'bold ', bold: true, italic: false, color: '#1e293b' },
          { text: 'red', bold: false, italic: false, color: '#ef4444' },
        ],
      },
    ];

    renderMarkdownBlock(mockDoc as any, lines, 15, 50, 180, 11);

    // Should switch fonts between segments
    expect(mockDoc.setFont).toHaveBeenCalledWith('helvetica', 'normal');
    expect(mockDoc.setFont).toHaveBeenCalledWith('helvetica', 'bold');
    // Should switch colors
    expect(mockDoc.setTextColor).toHaveBeenCalledWith(239, 68, 68);
  });
});
