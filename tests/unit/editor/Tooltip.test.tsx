import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, waitFor } from '@testing-library/preact';
import { Tooltip } from '../../../src/editor/components/Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Clean up portal nodes
    document.querySelectorAll('[data-testid="tooltip"]').forEach(el => el.remove());
  });

  it('renders children', () => {
    const { getByText } = render(
      <Tooltip text="Hint text">
        <button>Click me</button>
      </Tooltip>,
    );
    expect(getByText('Click me')).toBeTruthy();
  });

  it('does not show tooltip initially', () => {
    render(
      <Tooltip text="Hint text">
        <button>Click me</button>
      </Tooltip>,
    );
    expect(document.querySelector('[data-testid="tooltip"]')).toBeNull();
  });

  it('shows tooltip after hover delay', async () => {
    const { getByTestId } = render(
      <Tooltip text="Hint text">
        <button>Click me</button>
      </Tooltip>,
    );

    const wrapper = getByTestId('tooltip-wrapper');
    fireEvent.mouseEnter(wrapper);

    // Before delay — no tooltip
    expect(document.querySelector('[data-testid="tooltip"]')).toBeNull();

    // After delay — tooltip visible (portalled to body)
    vi.advanceTimersByTime(400);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="tooltip"]')).toBeTruthy();
    });
    expect(document.querySelector('[data-testid="tooltip"]')!.textContent).toBe('Hint text');
  });

  it('hides tooltip on mouse leave', async () => {
    const { getByTestId } = render(
      <Tooltip text="Hint text">
        <button>Click me</button>
      </Tooltip>,
    );

    const wrapper = getByTestId('tooltip-wrapper');
    fireEvent.mouseEnter(wrapper);
    vi.advanceTimersByTime(400);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="tooltip"]')).toBeTruthy();
    });

    fireEvent.mouseLeave(wrapper);
    expect(document.querySelector('[data-testid="tooltip"]')).toBeNull();
  });

  it('cancels tooltip if mouse leaves before delay', () => {
    const { getByTestId } = render(
      <Tooltip text="Hint text">
        <button>Click me</button>
      </Tooltip>,
    );

    const wrapper = getByTestId('tooltip-wrapper');
    fireEvent.mouseEnter(wrapper);
    vi.advanceTimersByTime(200); // half the delay
    fireEvent.mouseLeave(wrapper);
    vi.advanceTimersByTime(300); // past when it would have shown

    expect(document.querySelector('[data-testid="tooltip"]')).toBeNull();
  });
});
