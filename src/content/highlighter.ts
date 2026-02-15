import type { BoundingRectLike } from '../shared/types';
import { HIGHLIGHT_DURATION, TOOLBAR_Z_INDEX } from '../shared/constants';

/** Flash a semi-transparent overlay on the clicked element's bounding rect. */
export function flashHighlight(rect: BoundingRectLike): void {
  const overlay = document.createElement('div');
  overlay.dataset.praxisHighlight = '';
  overlay.style.position = 'fixed';
  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.background = 'rgba(59, 130, 246, 0.15)';
  overlay.style.border = '2px solid rgba(59, 130, 246, 0.6)';
  overlay.style.borderRadius = '3px';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = String(TOOLBAR_Z_INDEX - 1);
  overlay.style.transition = `opacity ${HIGHLIGHT_DURATION}ms ease-out`;
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), HIGHLIGHT_DURATION);
  }, 0);
}
