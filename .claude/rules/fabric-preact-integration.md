---
globs: ["src/editor/**/*.tsx","src/editor/**/*.ts"]
---

## Fabric.js + Preact/React VDOM Desync

- Fabric.js wraps `<canvas>` in a `.canvas-container` div on init, moving it out of its original DOM position
- If the canvas is rendered via JSX, Preact's VDOM loses track of it → `insertBefore` NotFoundError on re-render
- **Fix**: Never render `<canvas>` in JSX when using Fabric.js. Render an empty `<div ref={hostRef} />` and create the canvas imperatively via `document.createElement('canvas')` + `hostRef.current.appendChild(el)`
- Preact sees the host div as having zero VDOM children, so Fabric.js can mutate freely inside it
- Same pattern applies to any imperative DOM library (D3, Konva, etc.) used with virtual DOM frameworks
