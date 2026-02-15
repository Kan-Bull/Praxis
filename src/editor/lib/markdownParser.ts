// ── Markdown Parser ─────────────────────────────────────────────────
// Tokenizes a markdown string into structured segments for PDF rendering.
// Supports: **bold**, *italic*, ***both***, bullets (- ), and color markers
// ({red}...{/red}, {blue}...{/blue}, {green}...{/green}).

export interface StyledSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  color: string; // hex color
}

export interface ParsedLine {
  segments: StyledSegment[];
  isBullet: boolean;
}

const COLOR_MAP: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
};

const DEFAULT_COLOR = '#1e293b';

// Matches {color}...{/color} regions — non-greedy, handles nesting of bold/italic inside
const COLOR_REGION_RE = /\{(red|blue|green)\}([\s\S]*?)\{\/\1\}/g;

// Matches bold/italic inline markers
const BOLD_ITALIC_RE = /(\*{1,3})((?:(?!\1).)+?)\1/g;

interface ColorRegion {
  start: number;
  end: number;
  color: string;
  innerText: string;
}

/** Parse inline bold/italic markers within a text segment. */
function parseInlineStyles(text: string, baseColor: string): StyledSegment[] {
  const segments: StyledSegment[] = [];
  let lastIndex = 0;

  // Reset regex state
  BOLD_ITALIC_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = BOLD_ITALIC_RE.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      if (before) {
        segments.push({ text: before, bold: false, italic: false, color: baseColor });
      }
    }

    const markers = match[1];
    const content = match[2];
    const bold = markers.length >= 2;
    const italic = markers.length === 1 || markers.length === 3;

    if (content) {
      segments.push({ text: content, bold, italic, color: baseColor });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining) {
      segments.push({ text: remaining, bold: false, italic: false, color: baseColor });
    }
  }

  // If no matches at all, return the whole text as one segment
  if (segments.length === 0 && text) {
    segments.push({ text, bold: false, italic: false, color: baseColor });
  }

  return segments;
}

/** Parse a single line into styled segments, handling color regions and inline styles. */
function parseLine(line: string): StyledSegment[] {
  // Find all color regions
  const regions: ColorRegion[] = [];
  COLOR_REGION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = COLOR_REGION_RE.exec(line)) !== null) {
    regions.push({
      start: match.index,
      end: match.index + match[0].length,
      color: COLOR_MAP[match[1]] ?? DEFAULT_COLOR,
      innerText: match[2],
    });
  }

  if (regions.length === 0) {
    return parseInlineStyles(line, DEFAULT_COLOR);
  }

  const segments: StyledSegment[] = [];
  let cursor = 0;

  for (const region of regions) {
    // Text before this color region (default color)
    if (region.start > cursor) {
      const before = line.slice(cursor, region.start);
      if (before) {
        segments.push(...parseInlineStyles(before, DEFAULT_COLOR));
      }
    }

    // Color region content
    if (region.innerText) {
      segments.push(...parseInlineStyles(region.innerText, region.color));
    }

    cursor = region.end;
  }

  // Text after last color region
  if (cursor < line.length) {
    const after = line.slice(cursor);
    if (after) {
      segments.push(...parseInlineStyles(after, DEFAULT_COLOR));
    }
  }

  return segments;
}

/**
 * Parse a markdown string into structured lines with styled segments.
 * Splits on newlines, detects `- ` bullet prefixes, tokenizes inline styles.
 */
export function parseMarkdown(text: string): ParsedLine[] {
  if (!text) return [];

  const lines = text.split('\n');
  return lines.map((line) => {
    const isBullet = line.startsWith('- ');
    const content = isBullet ? line.slice(2) : line;
    const segments = parseLine(content);
    return { segments, isBullet };
  });
}

/**
 * Strip all markdown markers, returning plain text.
 * Used for StepCard preview where we don't want to show raw markers.
 */
export function stripMarkdown(text: string): string {
  if (!text) return '';

  return text
    // Remove color markers
    .replace(/\{(red|blue|green)\}/g, '')
    .replace(/\{\/(red|blue|green)\}/g, '')
    // Remove bold/italic markers (longest first to avoid partial stripping)
    .replace(/\*{1,3}/g, '');
}
