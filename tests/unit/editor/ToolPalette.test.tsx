import { describe, it, expect, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { ToolPalette } from '../../../src/editor/components/ToolPalette';
import { ANNOTATION_COLORS } from '../../../src/shared/constants';

describe('ToolPalette', () => {
  const defaultProps = {
    activeTool: 'select' as const,
    activeColor: '#ef4444',
    onToolChange: vi.fn(),
    onColorChange: vi.fn(),
    onDelete: vi.fn(),
  };

  it('renders all tool buttons', () => {
    const { getByTestId } = render(<ToolPalette {...defaultProps} />);
    expect(getByTestId('tool-select')).toBeTruthy();
    expect(getByTestId('tool-rect')).toBeTruthy();
    expect(getByTestId('tool-text')).toBeTruthy();
    expect(getByTestId('tool-arrow')).toBeTruthy();
    expect(getByTestId('tool-blur')).toBeTruthy();
    expect(getByTestId('tool-crop')).toBeTruthy();
    expect(getByTestId('tool-delete')).toBeTruthy();
  });

  it('calls onToolChange with crop when crop clicked', () => {
    const onToolChange = vi.fn();
    const { getByTestId } = render(
      <ToolPalette {...defaultProps} onToolChange={onToolChange} />,
    );
    fireEvent.click(getByTestId('tool-crop'));
    expect(onToolChange).toHaveBeenCalledWith('crop');
  });

  it('highlights active tool', () => {
    const { getByTestId } = render(
      <ToolPalette {...defaultProps} activeTool="rect" />,
    );
    const rectBtn = getByTestId('tool-rect');
    expect(rectBtn.style.backgroundColor).toBeTruthy();
  });

  it('calls onToolChange when tool clicked', () => {
    const onToolChange = vi.fn();
    const { getByTestId } = render(
      <ToolPalette {...defaultProps} onToolChange={onToolChange} />,
    );
    fireEvent.click(getByTestId('tool-text'));
    expect(onToolChange).toHaveBeenCalledWith('text');
  });

  it('calls onToolChange with arrow when arrow clicked', () => {
    const onToolChange = vi.fn();
    const { getByTestId } = render(
      <ToolPalette {...defaultProps} onToolChange={onToolChange} />,
    );
    fireEvent.click(getByTestId('tool-arrow'));
    expect(onToolChange).toHaveBeenCalledWith('arrow');
  });

  it('renders color swatches', () => {
    const { getByTestId } = render(<ToolPalette {...defaultProps} />);
    for (const color of ANNOTATION_COLORS) {
      expect(getByTestId(`color-${color}`)).toBeTruthy();
    }
  });

  it('calls onColorChange when color clicked', () => {
    const onColorChange = vi.fn();
    const { getByTestId } = render(
      <ToolPalette {...defaultProps} onColorChange={onColorChange} />,
    );
    fireEvent.click(getByTestId(`color-${ANNOTATION_COLORS[1]}`));
    expect(onColorChange).toHaveBeenCalledWith(ANNOTATION_COLORS[1]);
  });

  it('calls onDelete when delete clicked', () => {
    const onDelete = vi.fn();
    const { getByTestId } = render(
      <ToolPalette {...defaultProps} onDelete={onDelete} />,
    );
    fireEvent.click(getByTestId('tool-delete'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('labels delete button as "Remove Annotation"', () => {
    const { getByTestId } = render(<ToolPalette {...defaultProps} />);
    expect(getByTestId('tool-delete').textContent).toBe('Remove Annotation');
  });

  it('wraps each tool button in a tooltip', () => {
    const { container } = render(<ToolPalette {...defaultProps} />);
    // Each tool + delete button should be inside a tooltip-wrapper span
    const wrappers = container.querySelectorAll('[data-testid="tooltip-wrapper"]');
    // 6 tools + 1 delete = 7
    expect(wrappers.length).toBe(7);
  });

  it('color swatches have native title tooltips', () => {
    const { getByTestId } = render(<ToolPalette {...defaultProps} />);
    const firstColor = ANNOTATION_COLORS[0];
    expect(getByTestId(`color-${firstColor}`).getAttribute('title')).toBe(`Color ${firstColor}`);
  });
});
