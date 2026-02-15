import { describe, it, expect, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { ConfirmDeleteDialog } from '../../../src/editor/components/ConfirmDeleteDialog';

describe('ConfirmDeleteDialog', () => {
  it('renders with step number in message', () => {
    const { getByTestId, getAllByText } = render(
      <ConfirmDeleteDialog stepNumber={3} onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(getByTestId('confirm-delete-dialog')).toBeTruthy();
    expect(getAllByText(/step 3/i).length).toBeGreaterThanOrEqual(1);
  });

  it('calls onConfirm when delete button clicked', () => {
    const onConfirm = vi.fn();
    const { getByTestId } = render(
      <ConfirmDeleteDialog stepNumber={1} onConfirm={onConfirm} onCancel={() => {}} />,
    );
    fireEvent.click(getByTestId('confirm-delete'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    const { getByTestId } = render(
      <ConfirmDeleteDialog stepNumber={1} onConfirm={() => {}} onCancel={onCancel} />,
    );
    fireEvent.click(getByTestId('confirm-cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when overlay backdrop clicked', () => {
    const onCancel = vi.fn();
    const { getByTestId } = render(
      <ConfirmDeleteDialog stepNumber={1} onConfirm={() => {}} onCancel={onCancel} />,
    );
    fireEvent.click(getByTestId('confirm-delete-dialog'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not call onCancel when dialog content clicked', () => {
    const onCancel = vi.fn();
    const { getByTestId } = render(
      <ConfirmDeleteDialog stepNumber={1} onConfirm={() => {}} onCancel={onCancel} />,
    );
    fireEvent.click(getByTestId('confirm-delete-content'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
