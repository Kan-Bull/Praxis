import { jsPDF } from 'jspdf';
import { parseMarkdown } from './markdownParser';
import { renderMarkdownBlock } from './pdfMarkdownRenderer';

export interface PdfExportStep {
  stepNumber: number;
  description: string;
  screenshotDataUrl: string;
  url: string;
}

export interface PdfExportOptions {
  title: string;
  steps: PdfExportStep[];
  logoDataUrl?: string;
  author?: string;
  date?: string;
  pageSize?: 'a4' | 'letter';
  includeUrls?: boolean;
}

// Layout constants (mm)
const MARGIN = 15;
const STEP_SPACING = 8;
const BADGE_RADIUS = 4;
// MIN_IMAGE_PEEK removed — keep-together now uses actual image height

// Colors
const TITLE_COLOR = '#1e293b';
const BODY_COLOR = '#1e293b';
const URL_COLOR = '#64748b';
const BADGE_COLOR = '#3b82f6';
const RULE_COLOR = '#e2e8f0';

const LOGO_TARGET_WIDTH = 15; // mm

// Badge gradient colors (matches StepCard: linear-gradient(135deg, #3b82f6, #8b5cf6))
const BADGE_GRADIENT_START = '#3b82f6';
const BADGE_GRADIENT_END = '#8b5cf6';

/** Render a gradient badge circle with step number as a PNG data URL.
 *  Returns null when canvas is unavailable (e.g. jsdom test environment). */
function renderGradientBadge(stepNumber: number, sizePx = 64): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = sizePx;
    canvas.height = sizePx;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const r = sizePx / 2;
    // 135deg: top-left → bottom-right
    const grad = ctx.createLinearGradient(0, 0, sizePx, sizePx);
    grad.addColorStop(0, BADGE_GRADIENT_START);
    grad.addColorStop(1, BADGE_GRADIENT_END);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();

    // White number centered
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(sizePx * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(stepNumber), r, r);

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
const LOGO_OPACITY = 0.15;

/** Derive page dimensions from format. */
function pageDimensions(format: 'a4' | 'letter'): { width: number; height: number } {
  if (format === 'letter') {
    return { width: 215.9, height: 279.4 };
  }
  return { width: 210, height: 297 };
}

/** Render a semi-transparent logo watermark in the bottom-right corner of the current page. */
function addLogoWatermark(
  doc: jsPDF,
  logoDataUrl: string,
  pageWidth: number,
  pageHeight: number,
): void {
  const imgProps = doc.getImageProperties(logoDataUrl);
  const aspect = imgProps.height / imgProps.width;
  const logoWidth = LOGO_TARGET_WIDTH;
  const logoHeight = logoWidth * aspect;
  const format = logoDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
  const x = pageWidth - MARGIN - logoWidth;
  const y = pageHeight - MARGIN - logoHeight;

  // Render at low opacity so it acts as a subtle watermark
  (doc as any).saveGraphicsState();
  (doc as any).setGState(new (doc as any).GState({ opacity: LOGO_OPACITY }));
  doc.addImage(logoDataUrl, format, x, y, logoWidth, logoHeight);
  (doc as any).restoreGraphicsState();
}

/** Estimate the vertical space (mm) the step header (badge + description + URL) will occupy. */
function estimateStepHeaderHeight(
  doc: jsPDF,
  step: PdfExportStep,
  maxDescWidth: number,
  includeUrls: boolean,
): number {
  let h = BADGE_RADIUS * 2;
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(step.description, maxDescWidth);
  const lineHeight = 11 * 1.4 * 0.3528; // fontSize * lineHeightFactor * pt→mm
  const textOffset = BADGE_RADIUS + 11 * 0.3528 * 0.35;
  h = Math.max(h, textOffset + lines.length * lineHeight + 2);
  if (includeUrls) {
    h += 6;
  }
  return h;
}

/**
 * Generate a PDF blob from export options.
 * Uses jsPDF for client-side PDF generation.
 */
export async function generateExportPdf(
  options: PdfExportOptions,
): Promise<Blob> {
  const format = options.pageSize ?? 'a4';
  const { width: PAGE_WIDTH, height: PAGE_HEIGHT } = pageDimensions(format);
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format,
  });

  let y = MARGIN;

  // ── Title ───────────────────────────────────────────────────────
  doc.setFontSize(20);
  doc.setTextColor(TITLE_COLOR);
  doc.text(options.title, MARGIN, y + 7); // baseline offset for 20pt
  y += 12;

  // ── Author / Date subtitle ────────────────────────────────────
  const subtitleParts: string[] = [];
  if (options.author) subtitleParts.push(options.author);
  if (options.date) subtitleParts.push(options.date);
  if (subtitleParts.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(URL_COLOR);
    doc.text(subtitleParts.join(' \u2014 '), MARGIN, y + 4);
    y += 6;
  }

  // Horizontal rule
  doc.setDrawColor(RULE_COLOR);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
  y += 8;

  // Logo watermark on first page
  if (options.logoDataUrl) {
    addLogoWatermark(doc, options.logoDataUrl, PAGE_WIDTH, PAGE_HEIGHT);
  }

  // ── Steps ───────────────────────────────────────────────────────
  for (const step of options.steps) {
    // Compute layout values needed for page break estimation
    const textX = MARGIN + BADGE_RADIUS * 2 + 4;
    const maxDescWidth = CONTENT_WIDTH - BADGE_RADIUS * 2 - 4;
    const headerH = estimateStepHeaderHeight(doc, step, maxDescWidth, options.includeUrls !== false);

    // Pre-compute image dimensions for keep-together check
    let imgHeight = 0;
    let imgWidth = CONTENT_WIDTH;
    let imgFormat = 'PNG';
    if (step.screenshotDataUrl) {
      const imgProps = doc.getImageProperties(step.screenshotDataUrl);
      imgHeight = (imgProps.height / imgProps.width) * imgWidth;
      imgFormat = step.screenshotDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
    }

    // Keep-together: if header + image won't fit, push entire step to new page.
    // This prevents orphaned titles where the title renders at the bottom of one
    // page and the image gets pushed to the next by the overflow check.
    // The 10mm buffer must match the image overflow safety margin below,
    // otherwise the two checks can disagree — keep-together says "fits",
    // but image overflow says "nope" and pushes the image to the next page.
    const remainingSpace = PAGE_HEIGHT - MARGIN - y;
    if (headerH + imgHeight > remainingSpace - 10 && y > MARGIN) {
      doc.addPage();
      y = MARGIN;
      if (options.logoDataUrl) {
        addLogoWatermark(doc, options.logoDataUrl, PAGE_WIDTH, PAGE_HEIGHT);
      }
    }

    // Step badge (gradient circle with number — matches editor UI)
    const badgeDiameter = BADGE_RADIUS * 2;
    const badgeDataUrl = renderGradientBadge(step.stepNumber);
    if (badgeDataUrl) {
      doc.addImage(badgeDataUrl, 'PNG', MARGIN, y, badgeDiameter, badgeDiameter);
    } else {
      // Fallback: flat circle (test environment or no canvas)
      const badgeCenterX = MARGIN + BADGE_RADIUS;
      const badgeCenterY = y + BADGE_RADIUS;
      doc.setFillColor(BADGE_COLOR);
      doc.circle(badgeCenterX, badgeCenterY, BADGE_RADIUS, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#ffffff');
      doc.text(String(step.stepNumber), badgeCenterX, badgeCenterY + 1, { align: 'center' });
    }
    const parsed = parseMarkdown(step.description);
    // Vertically center first line of text with the badge circle.
    // Badge center = y + BADGE_RADIUS. For 11pt text the cap-height is
    // ~2.8mm above baseline, so baseline ≈ badgeCenter + capHeight/2.
    const textBaselineY = y + BADGE_RADIUS + (11 * 0.3528 * 0.35);
    y = renderMarkdownBlock(doc, parsed, textX, textBaselineY, maxDescWidth, 11);
    y += 2;

    // URL (conditional — omit when includeUrls is explicitly false)
    if (options.includeUrls !== false) {
      doc.setFontSize(9);
      doc.setTextColor(URL_COLOR);
      const maxUrlWidth = CONTENT_WIDTH - (textX - MARGIN);
      let displayUrl = step.url;
      while (displayUrl.length > 10 && doc.getTextWidth(displayUrl) > maxUrlWidth) {
        displayUrl = displayUrl.slice(0, -1);
      }
      if (displayUrl !== step.url) {
        displayUrl += '\u2026'; // ellipsis
      }
      doc.text(displayUrl, textX, y);
      y += 6;
    }

    // Screenshot (dimensions already computed above for keep-together)
    if (step.screenshotDataUrl) {
      // Image overflow: handles images taller than a full page
      if (y + imgHeight > PAGE_HEIGHT - MARGIN - 10) {
        doc.addPage();
        y = MARGIN;
        if (options.logoDataUrl) {
          addLogoWatermark(doc, options.logoDataUrl, PAGE_WIDTH, PAGE_HEIGHT);
        }
      }

      doc.addImage(
        step.screenshotDataUrl,
        imgFormat,
        MARGIN,
        y,
        imgWidth,
        imgHeight,
      );

      // Click indicators are already composited into the screenshot image
      // by the Fabric.js annotation layer (via canvasFlattener) before
      // the PDF is generated — no need to draw them again here.

      y += imgHeight;
    }

    y += STEP_SPACING;
  }

  // Produce Blob
  const arrayBuffer = doc.output('arraybuffer');
  return new Blob([arrayBuffer], { type: 'application/pdf' });
}
