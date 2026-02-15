import { describe, it, expect, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { StepCard } from '../../../src/editor/components/StepCard';
import type { CaptureStep } from '../../../src/shared/types';

function makeStep(overrides: Partial<CaptureStep> = {}): CaptureStep {
  return {
    id: 'step-1',
    stepNumber: 1,
    description: 'Clicked the button',
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
    ...overrides,
  };
}

const defaultDragProps = {
  index: 0,
  onDragStart: () => {},
  onDragEnd: () => {},
};

describe('StepCard', () => {
  it('renders step number and description', () => {
    const { getByTestId, getByText } = render(
      <StepCard step={makeStep()} isSelected={false} onSelect={() => {}} onDelete={() => {}} {...defaultDragProps} />,
    );
    expect(getByTestId('step-number').textContent).toBe('1');
    expect(getByText('Clicked the button')).toBeTruthy();
  });

  it('shows thumbnail when available', () => {
    const step = makeStep({ thumbnailDataUrl: 'data:image/png;base64,thumb' });
    const { container } = render(
      <StepCard step={step} isSelected={false} onSelect={() => {}} onDelete={() => {}} {...defaultDragProps} />,
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.src).toContain('data:image/png;base64,thumb');
  });

  it('highlights when selected', () => {
    const { getByTestId } = render(
      <StepCard step={makeStep()} isSelected={true} onSelect={() => {}} onDelete={() => {}} {...defaultDragProps} />,
    );
    const card = getByTestId('step-card-step-1');
    expect(card.style.borderColor || card.style.border).toBeTruthy();
  });

  it('calls onSelect with step id when clicked', () => {
    const onSelect = vi.fn();
    const { getByTestId } = render(
      <StepCard step={makeStep()} isSelected={false} onSelect={onSelect} onDelete={() => {}} {...defaultDragProps} />,
    );
    fireEvent.click(getByTestId('step-card-step-1'));
    expect(onSelect).toHaveBeenCalledWith('step-1');
  });

  it('renders delete button with trashcan icon', () => {
    const { getByTestId } = render(
      <StepCard step={makeStep()} isSelected={false} onSelect={() => {}} onDelete={() => {}} {...defaultDragProps} />,
    );
    const deleteBtn = getByTestId('delete-step-step-1');
    expect(deleteBtn).toBeTruthy();
    // Should contain an SVG trashcan, not a × character
    expect(deleteBtn.querySelector('svg')).toBeTruthy();
    expect(deleteBtn.textContent).not.toContain('×');
  });

  it('renders delete button that calls onDelete with step id', () => {
    const onDelete = vi.fn();
    const { getByTestId } = render(
      <StepCard step={makeStep()} isSelected={false} onSelect={() => {}} onDelete={onDelete} {...defaultDragProps} />,
    );
    const deleteBtn = getByTestId('delete-step-step-1');
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('step-1');
  });

  it('strips markdown markers from description preview', () => {
    const step = makeStep({ description: 'Click **Save** and {red}verify{/red}' });
    const { getByText } = render(
      <StepCard step={step} isSelected={false} onSelect={() => {}} onDelete={() => {}} {...defaultDragProps} />,
    );
    // Should show stripped text, not raw markdown
    expect(getByText('Click Save and verify')).toBeTruthy();
  });

  it('truncates stripped markdown description at 40 chars', () => {
    const step = makeStep({
      description: '**Bold** text that is really quite long and should get truncated at forty chars',
    });
    const { container } = render(
      <StepCard step={step} isSelected={false} onSelect={() => {}} onDelete={() => {}} {...defaultDragProps} />,
    );
    // The stripped text "Bold text that is really quite long and" is >40 chars
    // so it should be truncated with "..."
    const descSpan = container.querySelector('span[style*="overflow"]');
    expect(descSpan?.textContent).toContain('...');
  });

  it('delete button click does not trigger onSelect', () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    const { getByTestId } = render(
      <StepCard step={makeStep()} isSelected={false} onSelect={onSelect} onDelete={onDelete} {...defaultDragProps} />,
    );
    fireEvent.click(getByTestId('delete-step-step-1'));
    expect(onDelete).toHaveBeenCalledWith('step-1');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders drag handle with draggable attribute', () => {
    const { getByTestId } = render(
      <StepCard step={makeStep()} isSelected={false} onSelect={() => {}} onDelete={() => {}} {...defaultDragProps} />,
    );
    const handle = getByTestId('drag-handle-step-1');
    expect(handle).toBeTruthy();
    expect(handle.getAttribute('draggable')).toBe('true');
    // Contains the 6-dot grip SVG
    expect(handle.querySelector('svg')).toBeTruthy();
  });

  it('drag handle calls onDragStart with index', () => {
    const onDragStart = vi.fn();
    const { getByTestId } = render(
      <StepCard
        step={makeStep()}
        isSelected={false}
        onSelect={() => {}}
        onDelete={() => {}}
        index={2}
        onDragStart={onDragStart}
        onDragEnd={() => {}}
      />,
    );
    const handle = getByTestId('drag-handle-step-1');
    fireEvent.dragStart(handle, {
      dataTransfer: { effectAllowed: '', setData: vi.fn() },
    });
    expect(onDragStart).toHaveBeenCalledWith(2);
  });

  it('drag handle calls onDragEnd', () => {
    const onDragEnd = vi.fn();
    const { getByTestId } = render(
      <StepCard
        step={makeStep()}
        isSelected={false}
        onSelect={() => {}}
        onDelete={() => {}}
        index={0}
        onDragStart={() => {}}
        onDragEnd={onDragEnd}
      />,
    );
    const handle = getByTestId('drag-handle-step-1');
    fireEvent.dragEnd(handle);
    expect(onDragEnd).toHaveBeenCalled();
  });

  it('wraps delete button in a tooltip wrapper', () => {
    const { container } = render(
      <StepCard step={makeStep()} isSelected={false} onSelect={() => {}} onDelete={() => {}} {...defaultDragProps} />,
    );
    const tooltipWrappers = container.querySelectorAll('[data-testid="tooltip-wrapper"]');
    expect(tooltipWrappers.length).toBe(1);
  });
});
