import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import { DescriptionModal } from '../../../src/editor/components/DescriptionModal';

describe('DescriptionModal', () => {
  const defaultProps = {
    description: 'Initial text',
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with initial description', () => {
    const { getByTestId } = render(<DescriptionModal {...defaultProps} />);
    const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Initial text');
  });

  it('renders modal title', () => {
    const { getByText } = render(<DescriptionModal {...defaultProps} />);
    expect(getByText('Edit Description')).toBeTruthy();
  });

  it('renders toolbar buttons', () => {
    const { getByTestId } = render(<DescriptionModal {...defaultProps} />);
    expect(getByTestId('toolbar-bold')).toBeTruthy();
    expect(getByTestId('toolbar-italic')).toBeTruthy();
    expect(getByTestId('toolbar-bullet')).toBeTruthy();
    expect(getByTestId('toolbar-color-red')).toBeTruthy();
    expect(getByTestId('toolbar-color-blue')).toBeTruthy();
    expect(getByTestId('toolbar-color-green')).toBeTruthy();
    expect(getByTestId('toolbar-color-black')).toBeTruthy();
    expect(getByTestId('toolbar-preview-toggle')).toBeTruthy();
  });

  it('shows character count', () => {
    const { getByTestId } = render(<DescriptionModal {...defaultProps} />);
    expect(getByTestId('description-modal-char-count').textContent).toBe('12/2000');
  });

  it('calls onSave with current text when Done is clicked', () => {
    const onSave = vi.fn();
    const { getByTestId } = render(
      <DescriptionModal description="Hello" onSave={onSave} onCancel={() => {}} />,
    );

    const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'Modified text' } });

    fireEvent.click(getByTestId('description-modal-done'));
    expect(onSave).toHaveBeenCalledWith('Modified text');
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    const { getByTestId } = render(
      <DescriptionModal description="" onSave={() => {}} onCancel={onCancel} />,
    );

    fireEvent.click(getByTestId('description-modal-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when X close button is clicked', () => {
    const onCancel = vi.fn();
    const { getByTestId } = render(
      <DescriptionModal description="" onSave={() => {}} onCancel={onCancel} />,
    );

    fireEvent.click(getByTestId('description-modal-close'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not call onSave until Done is clicked (local-only edits)', () => {
    const onSave = vi.fn();
    const { getByTestId } = render(
      <DescriptionModal description="Hello" onSave={onSave} onCancel={() => {}} />,
    );

    const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'Editing...' } });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('updates local text on input', () => {
    const { getByTestId } = render(<DescriptionModal {...defaultProps} />);
    const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;

    fireEvent.input(textarea, { target: { value: 'New content' } });
    expect(textarea.value).toBe('New content');
  });

  it('enforces 2000 character limit on input', () => {
    const { getByTestId } = render(<DescriptionModal {...defaultProps} />);
    const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;

    const longText = 'a'.repeat(2500);
    fireEvent.input(textarea, { target: { value: longText } });
    expect(textarea.value.length).toBeLessThanOrEqual(2000);
  });

  it('renders overlay with high z-index', () => {
    const { getByTestId } = render(<DescriptionModal {...defaultProps} />);
    const overlay = getByTestId('description-modal-overlay');
    expect(overlay.style.zIndex).toBe('10000');
  });

  it('renders modal card', () => {
    const { getByTestId } = render(<DescriptionModal {...defaultProps} />);
    expect(getByTestId('description-modal')).toBeTruthy();
  });

  describe('toolbar bold button', () => {
    it('wraps selected text with bold markers', () => {
      const { getByTestId } = render(
        <DescriptionModal description="Hello world" onSave={() => {}} onCancel={() => {}} />,
      );
      const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;

      textarea.setSelectionRange(6, 11);
      fireEvent.click(getByTestId('toolbar-bold'));

      expect(textarea.value).toBe('Hello **world**');
    });

    it('inserts empty bold markers at cursor when no selection', () => {
      const { getByTestId } = render(
        <DescriptionModal description="Hello" onSave={() => {}} onCancel={() => {}} />,
      );
      const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;

      textarea.setSelectionRange(5, 5);
      fireEvent.click(getByTestId('toolbar-bold'));

      expect(textarea.value).toBe('Hello****');
    });
  });

  describe('toolbar italic button', () => {
    it('wraps selected text with italic markers', () => {
      const { getByTestId } = render(
        <DescriptionModal description="Hello world" onSave={() => {}} onCancel={() => {}} />,
      );
      const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;

      textarea.setSelectionRange(6, 11);
      fireEvent.click(getByTestId('toolbar-italic'));

      expect(textarea.value).toBe('Hello *world*');
    });
  });

  describe('toolbar bullet button', () => {
    it('adds bullet prefix to current line', () => {
      const { getByTestId } = render(
        <DescriptionModal description="Item one" onSave={() => {}} onCancel={() => {}} />,
      );
      const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;

      textarea.setSelectionRange(0, 0);
      fireEvent.click(getByTestId('toolbar-bullet'));

      expect(textarea.value).toBe('- Item one');
    });

    it('removes bullet prefix if already present', () => {
      const { getByTestId } = render(
        <DescriptionModal description="- Already bulleted" onSave={() => {}} onCancel={() => {}} />,
      );
      const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;

      textarea.setSelectionRange(0, 0);
      fireEvent.click(getByTestId('toolbar-bullet'));

      expect(textarea.value).toBe('Already bulleted');
    });

    it('adds bullet to all selected lines (multi-line)', () => {
      const text = 'Line A\nLine B\nLine C';
      const { getByTestId } = render(
        <DescriptionModal description={text} onSave={() => {}} onCancel={() => {}} />,
      );
      const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;

      // Select from start of Line A to end of Line C
      textarea.setSelectionRange(0, text.length);
      fireEvent.click(getByTestId('toolbar-bullet'));

      expect(textarea.value).toBe('- Line A\n- Line B\n- Line C');
    });

    it('removes bullets from all selected lines when all are bulleted', () => {
      const text = '- Line A\n- Line B\n- Line C';
      const { getByTestId } = render(
        <DescriptionModal description={text} onSave={() => {}} onCancel={() => {}} />,
      );
      const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;

      textarea.setSelectionRange(0, text.length);
      fireEvent.click(getByTestId('toolbar-bullet'));

      expect(textarea.value).toBe('Line A\nLine B\nLine C');
    });

    it('adds bullets to mixed lines (some already bulleted)', () => {
      const text = '- Line A\nLine B\n- Line C';
      const { getByTestId } = render(
        <DescriptionModal description={text} onSave={() => {}} onCancel={() => {}} />,
      );
      const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;

      textarea.setSelectionRange(0, text.length);
      fireEvent.click(getByTestId('toolbar-bullet'));

      // Not all bulleted, so should add bullets to the ones missing
      expect(textarea.value).toBe('- Line A\n- Line B\n- Line C');
    });
  });

  describe('toolbar color buttons', () => {
    it('wraps selected text with red color markers', () => {
      const { getByTestId } = render(
        <DescriptionModal description="danger zone" onSave={() => {}} onCancel={() => {}} />,
      );
      const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;

      textarea.setSelectionRange(0, 6);
      fireEvent.click(getByTestId('toolbar-color-red'));

      expect(textarea.value).toBe('{red}danger{/red} zone');
    });

    it('wraps selected text with blue color markers', () => {
      const { getByTestId } = render(
        <DescriptionModal description="info text" onSave={() => {}} onCancel={() => {}} />,
      );
      const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;

      textarea.setSelectionRange(0, 4);
      fireEvent.click(getByTestId('toolbar-color-blue'));

      expect(textarea.value).toBe('{blue}info{/blue} text');
    });

    it('wraps selected text with green color markers', () => {
      const { getByTestId } = render(
        <DescriptionModal description="success msg" onSave={() => {}} onCancel={() => {}} />,
      );
      const textarea = getByTestId('description-modal-textarea') as HTMLTextAreaElement;

      textarea.setSelectionRange(0, 7);
      fireEvent.click(getByTestId('toolbar-color-green'));

      expect(textarea.value).toBe('{green}success{/green} msg');
    });
  });

  describe('preview mode', () => {
    it('shows Preview button in toolbar', () => {
      const { getByTestId } = render(<DescriptionModal {...defaultProps} />);
      expect(getByTestId('toolbar-preview-toggle').textContent).toBe('Preview');
    });

    it('switches to preview pane when Preview is clicked', () => {
      const { getByTestId, queryByTestId } = render(
        <DescriptionModal description="**Bold** and *italic*" onSave={() => {}} onCancel={() => {}} />,
      );

      fireEvent.click(getByTestId('toolbar-preview-toggle'));

      // Textarea should be gone, preview should be visible
      expect(queryByTestId('description-modal-textarea')).toBeNull();
      expect(getByTestId('description-modal-preview')).toBeTruthy();
    });

    it('renders formatted content in preview', () => {
      const { getByTestId } = render(
        <DescriptionModal description="**Bold** text" onSave={() => {}} onCancel={() => {}} />,
      );

      fireEvent.click(getByTestId('toolbar-preview-toggle'));

      const preview = getByTestId('description-modal-preview');
      // Should contain the text (without markers)
      expect(preview.textContent).toContain('Bold');
      expect(preview.textContent).toContain('text');
      // Should NOT contain raw markers
      expect(preview.textContent).not.toContain('**');
    });

    it('shows Edit button when in preview mode', () => {
      const { getByTestId } = render(<DescriptionModal {...defaultProps} />);

      fireEvent.click(getByTestId('toolbar-preview-toggle'));
      expect(getByTestId('toolbar-preview-toggle').textContent).toBe('Edit');
    });

    it('switches back to editor when Edit is clicked', () => {
      const { getByTestId, queryByTestId } = render(<DescriptionModal {...defaultProps} />);

      // Go to preview
      fireEvent.click(getByTestId('toolbar-preview-toggle'));
      expect(queryByTestId('description-modal-textarea')).toBeNull();

      // Go back to editor
      fireEvent.click(getByTestId('toolbar-preview-toggle'));
      expect(getByTestId('description-modal-textarea')).toBeTruthy();
      expect(queryByTestId('description-modal-preview')).toBeNull();
    });

    it('disables formatting buttons in preview mode', () => {
      const { getByTestId } = render(<DescriptionModal {...defaultProps} />);

      fireEvent.click(getByTestId('toolbar-preview-toggle'));

      expect((getByTestId('toolbar-bold') as HTMLButtonElement).disabled).toBe(true);
      expect((getByTestId('toolbar-italic') as HTMLButtonElement).disabled).toBe(true);
      expect((getByTestId('toolbar-bullet') as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows "Nothing to preview" for empty text', () => {
      const { getByTestId } = render(
        <DescriptionModal description="" onSave={() => {}} onCancel={() => {}} />,
      );

      fireEvent.click(getByTestId('toolbar-preview-toggle'));

      expect(getByTestId('description-modal-preview').textContent).toBe('Nothing to preview');
    });

    it('preserves char count in preview mode', () => {
      const { getByTestId } = render(
        <DescriptionModal description="Hello" onSave={() => {}} onCancel={() => {}} />,
      );

      fireEvent.click(getByTestId('toolbar-preview-toggle'));
      expect(getByTestId('description-modal-char-count').textContent).toBe('5/2000');
    });
  });
});
