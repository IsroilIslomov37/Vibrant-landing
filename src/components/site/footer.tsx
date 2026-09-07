'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUp, Mail, MapPin, Phone, Settings2 } from 'lucide-react';
import { useSite } from '@/components/providers/site-provider';
import { useToast } from '@/components/providers/toast-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { EMAIL_RE } from '@/lib/utils';

export function SiteFooter() {
  const { content, tx, ts } = useSite();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const footer = content.footer;

  const subscribe = (event: React.FormEvent) => {
    event.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      toast({ title: ts('form.error.email'), tone: 'error' });
      return;
    }
    // The digest list is a marketing-tool concern; the landing page only needs to
    // confirm the intent, so this is deliberately client-side.
    toast({ title: ts('footer.subscribed'), tone: 'success' });
    setEmail('');
  };

  return (
    <footer id="contact" className="relative scroll-mt-28 overflow-hidden border-t border-border/70 bg-card/40">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />

      <div className="container relative py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          {/* Brand + contacts */}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-sm font-bold text-white shadow-glow">
                {content.brand.logoMark}
              </span>
              <span className="font-display text-lg font-semibold tracking-tight">{content.brand.name}</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{tx(footer.about)}</p>

            <address className="mt-6 space-y-3 text-sm not-italic">
              <a
                href={footer.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 text-muted-foreground transition-colors hover:text-brand-400"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden />
                <span>
                  {tx(footer.address)}
                  <span className="mt-0.5 block text-xs text-brand-400">{ts('footer.map')} →</span>
                </span>
              </a>
              <a
                href={`tel:${footer.phone.replace(/[^+\d]/g, '')}`}
                className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-brand-400"
              >
                <Phone className="h-4 w-4 shrink-0 text-brand-400" aria-hidden />
                {footer.phone}
              </a>
              <a
                href={`mailto:${footer.email}`}
                className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-brand-400"
              >
                <Mail className="h-4 w-4 shrink-0 text-brand-400" aria-hidden />
                {footer.email}
              </a>
            </address>

            <div className="mt-6 flex gap-2">
              {footer.socials.map((social) => (
                <a
                  key={social.id}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-all hover:border-brand-400 hover:text-brand-400"
                >
                  <Icon name={social.icon} className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footer.columns.map((column) => (
            <nav key={column.id} aria-label={tx(column.title)}>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {tx(column.title)}
              </h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {tx(link.label)}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Newsletter */}
          <div>
            <h3 className="mb-2 font-display text-base font-semibold tracking-tight">
              {tx(footer.newsletterTitle)}
            </h3>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              {tx(footer.newsletterSubtitle)}
            </p>
            <form onSubmit={subscribe} className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={ts('footer.newsletter')}
                aria-label={ts('footer.newsletter')}
                autoComplete="email"
              />
              <Button type="submit" className="shrink-0">
                {ts('footer.subscribe')}
              </Button>
            </form>

            <div className="mt-6 overflow-hidden rounded-2xl border border-border/70">
              {/* Static map placeholder — swap for an embed when a key is available. */}
              <a
                href={footer.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex h-28 items-end bg-[linear-gradient(135deg,#1c2044_0%,#2a2f63_50%,#16204a_100%)] p-3"
              >
                <span
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(109,91,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(109,91,255,0.35) 1px, transparent 1px)',
                    backgroundSize: '22px 22px',
                  }}
                  aria-hidden
                />
                <span className="relative flex items-center gap-2 text-xs font-semibold text-white">
                  <MapPin className="h-4 w-4 text-aqua-400" aria-hidden />
                  {ts('footer.map')}
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col-reverse items-center justify-between gap-4 border-t border-border/60 pt-7 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {content.brand.name}. {ts('footer.rights')}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs text-muted-foreground">
            <a href="#" className="transition-colors hover:text-foreground">
              {ts('footer.privacy')}
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              {ts('footer.offer')}
            </a>
            {/* Deliberately understated staff entrance to the CMS. */}
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 opacity-45 transition-opacity hover:opacity-100"
              title={ts('footer.admin')}
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only sm:not-sr-only">{ts('footer.admin')}</span>
            </Link>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label={ts('a11y.scrollTop')}
              className="grid h-8 w-8 place-items-center rounded-full border border-border transition-colors hover:border-brand-400 hover:text-brand-400"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
