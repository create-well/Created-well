import React, { useState, useEffect } from 'react';
import { THEMES, getStoredThemeKey, setTheme, getTheme } from './ThemeProvider';
import type { ThemeDef } from './ThemeProvider';

export function ThemeSelector() {
  const [activeKey, setActiveKey] = useState(getStoredThemeKey);

  // Listen for external theme changes
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'cr8w_theme' && e.newValue) setActiveKey(e.newValue);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  function selectTheme(key: string) {
    setActiveKey(key);
    setTheme(key);
  }

  const activeTheme = getTheme(activeKey);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Section title */}
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: '0.88rem',
          color: 'var(--cr8w-text, #2D2438)',
          marginBottom: 1,
        }}>
          your aesthetic {'\uD83C\uDFA8'}
        </div>
      </div>

      {/* Theme cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {THEMES.map(theme => {
          const isActive = theme.key === activeKey;
          return (
            <button
              key={theme.key}
              onClick={() => selectTheme(theme.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                border: isActive
                  ? `2px solid ${theme.primary}`
                  : '2px solid transparent',
                background: isActive
                  ? `${theme.primary}12`
                  : 'rgba(45,36,56,0.03)',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                width: '100%',
                textAlign: 'left',
              }}
            >
              {/* Palette circles */}
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                {theme.palette.map((color, i) => (
                  <span
                    key={i}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: color,
                      border: color === '#F4F1ED' || color === '#EAE5D8' || color === '#DDD8CA' || color === '#FFDEC2'
                        ? '1px solid rgba(0,0,0,0.1)'
                        : '1px solid rgba(0,0,0,0.05)',
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>

              {/* Theme name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "var(--font-display)",
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--cr8w-text, #2D2438)',
                  lineHeight: 1.3,
                }}>
                  {theme.name}
                </div>
                <div style={{
                  fontFamily: "var(--font-label)",
                  fontSize: '0.58rem',
                  color: 'var(--text-muted, #6B5F7A)',
                  lineHeight: 1.3,
                  marginTop: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {theme.description}
                </div>
              </div>

              {/* Check icon */}
              {isActive && (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={theme.primary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Preview strip */}
      <PreviewStrip theme={activeTheme} />

      {/* Coming soon teaser */}
      <div style={{
        textAlign: 'center',
        marginTop: 8,
        fontFamily: "var(--font-label)",
        fontSize: '0.68rem',
        fontStyle: 'italic',
        color: 'var(--cr8w-text, #2D2438)',
        opacity: 0.4,
      }}>
        coming soon: build your own IndividiWell palette
      </div>
    </div>
  );
}

function PreviewStrip({ theme }: { theme: ThemeDef }) {
  const items: { label: string; bg: string; border?: string }[] = [
    { label: 'nav', bg: theme.navGradient },
    { label: 'card', bg: theme.cardBg, border: '1px solid rgba(0,0,0,0.08)' },
    { label: 'button', bg: theme.primary },
    { label: 'text', bg: theme.text },
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 8,
      padding: '6px 0',
    }}>
      <span style={{
        fontFamily: "var(--font-label)",
        fontSize: '0.58rem',
        color: 'var(--text-muted, #6B5F7A)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        flexShrink: 0,
      }}>
        preview:
      </span>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{
            width: 36,
            height: 14,
            borderRadius: 4,
            background: item.bg,
            border: item.border || 'none',
          }} />
          <span style={{
            fontFamily: "var(--font-label)",
            fontSize: '0.5rem',
            color: 'var(--text-muted, #6B5F7A)',
            lineHeight: 1,
          }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}