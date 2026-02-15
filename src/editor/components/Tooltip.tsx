import { h, ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useState, useRef, useCallback, useLayoutEffect } from 'preact/hooks';

const TOOLTIP_DELAY = 400;
const VIEWPORT_PADDING = 8;

interface TooltipProps {
  text: string;
  children: ComponentChildren;
  /** Use block display (full width) instead of inline-flex. */
  block?: boolean;
}

export function Tooltip({ text, children, block }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, caretLeft: '50%' });

  const handleMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, TOOLTIP_DELAY);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  // Position tooltip using fixed coords, clamped to viewport — runs before paint
  useLayoutEffect(() => {
    if (!visible || !wrapperRef.current || !tooltipRef.current) return;
    const wr = wrapperRef.current.getBoundingClientRect();
    const tr = tooltipRef.current.getBoundingClientRect();
    const centerX = wr.left + wr.width / 2;

    let left = centerX - tr.width / 2;
    if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;
    if (left + tr.width > window.innerWidth - VIEWPORT_PADDING) {
      left = window.innerWidth - VIEWPORT_PADDING - tr.width;
    }

    const top = wr.top - tr.height - 6;
    const caretPx = centerX - left;
    setPos({ top, left, caretLeft: `${caretPx}px` });
  }, [visible]);

  return (
    <span
      ref={wrapperRef}
      data-testid="tooltip-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={block ? { display: 'flex', width: '100%' } : { display: 'inline-flex' }}
    >
      {children}
      {visible && createPortal(
        <span
          ref={tooltipRef}
          data-testid="tooltip"
          style={{
            position: 'fixed',
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            padding: '5px 10px',
            backgroundColor: '#0f172a',
            color: '#e2e8f0',
            fontSize: '11px',
            fontWeight: 500,
            borderRadius: '6px',
            border: '1px solid #334155',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          }}
        >
          {text}
          {/* Caret arrow — positioned at wrapper center */}
          <span
            style={{
              position: 'absolute',
              top: '100%',
              left: pos.caretLeft,
              transform: 'translateX(-50%)',
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid #334155',
            }}
          />
          <span
            style={{
              position: 'absolute',
              top: '100%',
              left: pos.caretLeft,
              transform: 'translateX(-50%)',
              marginTop: '-1px',
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '4px solid #0f172a',
            }}
          />
        </span>,
        document.body,
      )}
    </span>
  );
}
