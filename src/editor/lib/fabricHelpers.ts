import { Rect, IText, Circle, Group, Line, Triangle } from 'fabric';

/** Create an annotation rectangle (stroke only, no fill). */
export function createAnnotationRect(color: string): Rect {
  return new Rect({
    left: 0,
    top: 0,
    width: 100,
    height: 50,
    fill: 'transparent',
    stroke: color,
    strokeWidth: 3,
    strokeUniform: true,
  });
}

/** Create an annotation text object. */
export function createAnnotationText(text: string, color: string): IText {
  return new IText(text, {
    left: 0,
    top: 0,
    fontSize: 18,
    fill: color,
    fontFamily: 'sans-serif',
  });
}

/** Create a numbered step badge (circle + number). */
export function createStepBadge(
  stepNumber: number,
  x: number,
  y: number,
): Group {
  const circle = new Circle({
    radius: 14,
    fill: '#ef4444',
    originX: 'center',
    originY: 'center',
  });

  const label = new IText(String(stepNumber), {
    fontSize: 14,
    fill: '#ffffff',
    fontFamily: 'sans-serif',
    fontWeight: 'bold',
    originX: 'center',
    originY: 'center',
  });

  return new Group([circle, label], {
    left: x,
    top: y,
    selectable: false,
    evented: false,
  });
}

/** Create a click indicator (translucent highlight circle + numbered badge).
 *
 * A semi-transparent purple circle highlights the area around the click
 * point, with a red step-number badge offset above-right so it doesn't
 * obscure the element.
 */
export function createClickIndicator(
  x: number,
  y: number,
  stepNumber: number,
): Group {
  const HIGHLIGHT_RADIUS = 24;
  const BADGE_RADIUS = 10;

  // Highlight circle: translucent purple fill + solid purple stroke
  const highlight = new Circle({
    radius: HIGHLIGHT_RADIUS,
    fill: 'rgba(139, 92, 246, 0.3)',
    stroke: '#8b5cf6',
    strokeWidth: 2,
    originX: 'center',
    originY: 'center',
  });

  // Badge: red circle + white step number, offset above-right
  const badgeCircle = new Circle({
    radius: BADGE_RADIUS,
    fill: '#ef4444',
    originX: 'center',
    originY: 'center',
  });

  const badgeLabel = new IText(String(stepNumber), {
    fontSize: 12,
    fill: '#ffffff',
    fontFamily: 'sans-serif',
    fontWeight: 'bold',
    originX: 'center',
    originY: 'center',
  });

  const badge = new Group([badgeCircle, badgeLabel], {
    left: 20,
    top: -20,
    originX: 'center',
    originY: 'center',
  });

  const group = new Group([highlight, badge], {
    left: x,
    top: y,
    originX: 'center',
    originY: 'center',
    selectable: true,
    evented: true,
  });

  // `data` is not in GroupProps typings but is a standard Fabric.js
  // custom-data property used for identification / serialisation.
  (group as unknown as Record<string, unknown>).data = {
    type: 'click-indicator',
  };

  return group;
}

/** Create an arrow annotation (line shaft + triangle arrowhead). */
export function createArrowAnnotation(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
): Group {
  const line = new Line([fromX, fromY, toX, toY], {
    stroke: color,
    strokeWidth: 3,
    fill: '',
    originX: 'center',
    originY: 'center',
  });

  const angle = Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI) + 90;

  const arrowhead = new Triangle({
    left: toX,
    top: toY,
    width: 12,
    height: 15,
    fill: color,
    angle,
    originX: 'center',
    originY: 'center',
  });

  return new Group([line, arrowhead], {
    selectable: true,
    evented: true,
  });
}
