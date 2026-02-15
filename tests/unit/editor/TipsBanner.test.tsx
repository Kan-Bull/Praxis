import { describe, it, expect } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { TipsBanner, TIPS } from '../../../src/editor/components/TipsBanner';

// Plain-text snippets for each tip (avoids comparing HTML source vs textContent)
const SNIPPETS = [
  'blur tool',
  'step description',
  'crop tool',
  'text tool',
  'arrow tool',
  'Delete',
  'grip handle',
  'Export PDF',
  'rectangle tool',
  'annotation colors',
  'select tool',
  'click indicator',
];

describe('TipsBanner', () => {
  it('renders first tip (blur tool) on initial render', () => {
    const { container } = render(<TipsBanner selectedStepId="step-1" />);
    expect(container.textContent).toContain(SNIPPETS[0]);
  });

  it('cycles to next tip on step change', () => {
    const { container, rerender } = render(<TipsBanner selectedStepId="step-1" />);
    expect(container.textContent).toContain(SNIPPETS[0]);

    rerender(<TipsBanner selectedStepId="step-2" />);
    expect(container.textContent).toContain(SNIPPETS[1]);
  });

  it('wraps around after cycling through all tips', () => {
    const { container, rerender } = render(<TipsBanner selectedStepId="s-0" />);
    // Cycle through all tips
    for (let i = 1; i <= TIPS.length; i++) {
      rerender(<TipsBanner selectedStepId={`s-${i}`} />);
    }
    // Should wrap back to first tip
    expect(container.textContent).toContain(SNIPPETS[0]);
  });

  it('does not cycle when same stepId re-renders', () => {
    const { container, rerender } = render(<TipsBanner selectedStepId="step-1" />);
    expect(container.textContent).toContain(SNIPPETS[0]);

    rerender(<TipsBanner selectedStepId="step-1" />);
    expect(container.textContent).toContain(SNIPPETS[0]);
  });

  it('dismisses on X button click and returns null', () => {
    const { container, getByLabelText } = render(<TipsBanner selectedStepId="step-1" />);
    fireEvent.click(getByLabelText('Dismiss tip'));
    expect(container.innerHTML).toBe('');
  });

  it('stays dismissed across subsequent step changes', () => {
    const { container, getByLabelText, rerender } = render(<TipsBanner selectedStepId="step-1" />);
    fireEvent.click(getByLabelText('Dismiss tip'));
    rerender(<TipsBanner selectedStepId="step-2" />);
    expect(container.innerHTML).toBe('');
  });

  it('TIPS array has expected length (12)', () => {
    expect(TIPS).toHaveLength(12);
  });

  it('renders with selectedStepId=null (shows first tip)', () => {
    const { container } = render(<TipsBanner selectedStepId={null} />);
    expect(container.textContent).toContain(SNIPPETS[0]);
  });
});
