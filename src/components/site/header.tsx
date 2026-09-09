'use client';

import { useEffect, useState } from 'react';
import { Menu, Moon, Sparkles, Sun, X } from 'lucide-react';
import { useSite } from '@/components/providers/site-provider';
import { Button } from '@/components/ui/button';
import { LOCALE_LABEL } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { LOCALES } from '@/lib/types';

const TONE_CLASSES: Record<string, string> = {
  brand: 'from-brand-600 via-brand-500 to-aqua-500',
  sun: 'from-sun-600 via-sun-500 to-rose-500',
  aqua: 'from-aqua-600 via-aqua-500 to-brand-500',
};

function AnnouncementBar() {
  const { content, tx, openApply } = useSite();
  const [dismissed, setDismissed] = useState(false);
  const announcement = content.announcement;

  if (!announcement.enabled || dismissed) return null;

  return (
    <div
      className={cn(
        'relative bg-gradient-to-r text-white',
        TONE_CLASSES[announcement.tone] ?? TONE_CLASSES.brand,
      )}
    >
      <div className="container flex items-center justify-center gap-3 py-2 pr-8 text-center text-xs font-medium sm:text-sm">
        <Sparkles className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden />
        <span className="text-balance">{tx(announcement.text)}</span>
        {announcement.ctaHref === '#apply' ? (
          <button
            type="button"
            onClick={() => openApply()}
            className="hidden shrink-0 rounded-full bg-white/20 px-3 py-1 font-semibold underline-offset-2 transition hover:bg-white/30 sm:inline-block"
          >
            {tx(announcement.ctaLabel)}
          </button>
        ) : (
          <a
            href={announcement.ctaHref}
            className="hidden shrink-0 rounded-full bg-white/20 px-3 py-1 font-semibold transition hover:bg-white/30 sm:inline-block"
          >
            {tx(announcement.ctaLabel)}
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition hover:bg-white/20"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

export function SiteHeader() {
  const { content, tx, ts, locale, setLocale, theme, toggleTheme, openApply } = useSite();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile sheet on route-ish navigation or a widened viewport.
  useEffect(() => {
    if (!menuOpen) return;
    const onResize = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);


  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <AnnouncementBar />

      <div
        className={cn(
          'border-b transition-all duration-500 ease-smooth',
          scrolled
            ? 'glass border-border/60 shadow-[0_8px_32px_-16px_rgba(10,12,34,0.5)]'
            : 'border-transparent bg-transparent',
        )}
      >
        <div className="container flex h-16 items-center justify-between gap-4 lg:h-[4.5rem]">
          {/* Brand */}
          <a
            href="#about"
            className="group flex shrink-0 items-center gap-2.5"
            aria-label={content.brand.name}
          >
            <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-brand-gradient text-sm font-bold text-white shadow-glow transition-transform duration-500 group-hover:scale-105">
              {content.brand.logoMark}
            </span>
            <span className="flex flex-col leading-none">
              <span
                className={cn(
                  'font-display text-base font-semibold tracking-tight transition-colors',
                  scrolled ? 'text-foreground' : 'text-white',
                )}
              >
                {content.brand.name}
              </span>
              <span
                className={cn(
                  'mt-0.5 hidden text-[0.68rem] font-medium tracking-wide xs:block',
                  scrolled ? 'text-muted-foreground' : 'text-white/60',
                )}
              >
                {tx(content.brand.tagline)}
              </span>
            </span>
          </a>

          {/* Desktop nav */}
          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {content.nav.links.map((link) => (
              <a
                key={link.id}
                href={link.href}
                className={cn(
                  'relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                  scrolled
                    ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    : 'text-white/75 hover:bg-white/10 hover:text-white',
                )}
              >
                {tx(link.label)}
              </a>
            ))}
          </nav>

          {/* Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* All three locales stay visible: a cycling toggle hides which
                languages exist, and with three of them it takes two taps to
                reach the last one. */}
            <div
              role="group"
              aria-label={ts('lang.switch')}
              className={cn(
                'flex h-9 items-center gap-0.5 rounded-full border p-0.5 transition-colors',
                scrolled ? 'border-border' : 'border-white/20',
              )}
            >
              {LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  aria-pressed={locale === code}
                  aria-label={`${ts('lang.switch')}: ${LOCALE_LABEL[code]}`}
                  className={cn(
                    'h-8 rounded-full px-2.5 text-xs font-bold tracking-wide transition-colors',
                    locale === code
                      ? 'bg-brand-gradient text-white shadow-glow'
                      : scrolled
                        ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {LOCALE_LABEL[code]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? ts('theme.light') : ts('theme.dark')}
              className={cn(
                'grid h-9 w-9 place-items-center rounded-full border transition-colors',
                scrolled
                  ? 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  : 'border-white/20 text-white/80 hover:bg-white/10 hover:text-white',
              )}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            </button>

            <Button
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => openApply()}
            >
              {tx(content.nav.ctaLabel)}
            </Button>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? ts('nav.close') : ts('nav.open')}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              className={cn(
                'grid h-9 w-9 place-items-center rounded-full border transition-colors lg:hidden',
                scrolled
                  ? 'border-border text-foreground hover:bg-muted'
                  : 'border-white/20 text-white hover:bg-white/10',
              )}
            >
              {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sheet */}
      <div
        id="mobile-nav"
        className={cn(
          'glass overflow-hidden border-b border-border/60 transition-[max-height,opacity] duration-500 ease-smooth lg:hidden',
          menuOpen ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <nav aria-label="Mobile" className="container flex flex-col gap-1 py-4">
          {content.nav.links.map((link) => (
            <a
              key={link.id}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted"
            >
              {tx(link.label)}
            </a>
          ))}
          <Button
            className="mt-2 w-full"
            size="lg"
            onClick={() => {
              setMenuOpen(false);
              openApply();
            }}
          >
            {tx(content.nav.ctaLabel)}
          </Button>
        </nav>
      </div>
    </header>
  );
}
