import { h } from 'preact';
import { useState, useRef, useCallback } from 'preact/hooks';
import type { CaptureStep } from '../../shared/types';
import { StepCard } from './StepCard';

export interface TimelineProps {
  steps: CaptureStep[];
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;
  onReorderStep: (fromIndex: number, toIndex: number) => void;
}

export function Timeline({ steps, selectedStepId, onSelectStep, onDeleteStep, onReorderStep }: TimelineProps) {
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((index: number) => {
    setDragFromIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragFromIndex(null);
    setDropTargetIndex(null);
  }, []);

  const handleDragOver = useCallback(
    (e: DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';

      // Determine whether to drop above or below based on mouse position
      const target = (e.currentTarget as HTMLElement);
      const rect = target.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertAt = e.clientY < midY ? index : index + 1;

      setDropTargetIndex(insertAt);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (dragFromIndex !== null && dropTargetIndex !== null && dragFromIndex !== dropTargetIndex && dragFromIndex !== dropTargetIndex - 1) {
        // Adjust target index: if dragging downward, the removal of the source
        // shifts everything above the target down by one
        const adjustedTarget = dropTargetIndex > dragFromIndex ? dropTargetIndex - 1 : dropTargetIndex;
        onReorderStep(dragFromIndex, adjustedTarget);
      }
      setDragFromIndex(null);
      setDropTargetIndex(null);
    },
    [dragFromIndex, dropTargetIndex, onReorderStep],
  );

  const handleContainerDragLeave = useCallback((e: DragEvent) => {
    // Only clear if leaving the container entirely
    if (listRef.current && !listRef.current.contains(e.relatedTarget as Node)) {
      setDropTargetIndex(null);
    }
  }, []);

  if (steps.length === 0) {
    return (
      <div
        style={{ padding: '16px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}
        data-testid="empty-timeline"
      >
        No steps captured
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      data-testid="timeline"
    >
      <div
        style={{
          padding: '12px 12px 8px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#64748b',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          borderBottom: '1px solid #1e293b',
        }}
      >
        Steps ({steps.length})
      </div>
      <div
        ref={listRef}
        style={{ overflowY: 'auto', padding: '8px', flex: 1 }}
        onDrop={handleDrop}
        onDragLeave={handleContainerDragLeave}
      >
        {steps.map((step, i) => (
          <div key={step.id}>
            {dropTargetIndex === i && dragFromIndex !== null && dragFromIndex !== i && dragFromIndex !== i - 1 && (
              <div
                data-testid="drop-indicator"
                style={{
                  height: '2px',
                  background: '#3b82f6',
                  borderRadius: '1px',
                  margin: '2px 0',
                }}
              />
            )}
            <div
              onDragOver={(e: DragEvent) => handleDragOver(e, i)}
              style={{ opacity: dragFromIndex === i ? 0.4 : 1 }}
            >
              <StepCard
                key={step.id}
                step={step}
                isSelected={step.id === selectedStepId}
                onSelect={onSelectStep}
                onDelete={onDeleteStep}
                index={i}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            </div>
          </div>
        ))}
        {/* Drop indicator after the last card */}
        {dropTargetIndex === steps.length && dragFromIndex !== null && dragFromIndex !== steps.length - 1 && (
          <div
            data-testid="drop-indicator"
            style={{
              height: '2px',
              background: '#3b82f6',
              borderRadius: '1px',
              margin: '2px 0',
            }}
          />
        )}
      </div>
    </div>
  );
}
