// ── PDF Markdown Renderer ───────────────────────────────────────────
// Renders ParsedLine[] to jsPDF with font switching and word-wrapping.

import type { jsPDF } from 'jspdf';
import type { ParsedLine, StyledSegment } from './markdownParser';

const BULLET_CHAR = '\u2022';
const BULLET_INDENT = 4; // mm
const LINE_HEIGHT_FACTOR = 1.4; // multiplier on fontSize for line spacing

/** Determine jsPDF font style string from bold/italic flags. */
function fontStyle(bold: boolean, italic: boolean): string {
  if (bold && italic) return 'bolditalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
}

/** Convert hex color string to RGB tuple. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

interface Word {
  text: string;
  bold: boolean;
  italic: boolean;
  color: string;
  trailingSpace: boolean;
}

/** Break segments into individual words, preserving style info. */
function segmentsToWords(segments: StyledSegment[]): Word[] {
  const words: Word[] = [];
  for (const seg of segments) {
    const parts = seg.text.split(/( +)/);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      // A run of spaces is trailing on the previous word, or leading whitespace
      if (/^ +$/.test(part)) {
        if (words.length > 0) {
          words[words.length - 1].trailingSpace = true;
        }
        continue;
      }
      words.push({
        text: part,
        bold: seg.bold,
        italic: seg.italic,
        color: seg.color,
        trailingSpace: false,
      });
    }
  }
  // Last word in a segment that ends before another segment should have trailing space
  // Already handled by the split logic above
  return words;
}

/**
 * Render markdown lines to a jsPDF document.
 *
 * @param doc - jsPDF document instance
 * @param lines - Parsed markdown lines from parseMarkdown()
 * @param x - Left margin x coordinate (mm)
 * @param y - Starting y coordinate (mm)
 * @param maxWidth - Maximum text width (mm)
 * @param fontSize - Font size in points
 * @returns Final y position after rendering
 */
export function renderMarkdownBlock(
  doc: jsPDF,
  lines: ParsedLine[],
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
): number {
  const lineHeight = fontSize * LINE_HEIGHT_FACTOR * 0.3528; // pt to mm approx

  doc.setFontSize(fontSize);

  for (const line of lines) {
    if (line.segments.length === 0) {
      // Empty line — just advance y
      y += lineHeight;
      continue;
    }

    const indent = line.isBullet ? BULLET_INDENT : 0;
    const textX = x + indent;
    const textMaxWidth = maxWidth - indent;

    // Render bullet character
    if (line.isBullet) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...hexToRgb(line.segments[0]?.color ?? '#1e293b'));
      doc.text(BULLET_CHAR, x + 1, y);
    }

    // Break segments into words for wrapping
    const words = segmentsToWords(line.segments);
    if (words.length === 0) {
      y += lineHeight;
      continue;
    }

    let cursorX = textX;
    let isFirstWordOnLine = true;

    for (const word of words) {
      // Apply font style for measurement
      doc.setFont('helvetica', fontStyle(word.bold, word.italic));
      doc.setFontSize(fontSize);
      const wordWidth = doc.getTextWidth(word.text);
      const spaceWidth = word.trailingSpace ? doc.getTextWidth(' ') : 0;

      // Check if word fits on current line
      if (!isFirstWordOnLine && cursorX + wordWidth > textX + textMaxWidth) {
        // Wrap to next line
        y += lineHeight;
        cursorX = textX;
        isFirstWordOnLine = true;
      }

      // Set color and render word
      doc.setTextColor(...hexToRgb(word.color));
      doc.text(word.text, cursorX, y);
      cursorX += wordWidth + spaceWidth;
      isFirstWordOnLine = false;
    }

    y += lineHeight;
  }

  return y;
}
