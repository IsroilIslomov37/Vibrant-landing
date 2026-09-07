'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Locale, SiteContent } from '@/lib/types';
import { ui, type UIKey } from '@/lib/i18n';
import { t as translate } from '@/lib/utils';
import type { LocalizedText } from '@/lib/types';

type Theme = 'light' | 'dark';

interface SiteContextValue {
  content: SiteContent;
  setContent: (content: SiteContent) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  theme: Theme;
  toggleTheme: () => void;
  /** Bilingual content field -> string in the active locale. */
  tx: (value: LocalizedText | undefined) => string;
  /** UI chrome dictionary lookup. */
  ts: (key: UIKey) => string;
  /** Global application modal, opened from every "Enroll" surface. */
  applyOpen: boolean;
  openApply: (courseId?: string) => void;
  closeApply: () => void;
  applyCourseId: string | null;
}

const SiteContext = createContext<SiteContextValue | null>(null);

const LOCALE_KEY = 'vs.locale';
const THEME_KEY = 'vs.theme';

export function SiteProvider({
  initialContent,
  children,
}: {
  initialContent: SiteContent;
  children: React.ReactNode;
}) {
  const [content, setContent] = useState<SiteContent>(initialContent);
  const [locale, setLocaleState] = useState<Locale>('ru');
  const [theme, setTheme] = useState<Theme>('dark');
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyCourseId, setApplyCourseId] = useState<string | null>(null);

  // Restore preferences on mount. The inline script in <head> has already set the
  // theme class, so this only syncs React state with what is on screen.
  useEffect(() => {
    try {
      const storedLocale = window.localStorage.getItem(LOCALE_KEY) as Locale | null;
      if (storedLocale === 'ru' || storedLocale === 'en') setLocaleState(storedLocale);
      else if (navigator.language.startsWith('en')) setLocaleState('en');
    } catch {
      /* storage can be blocked — defaults are fine */
    }
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const openApply = useCallback((courseId?: string) => {
    setApplyCourseId(courseId ?? null);
    setApplyOpen(true);
  }, []);

  const closeApply = useCallback(() => setApplyOpen(false), []);

  const value = useMemo<SiteContextValue>(
    () => ({
      content,
      setContent,
      locale,
      setLocale,
      theme,
      toggleTheme,
      tx: (field) => translate(field, locale),
      ts: (key) => ui(locale, key),
      applyOpen,
      openApply,
      closeApply,
      applyCourseId,
    }),
    [content, locale, setLocale, theme, toggleTheme, applyOpen, openApply, closeApply, applyCourseId],
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const context = useContext(SiteContext);
  if (!context) throw new Error('useSite must be used inside <SiteProvider>.');
  return context;
}

/** Runs before paint to avoid a light/dark flash on first load. */
export const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_KEY}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored ? stored === 'dark' : true;
    if (stored === null && !prefersDark) dark = true;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;
