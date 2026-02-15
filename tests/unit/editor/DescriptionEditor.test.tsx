import { describe, it, expect, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { DescriptionEditor } from '../../../src/editor/components/DescriptionEditor';

describe('DescriptionEditor', () => {
  it('renders stripped description as preview text', () => {
    const { getByTestId } = render(
      <DescriptionEditor description="**Bold** text" onChange={() => {}} onEditClick={() => {}} />,
    );
    expect(getByTestId('description-edit-trigger').textContent).toBe('Bold text');
  });

  it('shows placeholder when description is empty', () => {
    const { getByTestId } = render(
      <DescriptionEditor description="" onChange={() => {}} onEditClick={() => {}} />,
    );
    expect(getByTestId('description-edit-trigger').textContent).toBe('Click to add description');
  });

  it('truncates long descriptions at 80 chars', () => {
    const long = 'A'.repeat(100);
    const { getByTestId } = render(
      <DescriptionEditor description={long} onChange={() => {}} onEditClick={() => {}} />,
    );
    const text = getByTestId('description-edit-trigger').textContent!;
    expect(text.length).toBeLessThanOrEqual(83); // 80 chars + "..."
    expect(text).toContain('...');
  });

  it('calls onEditClick when clicked', () => {
    const onEdit = vi.fn();
    const { getByTestId } = render(
      <DescriptionEditor description="Hello" onChange={() => {}} onEditClick={onEdit} />,
    );
    fireEvent.click(getByTestId('description-edit-trigger'));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('displays default label', () => {
    const { getByText } = render(
      <DescriptionEditor description="" onChange={() => {}} onEditClick={() => {}} />,
    );
    expect(getByText('Step description')).toBeTruthy();
  });

  it('displays custom label', () => {
    const { getByText } = render(
      <DescriptionEditor description="" onChange={() => {}} label="Screenshot title" />,
    );
    expect(getByText('Screenshot title')).toBeTruthy();
  });

  it('strips markdown markers from preview', () => {
    const { getByTestId } = render(
      <DescriptionEditor description="{red}Warning{/red}: *check* this" onChange={() => {}} onEditClick={() => {}} />,
    );
    expect(getByTestId('description-edit-trigger').textContent).toBe('Warning: check this');
  });

  it('wraps edit button in a tooltip', () => {
    const { container } = render(
      <DescriptionEditor description="Hello" onChange={() => {}} onEditClick={() => {}} />,
    );
    expect(container.querySelector('[data-testid="tooltip-wrapper"]')).toBeTruthy();
  });

  // Inline input mode (no onEditClick — screenshot mode)
  it('renders inline input when onEditClick is not provided', () => {
    const { getByTestId, queryByTestId } = render(
      <DescriptionEditor description="My Screenshot" onChange={() => {}} />,
    );
    expect(getByTestId('description-inline-input')).toBeTruthy();
    expect(queryByTestId('description-edit-trigger')).toBeNull();
  });

  it('inline input shows current description as value', () => {
    const { getByTestId } = render(
      <DescriptionEditor description="Page Title" onChange={() => {}} />,
    );
    const input = getByTestId('description-inline-input') as HTMLInputElement;
    expect(input.value).toBe('Page Title');
  });

  it('inline input calls onChange on typing', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <DescriptionEditor description="Old" onChange={onChange} />,
    );
    const input = getByTestId('description-inline-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'New Title' } });
    expect(onChange).toHaveBeenCalledWith('New Title');
  });

  it('inline input has placeholder text', () => {
    const { getByTestId } = render(
      <DescriptionEditor description="" onChange={() => {}} />,
    );
    const input = getByTestId('description-inline-input') as HTMLInputElement;
    expect(input.placeholder).toBe('Enter title');
  });

  it('does not show tooltip in inline mode', () => {
    const { container } = render(
      <DescriptionEditor description="Hello" onChange={() => {}} />,
    );
    expect(container.querySelector('[data-testid="tooltip-wrapper"]')).toBeNull();
  });
});
