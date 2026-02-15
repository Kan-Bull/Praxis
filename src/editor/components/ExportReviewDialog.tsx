import { h } from 'preact';
import { useState, useRef } from 'preact/hooks';
import type { SensitiveMatch } from '../lib/sensitiveTextScanner';

export interface ExportSettings {
  title: string;
  author: string;
  date: string;
  pageSize: 'a4' | 'letter';
  includeUrls: boolean;
}

export interface ExportReviewDialogProps {
  title: string;
  sensitiveMatches: SensitiveMatch[];
  onConfirm: (settings: ExportSettings) => void;
  onCancel: () => void;
  logoDataUrl?: string | null;
  onLogoChange?: (dataUrl: string | null) => void;
}

function formatToday(): string {
  const d = new Date();
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ExportReviewDialog({
  title: initialTitle,
  sensitiveMatches,
  onConfirm,
  onCancel,
  logoDataUrl,
  onLogoChange,
}: ExportReviewDialogProps) {
  const [title, setTitle] = useState(initialTitle);
  const [author, setAuthor] = useState('');
  const [date, setDate] = useState(formatToday);
  const [pageSize, setPageSize] = useState<'a4' | 'letter'>('a4');
  const [includeUrls, setIncludeUrls] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group sensitive matches by stepId to produce a summary line
  const stepsWithMatches = new Set<number>();
  for (const m of sensitiveMatches) {
    // stepId is the step's id string; we need to extract step numbers
    // The caller provides stepId but not stepNumber in SensitiveMatch,
    // so we use the index position (1-based) derived from unique stepIds in order
    stepsWithMatches.add(
      [...new Set(sensitiveMatches.map((sm) => sm.stepId))].indexOf(m.stepId) + 1,
    );
  }
  const sortedStepNums = [...stepsWithMatches].sort((a, b) => a - b);

  const inputStyle = {
    width: '100%',
    padding: '6px 10px',
    fontSize: '14px',
    fontFamily: 'inherit',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '4px',
    color: '#f8fafc',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '4px',
    fontWeight: 500,
  };

  return (
    <div
      data-testid="export-review-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        style={{
          backgroundColor: '#1e293b',
          borderRadius: '8px',
          width: '480px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Sensitive data warning (conditional) */}
        {sensitiveMatches.length > 0 && (
          <div
            data-testid="sensitive-warning"
            style={{
              padding: '10px 16px',
              backgroundColor: 'rgba(251, 191, 36, 0.1)',
              borderBottom: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '8px 8px 0 0',
              fontSize: '13px',
              color: '#fcd34d',
            }}
          >
            {sensitiveMatches.length} potential sensitive{' '}
            {sensitiveMatches.length === 1 ? 'item' : 'items'} detected in{' '}
            {sortedStepNums.length === 1 ? 'step' : 'steps'}{' '}
            {sortedStepNums.join(', ')}
          </div>
        )}

        {/* Form fields */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Workflow title */}
          <div>
            <label style={labelStyle}>Workflow title</label>
            <input
              data-testid="export-title-input"
              type="text"
              value={title}
              onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
              style={inputStyle}
            />
          </div>

          {/* Author */}
          <div>
            <label style={labelStyle}>Author</label>
            <input
              data-testid="export-author-input"
              type="text"
              value={author}
              placeholder="Author name"
              onInput={(e) => setAuthor((e.target as HTMLInputElement).value)}
              style={inputStyle}
            />
          </div>

          {/* Date */}
          <div>
            <label style={labelStyle}>Date</label>
            <input
              data-testid="export-date-input"
              type="text"
              value={date}
              onInput={(e) => setDate((e.target as HTMLInputElement).value)}
              style={inputStyle}
            />
          </div>

          {/* Logo upload */}
          {onLogoChange && (
            <div>
              <label style={labelStyle}>Logo watermark (optional)</label>
              <input
                ref={fileInputRef}
                data-testid="logo-file-input"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    onLogoChange(reader.result as string);
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {logoDataUrl ? (
                  <>
                    <img
                      data-testid="logo-preview"
                      src={logoDataUrl}
                      alt="Logo preview"
                      style={{
                        width: '32px',
                        height: '32px',
                        objectFit: 'contain',
                        borderRadius: '4px',
                        border: '1px solid #334155',
                      }}
                    />
                    <button
                      type="button"
                      data-testid="logo-remove"
                      onClick={() => {
                        onLogoChange(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      style={{
                        padding: '4px 10px',
                        border: '1px solid #334155',
                        borderRadius: '4px',
                        backgroundColor: 'transparent',
                        color: '#e2e8f0',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                      }}
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    data-testid="logo-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '4px 10px',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      backgroundColor: 'transparent',
                      color: '#e2e8f0',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontFamily: 'inherit',
                    }}
                  >
                    Choose image
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options row: Page size + Include URLs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '4px' }}>
            {/* Page size segmented toggle */}
            <div>
              <label style={labelStyle}>Page size</label>
              <div
                data-testid="page-size-toggle"
                style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', border: '1px solid #334155' }}
              >
                <button
                  type="button"
                  data-testid="page-size-a4"
                  onClick={() => setPageSize('a4')}
                  style={{
                    padding: '4px 14px',
                    border: 'none',
                    backgroundColor: pageSize === 'a4' ? '#3b82f6' : '#0f172a',
                    color: pageSize === 'a4' ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    fontWeight: pageSize === 'a4' ? 600 : 400,
                  }}
                >
                  A4
                </button>
                <button
                  type="button"
                  data-testid="page-size-letter"
                  onClick={() => setPageSize('letter')}
                  style={{
                    padding: '4px 14px',
                    border: 'none',
                    borderLeft: '1px solid #334155',
                    backgroundColor: pageSize === 'letter' ? '#3b82f6' : '#0f172a',
                    color: pageSize === 'letter' ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    fontWeight: pageSize === 'letter' ? 600 : 400,
                  }}
                >
                  Letter
                </button>
              </div>
            </div>

            {/* Include URLs checkbox */}
            <div>
              <label style={labelStyle}>Options</label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                }}
              >
                <input
                  data-testid="include-urls-checkbox"
                  type="checkbox"
                  checked={includeUrls}
                  onChange={(e) => setIncludeUrls((e.target as HTMLInputElement).checked)}
                  style={{ accentColor: '#3b82f6' }}
                />
                Include URLs
              </label>
            </div>
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
            data-testid="export-cancel"
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
            data-testid="export-confirm"
            onClick={() => onConfirm({ title, author, date, pageSize, includeUrls })}
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
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
