import { h } from 'preact';

export interface TabItem {
  id: number;
  title: string;
  favIconUrl?: string;
  url: string;
}

interface TabListProps {
  tabs: TabItem[];
  onSelect: (tabId: number) => void;
  onScreenshot: (tabId: number) => void;
}

function getHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function TabList({ tabs, onSelect, onScreenshot }: TabListProps) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {tabs.map((tab) => (
        <li
          key={tab.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '10px 12px 8px',
            border: '1px solid #1e293b',
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '10px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'rgba(59, 130, 246, 0.06)';
            el.style.borderColor = '#334155';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'rgba(255, 255, 255, 0.04)';
            el.style.borderColor = '#1e293b';
          }}
        >
          {/* Row 1: Tab identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            {/* Favicon */}
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '5px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {tab.favIconUrl ? (
                <img
                  src={tab.favIconUrl}
                  alt=""
                  width={14}
                  height={14}
                  style={{ display: 'block' }}
                />
              ) : (
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  {(tab.title || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Title + host */}
            <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: '#e2e8f0',
                  fontSize: '13px',
                  lineHeight: '1.3',
                }}
              >
                {tab.title || 'Untitled'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.3', marginTop: '1px' }}>
                {getHost(tab.url)}
              </div>
            </div>
          </div>

          {/* Row 2: Actions */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {/* Capture Workflow */}
            <button
              type="button"
              data-testid={`capture-tab-${tab.id}`}
              title="Record a step-by-step workflow guide"
              onClick={() => onSelect(tab.id)}
              style={{
                flex: 1,
                padding: '6px 0',
                border: 'none',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'inherit',
                lineHeight: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'opacity 0.12s ease, box-shadow 0.12s ease',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.boxShadow = '0 0 12px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.boxShadow = 'none';
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="8" r="5" fill="#ffffff" fill-opacity="0.9" />
              </svg>
              Capture Workflow
            </button>

            {/* Screenshot */}
            <button
              type="button"
              data-testid={`screenshot-tab-${tab.id}`}
              title="Take a single screenshot of this tab"
              onClick={() => onScreenshot(tab.id)}
              style={{
                flex: 1,
                padding: '6px 0',
                border: 'none',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'inherit',
                lineHeight: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'opacity 0.12s ease, box-shadow 0.12s ease',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.boxShadow = '0 0 12px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.boxShadow = 'none';
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M5.5 2L4.5 3.5H2.5C1.95 3.5 1.5 3.95 1.5 4.5V12.5C1.5 13.05 1.95 13.5 2.5 13.5H13.5C14.05 13.5 14.5 13.05 14.5 12.5V4.5C14.5 3.95 14.05 3.5 13.5 3.5H11.5L10.5 2H5.5Z"
                  stroke="#ffffff"
                  stroke-width="1.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <circle cx="8" cy="8.5" r="2.5" stroke="#ffffff" stroke-width="1.2" />
              </svg>
              Screenshot
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
