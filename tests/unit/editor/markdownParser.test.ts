import { describe, it, expect } from 'vitest';
import {
  parseMarkdown,
  stripMarkdown,
  type StyledSegment,
  type ParsedLine,
} from '../../../src/editor/lib/markdownParser';

const DEFAULT_COLOR = '#1e293b';

describe('markdownParser', () => {
  describe('parseMarkdown', () => {
    it('returns empty array for empty string', () => {
      expect(parseMarkdown('')).toEqual([]);
    });

    it('parses plain text as single unstyled segment', () => {
      const result = parseMarkdown('Hello world');
      expect(result).toHaveLength(1);
      expect(result[0].isBullet).toBe(false);
      expect(result[0].segments).toHaveLength(1);
      expect(result[0].segments[0]).toEqual({
        text: 'Hello world',
        bold: false,
        italic: false,
        color: DEFAULT_COLOR,
      });
    });

    it('parses **bold** text', () => {
      const result = parseMarkdown('Click **Save** button');
      expect(result).toHaveLength(1);
      const segs = result[0].segments;
      expect(segs).toHaveLength(3);
      expect(segs[0]).toEqual({ text: 'Click ', bold: false, italic: false, color: DEFAULT_COLOR });
      expect(segs[1]).toEqual({ text: 'Save', bold: true, italic: false, color: DEFAULT_COLOR });
      expect(segs[2]).toEqual({ text: ' button', bold: false, italic: false, color: DEFAULT_COLOR });
    });

    it('parses *italic* text', () => {
      const result = parseMarkdown('This is *important* info');
      const segs = result[0].segments;
      expect(segs).toHaveLength(3);
      expect(segs[1]).toEqual({ text: 'important', bold: false, italic: true, color: DEFAULT_COLOR });
    });

    it('parses ***bold italic*** text', () => {
      const result = parseMarkdown('This is ***critical***');
      const segs = result[0].segments;
      expect(segs).toHaveLength(2);
      expect(segs[1]).toEqual({ text: 'critical', bold: true, italic: true, color: DEFAULT_COLOR });
    });

    it('parses {red}colored{/red} text', () => {
      const result = parseMarkdown('Warning: {red}danger zone{/red}');
      const segs = result[0].segments;
      expect(segs).toHaveLength(2);
      expect(segs[0]).toEqual({ text: 'Warning: ', bold: false, italic: false, color: DEFAULT_COLOR });
      expect(segs[1]).toEqual({ text: 'danger zone', bold: false, italic: false, color: '#ef4444' });
    });

    it('parses {blue}colored{/blue} text', () => {
      const result = parseMarkdown('{blue}info text{/blue}');
      const segs = result[0].segments;
      expect(segs).toHaveLength(1);
      expect(segs[0].color).toBe('#3b82f6');
    });

    it('parses {green}colored{/green} text', () => {
      const result = parseMarkdown('{green}success{/green}');
      const segs = result[0].segments;
      expect(segs).toHaveLength(1);
      expect(segs[0].color).toBe('#22c55e');
    });

    it('parses bold inside color region', () => {
      const result = parseMarkdown('{red}**bold warning**{/red}');
      const segs = result[0].segments;
      expect(segs).toHaveLength(1);
      expect(segs[0]).toEqual({ text: 'bold warning', bold: true, italic: false, color: '#ef4444' });
    });

    it('detects bullet lines', () => {
      const result = parseMarkdown('- First item\n- Second item');
      expect(result).toHaveLength(2);
      expect(result[0].isBullet).toBe(true);
      expect(result[0].segments[0].text).toBe('First item');
      expect(result[1].isBullet).toBe(true);
      expect(result[1].segments[0].text).toBe('Second item');
    });

    it('handles mixed bullets and non-bullets', () => {
      const result = parseMarkdown('Header line\n- Bullet one\n- Bullet two\nFooter');
      expect(result).toHaveLength(4);
      expect(result[0].isBullet).toBe(false);
      expect(result[1].isBullet).toBe(true);
      expect(result[2].isBullet).toBe(true);
      expect(result[3].isBullet).toBe(false);
    });

    it('handles multiple color regions in one line', () => {
      const result = parseMarkdown('{red}error{/red} and {green}success{/green}');
      const segs = result[0].segments;
      expect(segs).toHaveLength(3);
      expect(segs[0].color).toBe('#ef4444');
      expect(segs[1]).toEqual({ text: ' and ', bold: false, italic: false, color: DEFAULT_COLOR });
      expect(segs[2].color).toBe('#22c55e');
    });

    it('handles unmatched markers as literal text', () => {
      const result = parseMarkdown('A single * star');
      const segs = result[0].segments;
      // No matched pair, so the entire line is one unstyled segment
      expect(segs).toHaveLength(1);
      expect(segs[0].text).toBe('A single * star');
      expect(segs[0].bold).toBe(false);
      expect(segs[0].italic).toBe(false);
    });

    it('handles multiline text', () => {
      const result = parseMarkdown('Line one\nLine two\nLine three');
      expect(result).toHaveLength(3);
      expect(result[0].segments[0].text).toBe('Line one');
      expect(result[1].segments[0].text).toBe('Line two');
      expect(result[2].segments[0].text).toBe('Line three');
    });

    it('handles empty lines', () => {
      const result = parseMarkdown('Before\n\nAfter');
      expect(result).toHaveLength(3);
      expect(result[1].segments).toHaveLength(0);
    });

    it('handles bold bullet items', () => {
      const result = parseMarkdown('- **Important** step');
      expect(result[0].isBullet).toBe(true);
      const segs = result[0].segments;
      expect(segs).toHaveLength(2);
      expect(segs[0]).toEqual({ text: 'Important', bold: true, italic: false, color: DEFAULT_COLOR });
      expect(segs[1]).toEqual({ text: ' step', bold: false, italic: false, color: DEFAULT_COLOR });
    });
  });

  describe('stripMarkdown', () => {
    it('returns empty string for empty input', () => {
      expect(stripMarkdown('')).toBe('');
    });

    it('returns plain text unchanged', () => {
      expect(stripMarkdown('Hello world')).toBe('Hello world');
    });

    it('strips bold markers', () => {
      expect(stripMarkdown('Click **Save** button')).toBe('Click Save button');
    });

    it('strips italic markers', () => {
      expect(stripMarkdown('This is *important*')).toBe('This is important');
    });

    it('strips bold-italic markers', () => {
      expect(stripMarkdown('***critical*** info')).toBe('critical info');
    });

    it('strips color markers', () => {
      expect(stripMarkdown('{red}danger{/red}')).toBe('danger');
      expect(stripMarkdown('{blue}info{/blue}')).toBe('info');
      expect(stripMarkdown('{green}ok{/green}')).toBe('ok');
    });

    it('strips all markers from complex text', () => {
      const input = '- **Bold** and {red}*colored italic*{/red} text';
      expect(stripMarkdown(input)).toBe('- Bold and colored italic text');
    });
  });
});
