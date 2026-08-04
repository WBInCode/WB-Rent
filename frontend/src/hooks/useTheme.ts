import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'wb-rent-theme';

const readTheme = (): Theme => {
  if (typeof document === 'undefined') return 'dark';
  // The inline bootstrap in index.html already resolved this before paint.
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
};

/**
 * Light/dark theme with an explicit user choice persisted in localStorage.
 * Until the user picks one, the OS preference is followed live.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  const applyTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute('data-theme', next);
    setThemeState(next);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode - the theme still applies for this session.
    }
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    setTheme(readTheme() === 'light' ? 'dark' : 'light');
  }, [setTheme]);

  // Follow the OS only while the visitor has not chosen a theme themselves.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (event: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(STORAGE_KEY);
      } catch {
        stored = null;
      }
      if (stored === 'light' || stored === 'dark') return;
      applyTheme(event.matches ? 'light' : 'dark');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [applyTheme]);

  return { theme, setTheme, toggleTheme };
}
