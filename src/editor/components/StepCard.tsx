import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { CaptureStep } from '../../shared/types';
import { stripMarkdown } from '../lib/markdownParser';
import { Tooltip } from './Tooltip';

export interface StepCardProps {
  step: CaptureStep;
  isSelected: boolean;
  onSelect: (stepId: string) => void;
  onDelete: (stepId: string) => void;
  index: number;
  onDragStart: (index: number) => void;
  onDragEnd: () => void;
}

export function StepCard({ step, isSelected, onSelect, onDelete, index, onDragStart, onDragEnd }: StepCardProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const plainDesc = stripMarkdown(step.description);
  const truncatedDesc =
    plainDesc.length > 40
      ? plainDesc.slice(0, 40) + '...'
      : plainDesc;

  const getBg = () => {
    if (pressed) return 'rgba(59, 130, 246, 0.2)';
    if (hovered) return 'rgba(59, 130, 246, 0.12)';
    if (isSelected) return 'rgba(59, 130, 246, 0.15)';
    return 'rgba(255, 255, 255, 0.04)';
  };

  const getBorderColor = () => {
    if (isSelected || hovered || pressed) return '#3b82f6';
    return '#1e293b';
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(step.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      data-testid={`step-card-${step.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '10px',
        border: isSelected ? '2px solid #3b82f6' : `1px solid ${getBorderColor()}`,
        borderRadius: '10px',
        backgroundColor: getBg(),
        cursor: 'pointer',
        textAlign: 'left',
        marginBottom: '6px',
        fontFamily: 'inherit',
        fontSize: '13px',
        transition: 'all 0.15s ease',
        boxShadow: isSelected
          ? '0 1px 3px rgba(59,130,246,0.2)'
          : hovered
            ? '0 2px 8px rgba(59, 130, 246, 0.15)'
            : 'none',
        transform: hovered && !pressed ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <span
        draggable
        data-testid={`drag-handle-${step.id}`}
        onDragStart={(e: DragEvent) => {
          e.dataTransfer!.effectAllowed = 'move';
          e.dataTransfer!.setData('text/plain', String(index));
          onDragStart(index);
        }}
        onDragEnd={onDragEnd}
        style={{
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          color: '#64748b',
          flexShrink: 0,
          padding: '0 2px',
        }}
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
          <circle cx="2" cy="2" r="1.2" />
          <circle cx="6" cy="2" r="1.2" />
          <circle cx="2" cy="7" r="1.2" />
          <circle cx="6" cy="7" r="1.2" />
          <circle cx="2" cy="12" r="1.2" />
          <circle cx="6" cy="12" r="1.2" />
        </svg>
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 'bold',
          flexShrink: 0,
        }}
        data-testid="step-number"
      >
        {step.stepNumber}
      </span>
      {step.thumbnailDataUrl && (
        <img
          src={step.thumbnailDataUrl}
          alt={`Step ${step.stepNumber} thumbnail`}
          style={{ width: '56px', height: '42px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0, border: '1px solid #334155' }}
        />
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#e2e8f0', flex: 1, minWidth: 0 }}>
        {truncatedDesc || 'No description'}
      </span>
      <Tooltip text="Delete step">
        <span
          role="button"
          tabIndex={0}
          data-testid={`delete-step-${step.id}`}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onDelete(step.id);
          }}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onDelete(step.id);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            fontSize: '14px',
            color: '#94a3b8',
            cursor: 'pointer',
            flexShrink: 0,
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s ease, background-color 0.15s ease',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.5 1h5M1 3h14M13 3l-.6 8.4c-.1 1.3-1.1 2.6-2.4 2.6H6c-1.3 0-2.3-1.3-2.4-2.6L3 3M6.5 6v5M9.5 6v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </Tooltip>
    </button>
  );
}
