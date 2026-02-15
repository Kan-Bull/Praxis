import { h } from 'preact';
import { stripMarkdown } from '../lib/markdownParser';
import { Tooltip } from './Tooltip';

export interface DescriptionEditorProps {
  description: string;
  onChange: (text: string) => void;
  maxLength?: number;
  onEditClick?: () => void;
  label?: string;
}

export function DescriptionEditor({
  description,
  onChange,
  maxLength: _maxLength,
  onEditClick,
  label = 'Step description',
}: DescriptionEditorProps) {
  const plain = stripMarkdown(description);
  const preview = plain.length > 80 ? plain.slice(0, 80) + '...' : (plain || 'Click to add description');

  return (
    <div style={{ padding: '8px 0' }}>
      <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
        {label}
      </label>
      {onEditClick ? (
        <Tooltip text="Click to open rich text editor" block>
          <button
            type="button"
            data-testid="description-edit-trigger"
            onClick={onEditClick}
            style={{
              display: 'block',
              width: '100%',
              padding: '6px 8px',
              fontSize: '13px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid #334155',
              borderRadius: '4px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              color: plain ? '#e2e8f0' : '#64748b',
              cursor: 'pointer',
              textAlign: 'left',
              minHeight: '36px',
              lineHeight: '1.4',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {preview}
          </button>
        </Tooltip>
      ) : (
        <input
          type="text"
          data-testid="description-inline-input"
          value={description}
          onInput={(e) => onChange((e.target as HTMLInputElement).value)}
          placeholder="Enter title"
          style={{
            display: 'block',
            width: '100%',
            padding: '6px 8px',
            fontSize: '13px',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid #334155',
            borderRadius: '4px',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            color: '#e2e8f0',
            minHeight: '36px',
            lineHeight: '1.4',
            outline: 'none',
          }}
        />
      )}
    </div>
  );
}
