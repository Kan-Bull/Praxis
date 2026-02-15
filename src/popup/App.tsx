import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { sendMessage } from '../shared/messaging';
import { TabList, type TabItem } from './TabList';

const NON_CAPTURABLE = /^(chrome|chrome-extension|about|edge|brave|moz-extension):/;
const CHROME_WEBSTORE = /^https:\/\/chromewebstore\.google\.com/;

/** Determine if a URL can be captured by the extension. */
export function isCapturableUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (NON_CAPTURABLE.test(url)) return false;
  if (CHROME_WEBSTORE.test(url)) return false;
  return true;
}

export function App() {
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.tabs.query({ currentWindow: true }).then((result) => {
      const capturable = result
        .filter((t) => t.id !== undefined && isCapturableUrl(t.url))
        .map((t) => ({
          id: t.id!,
          title: t.title ?? 'Untitled',
          favIconUrl: t.favIconUrl,
          url: t.url ?? '',
        }));
      setTabs(capturable);
      setLoading(false);
    });
  }, []);

  async function handleSelect(tabId: number): Promise<void> {
    await sendMessage({ type: 'START_CAPTURE', payload: { tabId } });
    window.close();
  }

  async function handleScreenshot(tabId: number): Promise<void> {
    await sendMessage({ type: 'TAKE_SCREENSHOT', payload: { tabId } });
    window.close();
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
        Loading tabs...
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 16px 12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 800,
            color: '#ffffff',
            flexShrink: 0,
          }}
        >
          P
        </div>
        <div>
          <h1 style={{ fontSize: '15px', margin: 0, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>
            Praxis
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
            Capture workflow guides
          </p>
        </div>
      </div>

      {tabs.length === 0 ? (
        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '13px',
            borderRadius: '8px',
            border: '1px dashed #334155',
          }}
        >
          No capturable tabs
        </div>
      ) : (
        <>
          <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Select a tab
          </p>
          <TabList tabs={tabs} onSelect={handleSelect} onScreenshot={handleScreenshot} />
        </>
      )}
    </div>
  );
}
