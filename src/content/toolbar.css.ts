import { TOOLBAR_Z_INDEX } from '../shared/constants';

export const TOOLBAR_CSS = `
  :host {
    all: initial;
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: ${TOOLBAR_Z_INDEX};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: #1e293b;
    color: #f1f5f9;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    font-size: 13px;
    user-select: none;
    cursor: grab;
  }

  .toolbar.dragging {
    cursor: grabbing;
  }

  :host(.positioned) {
    transform: none;
  }

  .brand {
    font-weight: 700;
    color: #60a5fa;
    margin-right: 4px;
  }

  .step-count {
    color: #94a3b8;
    min-width: 50px;
  }

  button {
    border: none;
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  button:hover {
    opacity: 0.85;
  }

  .stop-btn {
    background: #22c55e;
    color: #fff;
  }

  .cancel-btn {
    background: #ef4444;
    color: #fff;
  }
`;
