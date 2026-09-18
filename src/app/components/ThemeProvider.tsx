import { useEffect } from 'react';

/* ─── Theme Definitions ─── */
export interface ThemeDef {
  key: string;
  name: string;
  description: string;
  palette: [string, string, string, string, string]; // 5 swatches
  primary: string;
  secondary: string;
  navGradient: string;
  text: string;
  cardBg: string;
  surface: string;
  buttonHover: string;
}

export const THEMES: ThemeDef[] = [
  {
    key: 'twilight-sage',
    name: 'twilight sage',
    description: 'sage green meets soft lavender - the current default vibe',
    palette: ['#7BA89D', '#B8A9D4', '#D4A0A0', '#6B5B8A', '#F4F1ED'],
    primary: '#7BA89D',
    secondary: '#B8A9D4',
    navGradient: 'linear-gradient(135deg, #7BA89D, #B8A9D4)',
    text: '#2D2438',
    cardBg: '#F4F1ED',
    surface: '#FAF8F5',
    buttonHover: '#5F8D82',
  },
  {
    key: 'create-well-classic',
    name: 'create well classic',
    description: 'the original warm terracotta brand from the brand board with desert canyon energy',
    palette: ['#FFDEC2', '#E8AF93', '#C25B38', '#D4A771', '#EAE5D8'],
    primary: '#C25B38',
    secondary: '#D4A771',
    navGradient: 'linear-gradient(135deg, #C25B38, #D4A771)',
    text: '#3D2B1F',
    cardBg: '#EAE5D8',
    surface: '#F2EDE6',
    buttonHover: '#A84D2E',
  },
  {
    key: 'muse-in-motion',
    name: 'muse in motion',
    description: "bingle's brand - soft lavender meets warm cognac, deep plum accents, elegant serif energy",
    palette: ['#C4B8D9', '#C4894D', '#4A2840', '#B5BAA8', '#DDD8CA'],
    primary: '#C4894D',
    secondary: '#C4B8D9',
    navGradient: 'linear-gradient(135deg, #4A2840, #C4B8D9)',
    text: '#4A2840',
    cardBg: '#DDD8CA',
    surface: '#E8E4D8',
    buttonHover: '#A87340',
  },
  {
    key: 'monshiniverse',
    name: 'monshiniverse',
    description: 'the cosmic trio blend - charcoal plum base with all three founder colors woven in',
    palette: ['#2D2438', '#7BA89D', '#E8C875', '#C1694F', '#F4F1ED'],
    primary: '#E8C875',
    secondary: '#7BA89D',
    navGradient: 'linear-gradient(135deg, #2D2438, #7BA89D)',
    text: '#2D2438',
    cardBg: '#F4F1ED',
    surface: '#FAF8F5',
    buttonHover: '#D4B560',
  },
];

const STORAGE_KEY = 'cr8w_theme';

export function getStoredThemeKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'twilight-sage';
  } catch {
    return 'twilight-sage';
  }
}

export function getTheme(key: string): ThemeDef {
  return THEMES.find(t => t.key === key) || THEMES[0];
}

/** Parse hex color to R,G,B string for use in rgba() */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

/** Apply theme CSS custom properties to :root */
export function applyTheme(theme: ThemeDef) {
  const root = document.documentElement;
  root.style.setProperty('--cr8w-primary', theme.primary);
  root.style.setProperty('--cr8w-secondary', theme.secondary);
  root.style.setProperty('--cr8w-nav-gradient', theme.navGradient);
  root.style.setProperty('--cr8w-text', theme.text);
  root.style.setProperty('--cr8w-card-bg', theme.cardBg);
  root.style.setProperty('--cr8w-surface', theme.surface);
  root.style.setProperty('--cr8w-btn-hover', theme.buttonHover);

  // RGB component variables for rgba() usage in inline styles
  root.style.setProperty('--cr8w-primary-rgb', hexToRgb(theme.primary));
  root.style.setProperty('--cr8w-secondary-rgb', hexToRgb(theme.secondary));
  root.style.setProperty('--cr8w-text-rgb', hexToRgb(theme.text));

  // Also update the existing variables that components already reference
  root.style.setProperty('--bg-main', theme.surface);
  root.style.setProperty('--bg-card', theme.cardBg);
  root.style.setProperty('--bg-warm', theme.cardBg);
  root.style.setProperty('--text-primary', theme.text);
  root.style.setProperty('--deep-rust', theme.primary);
  root.style.setProperty('--geyser-accent', theme.primary);

  // Enable crossfade transition class
  if (!root.classList.contains('cr8w-theme-transitioning')) {
    root.classList.add('cr8w-theme-transitioning');
    setTimeout(() => root.classList.remove('cr8w-theme-transitioning'), 450);
  }
}

export function setTheme(key: string) {
  const theme = getTheme(key);
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {}
  applyTheme(theme);
  // Notify other components
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: key }));
}

/**
 * Hook: initializes theme on mount from localStorage.
 * Place this once in your App root.
 */
export function useThemeInit() {
  useEffect(() => {
    const key = getStoredThemeKey();
    const theme = getTheme(key);
    applyTheme(theme);
  }, []);
}