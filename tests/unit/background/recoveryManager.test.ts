import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveSession,
  checkForRecovery,
  restoreSession,
  clearRecoveryData,
  purgeExpiredSessions,
  STORAGE_KEYS,
} from '../../../src/background/recoveryManager';
import type { CaptureSession, CaptureStep } from '../../../src/shared/types';

// ── Helpers ─────────────────────────────────────────────────────────

function makeStep(overrides: Partial<CaptureStep> = {}): CaptureStep {
  return {
    id: 'step-1',
    stepNumber: 1,
    description: 'Clicked button',
    screenshotDataUrl: 'data:image/jpeg;base64,screenshot-data',
    thumbnailDataUrl: 'data:image/jpeg;base64,thumb-data',
    element: {
      tagName: 'BUTTON',
      textContent: 'Click',
      boundingRect: {
        x: 0, y: 0, width: 100, height: 40,
        top: 0, right: 100, bottom: 40, left: 0,
      },
      isInIframe: false,
    },
    interaction: {
      type: 'click',
      timestamp: Date.now(),
      url: 'https://example.com',
      element: {
        tagName: 'BUTTON',
        textContent: 'Click',
        boundingRect: {
          x: 0, y: 0, width: 100, height: 40,
          top: 0, right: 100, bottom: 40, left: 0,
        },
        isInIframe: false,
      },
    },
    timestamp: Date.now(),
    url: 'https://example.com',
    ...overrides,
  };
}

function makeSession(
  overrides: Partial<CaptureSession> = {},
): CaptureSession {
  return {
    id: 'session-123',
    tabId: 42,
    status: 'capturing',
    title: 'Test Session',
    steps: [makeStep()],
    startUrl: 'https://example.com',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('recoveryManager', () => {
  let storageData: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    storageData = {};

    // Mock storage.local.set to accumulate data
    vi.mocked(chrome.storage.local.set).mockImplementation(async (items) => {
      Object.assign(storageData, items);
    });

    // Mock storage.local.get to return from accumulated data
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      const result: Record<string, unknown> = {};
      const keyList = Array.isArray(keys) ? keys : [keys as string];
      for (const key of keyList) {
        if (key in storageData) {
          result[key] = storageData[key];
        }
      }
      return result;
    });

    // Mock storage.local.remove
    vi.mocked(chrome.storage.local.remove).mockImplementation(async (keys) => {
      const keyList = Array.isArray(keys) ? keys : [keys as string];
      for (const key of keyList) {
        delete storageData[key];
      }
    });
  });

  // ── Storage Keys ──────────────────────────────────────────────────

  describe('STORAGE_KEYS', () => {
    it('should expose 3 storage keys', () => {
      expect(STORAGE_KEYS.SESSION).toBe('praxis:session');
      expect(STORAGE_KEYS.SCREENSHOTS).toBe('praxis:screenshots');
      expect(STORAGE_KEYS.THUMBNAILS).toBe('praxis:thumbnails');
    });
  });

  // ── saveSession ───────────────────────────────────────────────────

  describe('saveSession', () => {
    it('should split session into metadata + screenshots + thumbnails', async () => {
      const session = makeSession();
      await saveSession(session);

      expect(chrome.storage.local.set).toHaveBeenCalled();

      // Metadata should exist without screenshotDataUrl
      const metadata = storageData[STORAGE_KEYS.SESSION] as CaptureSession;
      expect(metadata.id).toBe('session-123');
      expect(metadata.steps[0].screenshotDataUrl).toBe('');
    });

    it('should store screenshots keyed by stepId', async () => {
      const session = makeSession({
        steps: [
          makeStep({ id: 'step-a', screenshotDataUrl: 'data:image/jpeg;base64,aaa' }),
          makeStep({ id: 'step-b', screenshotDataUrl: 'data:image/jpeg;base64,bbb' }),
        ],
      });
      await saveSession(session);

      const screenshots = storageData[STORAGE_KEYS.SCREENSHOTS] as Record<string, string>;
      expect(screenshots['step-a']).toBe('data:image/jpeg;base64,aaa');
      expect(screenshots['step-b']).toBe('data:image/jpeg;base64,bbb');
    });

    it('should store thumbnails keyed by stepId', async () => {
      const session = makeSession({
        steps: [
          makeStep({ id: 'step-a', thumbnailDataUrl: 'data:image/jpeg;base64,ta' }),
        ],
      });
      await saveSession(session);

      const thumbnails = storageData[STORAGE_KEYS.THUMBNAILS] as Record<string, string>;
      expect(thumbnails['step-a']).toBe('data:image/jpeg;base64,ta');
    });

    it('should only keep last 20 screenshots', async () => {
      const steps = Array.from({ length: 25 }, (_, i) =>
        makeStep({
          id: `step-${i}`,
          stepNumber: i + 1,
          screenshotDataUrl: `data:image/jpeg;base64,img${i}`,
          thumbnailDataUrl: `data:image/jpeg;base64,thumb${i}`,
        }),
      );
      const session = makeSession({ steps });
      await saveSession(session);

      const screenshots = storageData[STORAGE_KEYS.SCREENSHOTS] as Record<string, string>;
      const screenshotKeys = Object.keys(screenshots);
      expect(screenshotKeys).toHaveLength(20);
      // Should keep the LAST 20 (steps 5-24)
      expect(screenshots['step-5']).toBeDefined();
      expect(screenshots['step-24']).toBeDefined();
      expect(screenshots['step-4']).toBeUndefined();

      // But thumbnails should include ALL steps
      const thumbnails = storageData[STORAGE_KEYS.THUMBNAILS] as Record<string, string>;
      expect(Object.keys(thumbnails)).toHaveLength(25);
    });
  });

  // ── checkForRecovery ──────────────────────────────────────────────

  describe('checkForRecovery', () => {
    it('should return null when no session is stored', async () => {
      const result = await checkForRecovery();
      expect(result).toBeNull();
    });

    it('should return session metadata when present', async () => {
      const session = makeSession();
      await saveSession(session);

      const result = await checkForRecovery();
      expect(result).not.toBeNull();
      expect(result!.id).toBe('session-123');
      expect(result!.title).toBe('Test Session');
    });

    it('should return metadata WITHOUT full screenshot data', async () => {
      const session = makeSession();
      await saveSession(session);

      const result = await checkForRecovery();
      // Steps should have empty screenshotDataUrl (metadata only)
      expect(result!.steps[0].screenshotDataUrl).toBe('');
    });
  });

  // ── restoreSession ────────────────────────────────────────────────

  describe('restoreSession', () => {
    it('should return null when no session is stored', async () => {
      const result = await restoreSession();
      expect(result).toBeNull();
    });

    it('should rehydrate session with screenshots and thumbnails', async () => {
      const session = makeSession({
        steps: [
          makeStep({
            id: 'step-a',
            screenshotDataUrl: 'data:image/jpeg;base64,full',
            thumbnailDataUrl: 'data:image/jpeg;base64,thumb',
          }),
        ],
      });
      await saveSession(session);

      const restored = await restoreSession();
      expect(restored).not.toBeNull();
      expect(restored!.steps[0].screenshotDataUrl).toBe('data:image/jpeg;base64,full');
      expect(restored!.steps[0].thumbnailDataUrl).toBe('data:image/jpeg;base64,thumb');
    });

    it('should handle missing screenshot gracefully', async () => {
      await saveSession(makeSession());
      // Remove screenshots storage
      delete storageData[STORAGE_KEYS.SCREENSHOTS];

      const restored = await restoreSession();
      expect(restored).not.toBeNull();
      expect(restored!.steps[0].screenshotDataUrl).toBe('');
    });
  });

  // ── clearRecoveryData ─────────────────────────────────────────────

  describe('clearRecoveryData', () => {
    it('should remove all 3 storage keys', async () => {
      await saveSession(makeSession());
      expect(Object.keys(storageData).length).toBeGreaterThan(0);

      await clearRecoveryData();
      expect(chrome.storage.local.remove).toHaveBeenCalledWith([
        STORAGE_KEYS.SESSION,
        STORAGE_KEYS.SCREENSHOTS,
        STORAGE_KEYS.THUMBNAILS,
      ]);
    });
  });

  // ── purgeExpiredSessions ──────────────────────────────────────────

  describe('purgeExpiredSessions', () => {
    it('should clear session older than MAX_SESSION_AGE', async () => {
      const oldSession = makeSession({
        startedAt: Date.now() - 86_400_001, // Just over 24 hours
        updatedAt: Date.now() - 86_400_001,
      });
      await saveSession(oldSession);

      await purgeExpiredSessions();

      // Should have called remove
      expect(chrome.storage.local.remove).toHaveBeenCalledWith([
        STORAGE_KEYS.SESSION,
        STORAGE_KEYS.SCREENSHOTS,
        STORAGE_KEYS.THUMBNAILS,
      ]);
    });

    it('should NOT clear recent session', async () => {
      const recentSession = makeSession({
        startedAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
      });
      await saveSession(recentSession);

      // Clear the remove mock from saveSession
      vi.mocked(chrome.storage.local.remove).mockClear();

      await purgeExpiredSessions();
      expect(chrome.storage.local.remove).not.toHaveBeenCalled();
    });

    it('should not throw when no session exists', async () => {
      await expect(purgeExpiredSessions()).resolves.not.toThrow();
    });
  });
});
