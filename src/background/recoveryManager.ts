import type { CaptureSession } from '../shared/types';
import { MAX_SESSION_AGE, MAX_SCREENSHOTS_IN_MEMORY } from '../shared/constants';

// ── Storage Keys ────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  SESSION: 'praxis:session',
  SCREENSHOTS: 'praxis:screenshots',
  THUMBNAILS: 'praxis:thumbnails',
} as const;

// ── Save ────────────────────────────────────────────────────────────

/**
 * Save a session to chrome.storage.local, splitting into 3 keys:
 * - metadata (session without screenshot data URLs)
 * - screenshots (last MAX_SCREENSHOTS_IN_MEMORY keyed by stepId)
 * - thumbnails (all steps keyed by stepId)
 */
export async function saveSession(session: CaptureSession): Promise<void> {
  const screenshots: Record<string, string> = {};
  const thumbnails: Record<string, string> = {};

  // Build screenshot/thumbnail maps
  for (const step of session.steps) {
    if (step.screenshotDataUrl) {
      screenshots[step.id] = step.screenshotDataUrl;
    }
    if (step.thumbnailDataUrl) {
      thumbnails[step.id] = step.thumbnailDataUrl;
    }
  }

  // Only keep last MAX_SCREENSHOTS_IN_MEMORY screenshots
  const screenshotKeys = Object.keys(screenshots);
  if (screenshotKeys.length > MAX_SCREENSHOTS_IN_MEMORY) {
    const keysToRemove = screenshotKeys.slice(
      0,
      screenshotKeys.length - MAX_SCREENSHOTS_IN_MEMORY,
    );
    for (const key of keysToRemove) {
      delete screenshots[key];
    }
  }

  // Create metadata copy with screenshotDataUrl stripped
  const metadata: CaptureSession = {
    ...session,
    steps: session.steps.map((step) => ({
      ...step,
      screenshotDataUrl: '',
      thumbnailDataUrl: step.thumbnailDataUrl, // Keep thumbnail ref in metadata
    })),
  };

  await chrome.storage.local.set({
    [STORAGE_KEYS.SESSION]: metadata,
    [STORAGE_KEYS.SCREENSHOTS]: screenshots,
    [STORAGE_KEYS.THUMBNAILS]: thumbnails,
  });
}

// ── Check ───────────────────────────────────────────────────────────

/**
 * Check if a recoverable session exists. Returns metadata only (no screenshots).
 * Used by popup to show recovery prompt.
 */
export async function checkForRecovery(): Promise<CaptureSession | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SESSION);
  const session = result[STORAGE_KEYS.SESSION] as CaptureSession | undefined;
  return session ?? null;
}

// ── Restore ─────────────────────────────────────────────────────────

/**
 * Restore a full session by rehydrating metadata with screenshots and thumbnails.
 */
export async function restoreSession(): Promise<CaptureSession | null> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.SESSION,
    STORAGE_KEYS.SCREENSHOTS,
    STORAGE_KEYS.THUMBNAILS,
  ]);

  const session = result[STORAGE_KEYS.SESSION] as CaptureSession | undefined;
  if (!session) return null;

  const screenshots = (result[STORAGE_KEYS.SCREENSHOTS] ?? {}) as Record<string, string>;
  const thumbnails = (result[STORAGE_KEYS.THUMBNAILS] ?? {}) as Record<string, string>;

  // Rehydrate steps with screenshot data
  session.steps = session.steps.map((step) => ({
    ...step,
    screenshotDataUrl: screenshots[step.id] ?? '',
    thumbnailDataUrl: thumbnails[step.id] ?? step.thumbnailDataUrl,
  }));

  return session;
}

// ── Clear ───────────────────────────────────────────────────────────

/** Remove all recovery data from storage. */
export async function clearRecoveryData(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.SESSION,
    STORAGE_KEYS.SCREENSHOTS,
    STORAGE_KEYS.THUMBNAILS,
  ]);
}

// ── Purge ───────────────────────────────────────────────────────────

/** Clear session data if older than MAX_SESSION_AGE (24h). */
export async function purgeExpiredSessions(): Promise<void> {
  const session = await checkForRecovery();
  if (!session) return;

  const age = Date.now() - session.updatedAt;
  if (age > MAX_SESSION_AGE) {
    await clearRecoveryData();
  }
}
