import { describe, it, expect, vi } from 'vitest';

// Mock Fabric.js module — jsdom has no real canvas
vi.mock('fabric', () => {
  class MockRect {
    type = 'rect';
    constructor(public opts: Record<string, unknown>) {}
  }
  class MockIText {
    type = 'i-text';
    constructor(
      public text: string,
      public opts: Record<string, unknown>,
    ) {}
  }
  class MockCircle {
    type = 'circle';
    constructor(public opts: Record<string, unknown>) {}
  }
  class MockGroup {
    type = 'group';
    constructor(
      public objects: unknown[],
      public opts: Record<string, unknown>,
    ) {}
  }
  class MockLine {
    type = 'line';
    constructor(public points: number[], public opts: Record<string, unknown>) {}
  }
  class MockTriangle {
    type = 'triangle';
    constructor(public opts: Record<string, unknown>) {}
  }
  return {
    Rect: MockRect,
    IText: MockIText,
    Circle: MockCircle,
    Group: MockGroup,
    Line: MockLine,
    Triangle: MockTriangle,
  };
});

import {
  createAnnotationRect,
  createAnnotationText,
  createStepBadge,
  createClickIndicator,
  createArrowAnnotation,
} from '../../../src/editor/lib/fabricHelpers';

describe('fabricHelpers', () => {
  describe('createAnnotationRect', () => {
    it('creates a rect with the given stroke color and transparent fill', () => {
      const rect = createAnnotationRect('#ef4444') as unknown as { type: string; opts: Record<string, unknown> };
      expect(rect.type).toBe('rect');
      expect(rect.opts.stroke).toBe('#ef4444');
      expect(rect.opts.fill).toBe('transparent');
      expect(rect.opts.strokeWidth).toBe(3);
    });
  });

  describe('createAnnotationText', () => {
    it('creates an IText with text and color', () => {
      const text = createAnnotationText('Hello', '#3b82f6') as unknown as { type: string; text: string; opts: Record<string, unknown> };
      expect(text.type).toBe('i-text');
      expect(text.text).toBe('Hello');
      expect(text.opts.fill).toBe('#3b82f6');
      expect(text.opts.fontSize).toBe(18);
    });
  });

  describe('createStepBadge', () => {
    it('creates a group with circle and label at position', () => {
      const badge = createStepBadge(3, 50, 100) as unknown as {
        type: string;
        objects: Array<{ type: string; opts: Record<string, unknown>; text?: string }>;
        opts: Record<string, unknown>;
      };
      expect(badge.type).toBe('group');
      expect(badge.objects).toHaveLength(2);
      expect(badge.objects[0].type).toBe('circle');
      expect(badge.objects[1].type).toBe('i-text');
      expect(badge.objects[1].text).toBe('3');
      expect(badge.opts.left).toBe(50);
      expect(badge.opts.top).toBe(100);
    });

    it('creates non-selectable badge', () => {
      const badge = createStepBadge(1, 0, 0) as unknown as { opts: Record<string, unknown> };
      expect(badge.opts.selectable).toBe(false);
      expect(badge.opts.evented).toBe(false);
    });
  });

  describe('createClickIndicator', () => {
    it('returns a Fabric.js Group object', () => {
      const indicator = createClickIndicator(100, 200, 1) as unknown as { type: string };
      expect(indicator.type).toBe('group');
    });

    it('group is positioned at the given (x, y) coordinates with center origin', () => {
      const indicator = createClickIndicator(150, 250, 2) as unknown as { opts: Record<string, unknown> };
      expect(indicator.opts.left).toBe(150);
      expect(indicator.opts.top).toBe(250);
      expect(indicator.opts.originX).toBe('center');
      expect(indicator.opts.originY).toBe('center');
    });

    it('group contains expected sub-objects (highlight circle, badge)', () => {
      const indicator = createClickIndicator(100, 200, 3) as unknown as {
        objects: Array<{ type: string }>;
      };
      // Should contain: highlight circle, badge (group with circle + text)
      expect(indicator.objects).toHaveLength(2);
      expect(indicator.objects[0].type).toBe('circle');
      expect(indicator.objects[1].type).toBe('group');
    });

    it('group has data property with { type: "click-indicator" } for identification', () => {
      const indicator = createClickIndicator(100, 200, 1) as unknown as { data: Record<string, unknown> };
      expect(indicator.data).toEqual({ type: 'click-indicator' });
    });

    it('group is selectable and evented', () => {
      const indicator = createClickIndicator(100, 200, 1) as unknown as { opts: Record<string, unknown> };
      expect(indicator.opts.selectable).toBe(true);
      expect(indicator.opts.evented).toBe(true);
    });

    it('step number badge displays the correct number', () => {
      const indicator = createClickIndicator(100, 200, 5) as unknown as {
        objects: Array<{
          type: string;
          objects?: Array<{ type: string; text?: string }>;
        }>;
      };
      // The badge is the 2nd object (index 1), which is a group containing [circle, text]
      const badge = indicator.objects[1];
      expect(badge.type).toBe('group');
      expect(badge.objects).toBeDefined();
      expect(badge.objects!).toHaveLength(2);
      // The text element in the badge should have the step number
      const labelObj = badge.objects![1];
      expect(labelObj.type).toBe('i-text');
      expect(labelObj.text).toBe('5');
    });
  });

  describe('createArrowAnnotation', () => {
    it('returns a Group containing a Line and a Triangle', () => {
      const arrow = createArrowAnnotation(0, 0, 100, 0, '#ef4444') as unknown as {
        type: string;
        objects: Array<{ type: string }>;
      };
      expect(arrow.type).toBe('group');
      expect(arrow.objects).toHaveLength(2);
      expect(arrow.objects[0].type).toBe('line');
      expect(arrow.objects[1].type).toBe('triangle');
    });

    it('Line uses the given start/end coordinates', () => {
      const arrow = createArrowAnnotation(10, 20, 110, 120, '#ef4444') as unknown as {
        objects: Array<{ points?: number[] }>;
      };
      expect(arrow.objects[0].points).toEqual([10, 20, 110, 120]);
    });

    it('Line and Triangle use the given color', () => {
      const color = '#3b82f6';
      const arrow = createArrowAnnotation(0, 0, 100, 50, color) as unknown as {
        objects: Array<{ opts: Record<string, unknown> }>;
      };
      expect(arrow.objects[0].opts.stroke).toBe(color);
      expect(arrow.objects[1].opts.fill).toBe(color);
    });

    it('Triangle is rotated to match the line angle for a horizontal arrow', () => {
      const arrow = createArrowAnnotation(0, 0, 100, 0, '#ef4444') as unknown as {
        objects: Array<{ opts: Record<string, unknown> }>;
      };
      // Fabric Triangle points up by default, so horizontal-right = atan2(0,100)=0 + 90 = 90
      expect(arrow.objects[1].opts.angle).toBe(90);
    });

    it('Group is selectable and evented', () => {
      const arrow = createArrowAnnotation(0, 0, 100, 0, '#ef4444') as unknown as {
        opts: Record<string, unknown>;
      };
      expect(arrow.opts.selectable).toBe(true);
      expect(arrow.opts.evented).toBe(true);
    });
  });
});
