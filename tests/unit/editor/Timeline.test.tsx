import { describe, it, expect, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { Timeline } from '../../../src/editor/components/Timeline';
import type { CaptureStep } from '../../../src/shared/types';

function makeStep(id: string, num: number, desc: string): CaptureStep {
  return {
    id,
    stepNumber: num,
    description: desc,
    screenshotDataUrl: '',
    element: {
      tagName: 'BUTTON',
      boundingRect: { x: 0, y: 0, width: 100, height: 40, top: 0, right: 100, bottom: 40, left: 0 },
      isInIframe: false,
    },
    interaction: {
      type: 'click',
      timestamp: 1000,
      url: 'https://example.com',
      element: {
        tagName: 'BUTTON',
        boundingRect: { x: 0, y: 0, width: 100, height: 40, top: 0, right: 100, bottom: 40, left: 0 },
        isInIframe: false,
      },
    },
    timestamp: 1000,
    url: 'https://example.com',
  };
}

describe('Timeline', () => {
  it('renders all steps', () => {
    const steps = [
      makeStep('s1', 1, 'Step one'),
      makeStep('s2', 2, 'Step two'),
      makeStep('s3', 3, 'Step three'),
    ];
    const { getByText } = render(
      <Timeline steps={steps} selectedStepId={null} onSelectStep={() => {}} onDeleteStep={() => {}} onReorderStep={() => {}} />,
    );
    expect(getByText('Step one')).toBeTruthy();
    expect(getByText('Step two')).toBeTruthy();
    expect(getByText('Step three')).toBeTruthy();
  });

  it('shows empty state when no steps', () => {
    const { getByTestId } = render(
      <Timeline steps={[]} selectedStepId={null} onSelectStep={() => {}} onDeleteStep={() => {}} onReorderStep={() => {}} />,
    );
    expect(getByTestId('empty-timeline').textContent).toContain('No steps');
  });

  it('calls onSelectStep when a step is clicked', () => {
    const onSelect = vi.fn();
    const steps = [makeStep('s1', 1, 'Step one')];
    const { getByTestId } = render(
      <Timeline steps={steps} selectedStepId={null} onSelectStep={onSelect} onDeleteStep={() => {}} onReorderStep={() => {}} />,
    );
    fireEvent.click(getByTestId('step-card-s1'));
    expect(onSelect).toHaveBeenCalledWith('s1');
  });

  it('calls onDeleteStep when step delete button clicked', () => {
    const onDelete = vi.fn();
    const steps = [makeStep('s1', 1, 'Step one')];
    const { getByTestId } = render(
      <Timeline steps={steps} selectedStepId={null} onSelectStep={() => {}} onDeleteStep={onDelete} onReorderStep={() => {}} />,
    );
    fireEvent.click(getByTestId('delete-step-s1'));
    expect(onDelete).toHaveBeenCalledWith('s1');
  });

  it('passes selectedStepId to StepCard', () => {
    const steps = [makeStep('s1', 1, 'Step one'), makeStep('s2', 2, 'Step two')];
    const { getByTestId } = render(
      <Timeline steps={steps} selectedStepId="s1" onSelectStep={() => {}} onDeleteStep={() => {}} onReorderStep={() => {}} />,
    );
    // Selected card gets blue border styling
    const selected = getByTestId('step-card-s1');
    const unselected = getByTestId('step-card-s2');
    // Selected has different border than unselected
    expect(selected.style.border).not.toBe(unselected.style.border);
  });

  it('renders drag handles for each step', () => {
    const steps = [makeStep('s1', 1, 'Step one'), makeStep('s2', 2, 'Step two')];
    const { getByTestId } = render(
      <Timeline steps={steps} selectedStepId={null} onSelectStep={() => {}} onDeleteStep={() => {}} onReorderStep={() => {}} />,
    );
    expect(getByTestId('drag-handle-s1')).toBeTruthy();
    expect(getByTestId('drag-handle-s2')).toBeTruthy();
  });

  it('calls onReorderStep on drag and drop', () => {
    const onReorder = vi.fn();
    const steps = [
      makeStep('s1', 1, 'Step one'),
      makeStep('s2', 2, 'Step two'),
      makeStep('s3', 3, 'Step three'),
    ];
    const { getByTestId, container } = render(
      <Timeline steps={steps} selectedStepId={null} onSelectStep={() => {}} onDeleteStep={() => {}} onReorderStep={onReorder} />,
    );

    // Start dragging step 1 (index 0)
    const handle = getByTestId('drag-handle-s1');
    fireEvent.dragStart(handle, {
      dataTransfer: { effectAllowed: '', setData: vi.fn() },
    });

    // Drag over step 3 (index 2) — simulate mouse below midpoint to get dropTargetIndex=3
    const stepCards = container.querySelectorAll('[data-testid^="step-card-"]');
    const step3Wrapper = stepCards[2].parentElement!;
    // Mock getBoundingClientRect for the drag-over target
    const mockRect = { top: 100, height: 50, left: 0, right: 200, bottom: 150, width: 200, x: 0, y: 100, toJSON: () => ({}) };
    vi.spyOn(step3Wrapper, 'getBoundingClientRect').mockReturnValue(mockRect);
    fireEvent.dragOver(step3Wrapper, { clientY: 140, dataTransfer: { dropEffect: '' } });

    // Drop on the scroll container
    const scrollContainer = container.querySelector('[style*="overflow"]') as HTMLElement;
    fireEvent.drop(scrollContainer, { dataTransfer: {} });

    expect(onReorder).toHaveBeenCalledWith(0, 2);
  });
});
