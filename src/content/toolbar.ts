import { sendMessage } from '../shared/messaging';
import { TOOLBAR_CSS } from './toolbar.css';

/** Append element to body, waiting for it to exist if needed. */
export function appendToBody(el: HTMLElement): void {
  if (document.body) {
    document.body.appendChild(el);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(el);
    });
  }
}

export interface ToolbarHandle {
  host: HTMLElement;
  show: () => void;
  hide: () => void;
  hideForScreenshot: () => void;
  showAfterScreenshot: () => void;

  destroy: () => void;
  setStepCount: (n: number) => void;
  setPosition: (x: number, y: number) => void;
}

/** Create the Praxis capture toolbar inside a closed Shadow DOM. */
export function createToolbar(
  onStop?: () => void,
  onCancel?: () => void,
): ToolbarHandle {
  const host = document.createElement('div');
  host.id = 'praxis-toolbar';
  const shadow = host.attachShadow({ mode: 'closed' });

  // Apply styles — feature-detect adoptedStyleSheets
  if (shadow.adoptedStyleSheets !== undefined) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(TOOLBAR_CSS);
      shadow.adoptedStyleSheets = [sheet];
    } catch {
      // Fallback
      appendStyleElement(shadow);
    }
  } else {
    appendStyleElement(shadow);
  }

  // Build toolbar DOM
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  const brand = document.createElement('span');
  brand.className = 'brand';
  brand.textContent = 'Praxis';

  const stepCount = document.createElement('span');
  stepCount.className = 'step-count';
  stepCount.textContent = 'Step 0';

  const stopBtn = document.createElement('button');
  stopBtn.className = 'stop-btn';
  stopBtn.textContent = 'Stop';
  stopBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    sendMessage({ type: 'STOP_CAPTURE', payload: {} as Record<string, never> });
    onStop?.();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    sendMessage({ type: 'CANCEL_CAPTURE', payload: {} as Record<string, never> });
    onCancel?.();
  });

  toolbar.append(brand, stepCount, stopBtn, cancelBtn);
  shadow.appendChild(toolbar);

  // ── Drag handling ────────────────────────────────────────────────
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function onMouseDown(e: MouseEvent): void {
    // Don't drag when clicking buttons
    if ((e.target as HTMLElement)?.tagName === 'BUTTON') return;

    isDragging = true;
    dragOffsetX = e.clientX - host.getBoundingClientRect().left;
    dragOffsetY = e.clientY - host.getBoundingClientRect().top;
    toolbar.classList.add('dragging');
    e.preventDefault();
  }

  function onMouseMove(e: MouseEvent): void {
    if (!isDragging) return;

    const x = Math.max(0, Math.min(e.clientX - dragOffsetX, window.innerWidth - host.offsetWidth));
    const y = Math.max(0, Math.min(e.clientY - dragOffsetY, window.innerHeight - host.offsetHeight));

    host.style.left = `${x}px`;
    host.style.top = `${y}px`;
    host.classList.add('positioned');
  }

  function onMouseUp(): void {
    if (!isDragging) return;
    isDragging = false;
    toolbar.classList.remove('dragging');

    // Save position to background
    const rect = host.getBoundingClientRect();
    sendMessage({
      type: 'SAVE_TOOLBAR_POSITION',
      payload: { x: rect.left, y: rect.top },
    }).catch(() => {
      // Extension context may be invalidated — ignore
    });
  }

  toolbar.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  function applyPosition(x: number, y: number): void {
    host.style.left = `${x}px`;
    host.style.top = `${y}px`;
    host.classList.add('positioned');
  }

  return {
    host,
    show() {
      host.style.display = '';
    },
    hide() {
      host.style.display = 'none';
    },
    hideForScreenshot() {
      host.style.opacity = '0';
      host.style.visibility = 'hidden';
      host.style.pointerEvents = 'none';
    },
    showAfterScreenshot() {
      host.style.opacity = '';
      host.style.visibility = '';
      host.style.pointerEvents = '';
    },
    destroy() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      host.remove();
    },
    setStepCount(n: number) {
      stepCount.textContent = `Step ${n}`;
    },
    setPosition: applyPosition,
  };
}

function appendStyleElement(shadow: ShadowRoot): void {
  const style = document.createElement('style');
  style.textContent = TOOLBAR_CSS;
  shadow.appendChild(style);
}
