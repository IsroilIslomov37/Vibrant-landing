'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScrollLock } from '@/components/providers/smooth-scroll';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeLabel?: string;
  /** Hides the header entirely for full-bleed content (e.g. course cover art). */
  bare?: boolean;
  className?: string;
}

/**
 * Dialog with a real focus trap, Escape handling, restored focus on close and a
 * scroll lock — the four things a hand-rolled modal usually gets wrong.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  closeLabel = 'Close dialog',
  bare = false,
  className,
}: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => setMounted(true), []);
  useScrollLock(open);

  React.useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    // Focus the panel itself rather than the first control, so screen readers
    // announce the dialog title before its contents.
    (panel ?? first)?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null,
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === firstItem || active === panel)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  } as const;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6">
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm animate-scale-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 max-h-[92dvh] w-full animate-fade-up overflow-y-auto rounded-t-4xl border border-border/70 bg-card text-card-foreground shadow-glow-lg outline-none sm:rounded-4xl',
          sizes[size],
          className,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute right-4 top-4 z-20 rounded-full border border-border/70 bg-background/80 p-2 text-muted-foreground backdrop-blur transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        {!bare && (title || description) ? (
          <div className="border-b border-border/60 px-6 pb-5 pt-6 sm:px-8">
            {title ? (
              <h2 id={titleId} className="pr-10 font-display text-xl font-semibold tracking-tight sm:text-2xl">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        ) : null}

        {children}
      </div>
    </div>,
    document.body,
  );
}
