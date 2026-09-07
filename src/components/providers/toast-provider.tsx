'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (input: { title: string; description?: string; tone?: ToastTone; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { icon: typeof CheckCircle2; ring: string; iconClass: string }> = {
  success: { icon: CheckCircle2, ring: 'ring-emerald-500/30', iconClass: 'text-emerald-500' },
  error: { icon: XCircle, ring: 'ring-destructive/30', iconClass: 'text-destructive' },
  warning: { icon: TriangleAlert, ring: 'ring-sun-500/30', iconClass: 'text-sun-500' },
  info: { icon: Info, ring: 'ring-brand-500/30', iconClass: 'text-brand-500' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue['toast']>(
    ({ title, description, tone = 'info', duration = 4800 }) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-3), { id, title, description, tone }]);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {toasts.map((item) => {
          const tone = TONE_STYLES[item.tone];
          const Icon = tone.icon;
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                'pointer-events-auto flex w-full max-w-sm animate-scale-in items-start gap-3 rounded-2xl border border-border/70 bg-popover/95 p-4 text-popover-foreground shadow-glow-lg ring-1 backdrop-blur-xl',
                tone.ring,
              )}
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', tone.iconClass)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{item.title}</p>
                {item.description ? (
                  <p className="mt-1 text-sm leading-snug text-muted-foreground">{item.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Close notification"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
}
