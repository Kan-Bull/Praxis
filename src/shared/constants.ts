// ── Capture Limits ──────────────────────────────────────────────────
export const MAX_STEPS = 100;
export const STEP_WARNING_THRESHOLD = 75;

// ── Screenshot ──────────────────────────────────────────────────────
export const MAX_WIDTH = 3840;
export const JPEG_QUALITY = 0.85;
export const THUMBNAIL_WIDTH = 320;

// ── Text Processing ─────────────────────────────────────────────────
export const TRUNCATE_LENGTH = 50;
export const DESCRIPTION_MAX = 200;
export const DESCRIPTION_RICH_MAX = 2000;
export const SANITIZE_MAX = 200;

// ── Timing (ms) ─────────────────────────────────────────────────────
export const HEARTBEAT_INTERVAL = 25_000;
export const INPUT_DEBOUNCE = 500;
export const AUTOSAVE_INTERVAL = 30_000;
export const MUTATION_SETTLE_TIME = 400;
export const MUTATION_MAX_WAIT = 3_000;
export const FIXED_DELAY = 500;

// ── Recovery ────────────────────────────────────────────────────────
export const MAX_SESSION_AGE = 86_400_000; // 24 hours
export const MAX_SCREENSHOTS_IN_MEMORY = 20;

// ── UI ──────────────────────────────────────────────────────────────
export const TOOLBAR_Z_INDEX = 2_147_483_647;
export const HIGHLIGHT_DURATION = 300;
export const BLUR_MIN_BLOCK_SIZE = 10;

// ── Editor ─────────────────────────────────────────────────────────
export const SCREENSHOT_LRU_SIZE = 10;
export const ANNOTATION_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#000000'] as const;

// ── Export ──────────────────────────────────────────────────────
export const EXPORT_FILENAME_PREFIX = 'praxis-guide';
