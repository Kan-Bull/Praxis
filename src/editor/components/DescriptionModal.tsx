import { h, Fragment } from 'preact';
import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import { DESCRIPTION_RICH_MAX } from '../../shared/constants';
import { parseMarkdown } from '../lib/markdownParser';
import type { ParsedLine, StyledSegment } from '../lib/markdownParser';

export interface DescriptionModalProps {
  description: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

type ColorName = 'red' | 'blue' | 'green' | 'black';

const COLOR_OPTIONS: { name: ColorName; hex: string; label: string }[] = [
  { name: 'red', hex: '#ef4444', label: 'Red' },
  { name: 'blue', hex: '#3b82f6', label: 'Blue' },
  { name: 'green', hex: '#22c55e', label: 'Green' },
  { name: 'black', hex: '#1e293b', label: 'Default' },
];

/** Wrap selected text in the textarea with prefix/suffix markers, or insert at cursor. */
function wrapSelection(
  textarea: HTMLTextAreaElement,
  prefix: string,
  suffix: string,
  setText: (t: string) => void,
): void {
  const { selectionStart, selectionEnd, value } = textarea;
  const before = value.slice(0, selectionStart);
  const selected = value.slice(selectionStart, selectionEnd);
  const after = value.slice(selectionEnd);

  const newValue = before + prefix + selected + suffix + after;
  setText(newValue.slice(0, DESCRIPTION_RICH_MAX));

  // Restore focus and cursor position after state update
  requestAnimationFrame(() => {
    textarea.focus();
    if (selected.length > 0) {
      const pos = selectionStart + prefix.length + selected.length + suffix.length;
      textarea.setSelectionRange(pos, pos);
    } else {
      const pos = selectionStart + prefix.length;
      textarea.setSelectionRange(pos, pos);
    }
  });
}

/** Remove any color wrapper from selected text. */
function removeColorWrapper(
  textarea: HTMLTextAreaElement,
  setText: (t: string) => void,
): void {
  const { selectionStart, selectionEnd, value } = textarea;

  const colorWrapRe = /\{(red|blue|green)\}([\s\S]*?)\{\/\1\}/g;
  let match: RegExpExecArray | null;
  let newValue = value;
  let adjusted = false;

  colorWrapRe.lastIndex = 0;
  while ((match = colorWrapRe.exec(value)) !== null) {
    const wrapStart = match.index;
    const wrapEnd = match.index + match[0].length;

    if (selectionStart < wrapEnd && selectionEnd > wrapStart) {
      const inner = match[2];
      newValue = value.slice(0, wrapStart) + inner + value.slice(wrapEnd);
      adjusted = true;
      break;
    }
  }

  if (adjusted) {
    setText(newValue);
    requestAnimationFrame(() => {
      textarea.focus();
    });
  }
}

/**
 * Toggle bullet prefix on all lines covered by the current selection.
 * If ALL selected lines already have bullets, remove them. Otherwise add them.
 */
function toggleBulletsOnSelection(
  textarea: HTMLTextAreaElement,
  setText: (t: string) => void,
): void {
  const { selectionStart, selectionEnd, value } = textarea;

  // Find the range of lines covered by the selection
  const lineStartIdx = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const lineEndIdx = value.indexOf('\n', selectionEnd);
  const end = lineEndIdx === -1 ? value.length : lineEndIdx;

  const before = value.slice(0, lineStartIdx);
  const selectedBlock = value.slice(lineStartIdx, end);
  const after = value.slice(end);

  const lines = selectedBlock.split('\n');
  const allBulleted = lines.every((l) => l.startsWith('- ') || l.trim() === '');

  const transformed = lines
    .map((line) => {
      if (line.trim() === '') return line; // leave empty lines alone
      if (allBulleted) {
        return line.startsWith('- ') ? line.slice(2) : line;
      }
      return line.startsWith('- ') ? line : '- ' + line;
    })
    .join('\n');

  const newValue = before + transformed + after;
  setText(newValue.slice(0, DESCRIPTION_RICH_MAX));
  requestAnimationFrame(() => {
    textarea.focus();
  });
}

// The parser's default color (#1e293b) is for PDF (white bg).
// Map it to a light color for the dark preview pane.
const PDF_DEFAULT_COLOR = '#1e293b';
const PREVIEW_DEFAULT_COLOR = '#e2e8f0';

/** Render a single styled segment as an inline span. */
function SegmentSpan({ seg }: { seg: StyledSegment }) {
  const displayColor = seg.color === PDF_DEFAULT_COLOR ? PREVIEW_DEFAULT_COLOR : seg.color;
  return (
    <span
      style={{
        color: displayColor,
        fontWeight: seg.bold ? 'bold' : 'normal',
        fontStyle: seg.italic ? 'italic' : 'normal',
      }}
    >
      {seg.text}
    </span>
  );
}

/** Render a parsed line (bullet or plain). */
function PreviewLine({ line }: { line: ParsedLine }) {
  if (line.segments.length === 0) {
    return <div style={{ height: '1.4em' }} />;
  }

  return (
    <div style={{ paddingLeft: line.isBullet ? '16px' : '0', position: 'relative' }}>
      {line.isBullet && (
        <span style={{ position: 'absolute', left: '4px' }}>{'\u2022'}</span>
      )}
      {line.segments.map((seg, i) => (
        <SegmentSpan key={i} seg={seg} />
      ))}
    </div>
  );
}

export function DescriptionModal({ description, onSave, onCancel }: DescriptionModalProps) {
  const [localText, setLocalText] = useState(description);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Drag state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleDragStart = useCallback((e: MouseEvent) => {
    // Only drag from the header bar itself, not child buttons
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const modalEl = (e.currentTarget as HTMLElement).parentElement;
    if (!modalEl) return;
    const rect = modalEl.getBoundingClientRect();
    const currentX = position?.x ?? rect.left;
    const currentY = position?.y ?? rect.top;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: currentX, origY: currentY };
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    };
    const handleMouseUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleBold = useCallback(() => {
    if (!textareaRef.current) return;
    wrapSelection(textareaRef.current, '**', '**', setLocalText);
  }, []);

  const handleItalic = useCallback(() => {
    if (!textareaRef.current) return;
    wrapSelection(textareaRef.current, '*', '*', setLocalText);
  }, []);

  const handleBullet = useCallback(() => {
    if (!textareaRef.current) return;
    toggleBulletsOnSelection(textareaRef.current, setLocalText);
  }, []);

  const handleColor = useCallback((color: ColorName) => {
    if (!textareaRef.current) return;

    if (color === 'black') {
      removeColorWrapper(textareaRef.current, setLocalText);
      return;
    }

    wrapSelection(textareaRef.current, `{${color}}`, `{/${color}}`, setLocalText);
  }, []);

  const parsedLines = showPreview ? parseMarkdown(localText) : [];

  const toolbarBtnStyle = {
    padding: '4px 10px',
    border: '1px solid #334155',
    borderRadius: '4px',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
    fontWeight: 500,
    lineHeight: '1.4',
  };

  return (
    <div
      data-testid="description-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        pointerEvents: 'none',
      }}
    >
      <div
        data-testid="description-modal"
        style={{
          backgroundColor: '#1e293b',
          borderRadius: '8px',
          width: '700px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          pointerEvents: 'auto',
          ...(position ? { position: 'fixed', left: `${position.x}px`, top: `${position.y}px`, margin: 0 } : {}),
        }}
      >
        {/* Header — drag handle */}
        <div
          data-testid="description-modal-header"
          onMouseDown={handleDragStart}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #334155',
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>
            Edit Description
          </h2>
          <button
            type="button"
            data-testid="description-modal-close"
            onClick={onCancel}
            style={{
              border: 'none',
              background: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px',
              lineHeight: 1,
            }}
            title="Close"
          >
            &#x2715;
          </button>
        </div>

        {/* Toolbar */}
        <div
          data-testid="description-toolbar"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            padding: '8px 16px',
            borderBottom: '1px solid #334155',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            data-testid="toolbar-bold"
            onClick={handleBold}
            disabled={showPreview}
            style={{ ...toolbarBtnStyle, fontWeight: 'bold', opacity: showPreview ? 0.4 : 1 }}
            title="Bold (**text**)"
          >
            B
          </button>
          <button
            type="button"
            data-testid="toolbar-italic"
            onClick={handleItalic}
            disabled={showPreview}
            style={{ ...toolbarBtnStyle, fontStyle: 'italic', opacity: showPreview ? 0.4 : 1 }}
            title="Italic (*text*)"
          >
            I
          </button>
          <button
            type="button"
            data-testid="toolbar-bullet"
            onClick={handleBullet}
            disabled={showPreview}
            style={{ ...toolbarBtnStyle, opacity: showPreview ? 0.4 : 1 }}
            title="Bullet list (- )"
          >
            &#x2022; List
          </button>

          <span style={{ width: '1px', height: '20px', backgroundColor: '#334155', margin: '0 4px' }} />

          {COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.name}
              type="button"
              data-testid={`toolbar-color-${opt.name}`}
              onClick={() => handleColor(opt.name)}
              disabled={showPreview}
              style={{
                ...toolbarBtnStyle,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: showPreview ? 0.4 : 1,
              }}
              title={opt.name === 'black' ? 'Remove color' : `${opt.label} text`}
            >
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: opt.hex,
                  border: '1px solid rgba(255,255,255,0.2)',
                  display: 'inline-block',
                }}
              />
              {opt.label}
            </button>
          ))}

          <span style={{ width: '1px', height: '20px', backgroundColor: '#334155', margin: '0 4px' }} />

          {/* Preview toggle */}
          <button
            type="button"
            data-testid="toolbar-preview-toggle"
            onClick={() => setShowPreview((p) => !p)}
            style={{
              ...toolbarBtnStyle,
              backgroundColor: showPreview ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)',
              borderColor: showPreview ? '#3b82f6' : '#334155',
              color: showPreview ? '#93c5fd' : '#e2e8f0',
            }}
            title={showPreview ? 'Switch to editor' : 'Preview formatted text'}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {/* Content area: Editor or Preview */}
        <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {showPreview ? (
            <div
              data-testid="description-modal-preview"
              style={{
                flex: 1,
                minHeight: '200px',
                padding: '10px 12px',
                fontSize: '14px',
                fontFamily: 'inherit',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '4px',
                color: '#e2e8f0',
                lineHeight: 1.6,
                overflowY: 'auto',
              }}
            >
              {parsedLines.length === 0 ? (
                <span style={{ color: '#64748b', fontStyle: 'italic' }}>Nothing to preview</span>
              ) : (
                parsedLines.map((line, i) => <PreviewLine key={i} line={line} />)
              )}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              data-testid="description-modal-textarea"
              value={localText}
              onInput={(e) => {
                const value = (e.target as HTMLTextAreaElement).value;
                setLocalText(value.slice(0, DESCRIPTION_RICH_MAX));
              }}
              maxLength={DESCRIPTION_RICH_MAX}
              rows={15}
              style={{
                width: '100%',
                flex: 1,
                minHeight: '200px',
                padding: '10px 12px',
                fontSize: '14px',
                fontFamily: 'monospace',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '4px',
                color: '#e2e8f0',
                resize: 'none',
                boxSizing: 'border-box',
                lineHeight: 1.5,
              }}
            />
          )}
          <div
            data-testid="description-modal-char-count"
            style={{
              fontSize: '11px',
              color: '#94a3b8',
              textAlign: 'right',
              marginTop: '4px',
            }}
          >
            {localText.length}/{DESCRIPTION_RICH_MAX}
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '12px 16px',
            borderTop: '1px solid #334155',
          }}
        >
          <button
            type="button"
            data-testid="description-modal-cancel"
            onClick={onCancel}
            style={{
              padding: '6px 16px',
              border: '1px solid #334155',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="description-modal-done"
            onClick={() => onSave(localText)}
            style={{
              padding: '6px 16px',
              border: '1px solid #3b82f6',
              borderRadius: '4px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
