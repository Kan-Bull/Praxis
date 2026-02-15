import { h } from 'preact';

export interface ConfirmDeleteDialogProps {
  stepNumber: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteDialog({ stepNumber, onConfirm, onCancel }: ConfirmDeleteDialogProps) {
  return (
    <div
      data-testid="confirm-delete-dialog"
      onClick={onCancel}
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
        data-testid="confirm-delete-content"
        onClick={(e: MouseEvent) => e.stopPropagation()}
        style={{
          backgroundColor: '#1e293b',
          borderRadius: '8px',
          width: '360px',
          padding: '24px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
          Delete Step {stepNumber}?
        </div>
        <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
          This will permanently remove step {stepNumber} and its screenshot. This action cannot be undone.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            data-testid="confirm-cancel"
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
            data-testid="confirm-delete"
            onClick={onConfirm}
            style={{
              padding: '6px 16px',
              border: '1px solid #ef4444',
              borderRadius: '4px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
