import { h } from 'preact';
import { useState, useRef } from 'preact/hooks';

export const TIPS = [
  { text: 'Use the <strong>blur tool</strong> to permanently redact personal information' },
  { text: 'Click the <strong>step description</strong> below the canvas to open a rich editor with bold, italic, bullets, and <strong style="color:#fcd34d">{color}</strong> markup' },
  { text: 'Use the <strong>crop tool</strong> to trim screenshots' },
  { text: 'Select the <strong>text tool</strong> and click anywhere to add a label' },
  { text: 'Use the <strong>arrow tool</strong> to draw arrows' },
  { text: 'Select any annotation and press <strong>Delete</strong> to remove it' },
  { text: 'Drag the <strong>grip handle</strong> on step cards to reorder your workflow' },
  { text: 'Click <strong>Export PDF</strong> to generate a shareable guide with all your annotations' },
  { text: 'Use the <strong>rectangle tool</strong> to highlight important areas on screenshots' },
  { text: 'Switch <strong>annotation colors</strong> using the swatches to make different elements stand out' },
  { text: 'Use the <strong>select tool</strong> to move, resize, or edit existing annotations' },
  { text: 'A <strong>click indicator</strong> is automatically placed where you clicked during capture' },
] as const;

interface TipsBannerProps {
  selectedStepId: string | null;
}

const bannerStyle: Record<string, string> = {
  padding: '8px 12px',
  backgroundColor: 'rgba(251, 191, 36, 0.1)',
  borderBottom: '1px solid rgba(251, 191, 36, 0.3)',
  fontSize: '13px',
  color: '#fcd34d',
  display: 'flex',
  alignItems: 'center',
};

export function TipsBanner({ selectedStepId }: TipsBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const indexRef = useRef(0);
  const prevStepRef = useRef<string | null>(null);

  // Cycle on step change (synchronous ref comparison — no flash)
  if (selectedStepId !== prevStepRef.current && prevStepRef.current !== null) {
    indexRef.current = (indexRef.current + 1) % TIPS.length;
  }
  prevStepRef.current = selectedStepId;

  if (dismissed) return null;

  const tip = TIPS[indexRef.current];

  return (
    <div style={bannerStyle} role="status" data-testid="tips-banner">
      <span
        style={{ flex: '1' }}
        dangerouslySetInnerHTML={{ __html: tip.text }}
      />
      <button
        type="button"
        aria-label="Dismiss tip"
        onClick={() => setDismissed(true)}
        style={{
          background: 'none',
          border: 'none',
          color: '#fcd34d',
          cursor: 'pointer',
          fontSize: '16px',
          padding: '0 4px',
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        &times;
      </button>
    </div>
  );
}
