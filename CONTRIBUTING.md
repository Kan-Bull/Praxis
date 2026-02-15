# Contributing to Praxis

Thanks for your interest in contributing! Praxis is a privacy-first Chrome extension for capturing workflow guides, and contributions are welcome.

## Getting Started

```bash
git clone https://github.com/Kan-Bull/Praxis.git
cd Praxis
npm install
```

## Development

```bash
npm run dev          # Build in watch mode (rebuilds on file changes)
npm run build        # Production build (includes type check)
npm test             # Run all unit tests
npm run test:watch   # Run tests in watch mode
npm run typecheck    # Type check only
npm run lint         # ESLint
npm run format       # Prettier
```

### Loading the extension locally

1. Run `npm run build` (or `npm run dev` for watch mode)
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `dist/` folder
5. After code changes, click the reload button on the extension card

### Running tests

All tests must pass before submitting a PR:

```bash
npm test             # 654+ unit tests via Vitest
npm run typecheck    # TypeScript strict mode
npm run lint         # ESLint
```

## Project Structure

```
src/
  shared/        # Types, constants, sanitization, PII detection, messaging
  background/    # Service worker: capture pipeline, screenshots, recovery
  content/       # Content script: click/form tracking, toolbar, DOM observation
  popup/         # Extension popup: session controls, tab list
  editor/        # Annotation editor: Fabric.js canvas, tools, export
tests/
  unit/          # Unit tests (mirrors src/ structure)
```

## Guidelines

### Code style

- TypeScript strict mode (`strict: true`)
- Prettier for formatting, ESLint for linting
- Preact (not React) for UI components

### Privacy is non-negotiable

Praxis makes a hard promise: **zero network requests, ever**. Any PR that introduces network calls, analytics, telemetry, or external dependencies that phone home will be rejected. The CSP (`connect-src data:`) enforces this at the browser level.

### Sensitive data handling

- All form field values must pass through `sensitiveFieldDetector.ts` before being stored
- New field types that could contain PII must be added to `SENSITIVE_PATTERNS`
- The blur tool must remain destructive (pixel modification, not overlay)
- URL parameters must be scrubbed via `redactUrlParams()`

### Testing

- Add tests for new functionality
- Tests live in `tests/unit/` mirroring the `src/` directory structure
- Use Vitest with jsdom environment
- Mock Chrome APIs via `globalThis.chrome` in test setup

### Commits

- Keep commits focused on a single change
- Write clear commit messages describing what and why

## Submitting a Pull Request

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Ensure all tests pass (`npm test`)
4. Ensure type checking passes (`npm run typecheck`)
5. Ensure linting passes (`npm run lint`)
6. Open a PR against `main` with a clear description of the change

## Reporting Issues

Use [GitHub Issues](https://github.com/Kan-Bull/Praxis/issues) with the provided templates. Include:

- Browser version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## License

By contributing, you agree that your contributions will be licensed under the [ISC License](LICENSE).
