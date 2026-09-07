'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const baseField =
  'w-full rounded-xl border border-input bg-background/60 px-4 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/25 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/25';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(baseField, 'h-11', className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(baseField, 'min-h-[104px] py-3 leading-relaxed', className)} {...props} />;
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(baseField, 'h-11 appearance-none pr-10', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
});

export function Label({
  className,
  hint,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return (
    <label className={cn('mb-1.5 flex items-baseline gap-2 text-sm font-medium', className)} {...props}>
      <span>{children}</span>
      {hint ? <span className="text-xs font-normal text-muted-foreground">({hint})</span> : null}
    </label>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
      {children}
    </p>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  id,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50',
        checked ? 'bg-brand-500' : 'bg-muted border-border',
      )}
    >
      <span
        className={cn(
          'pointer-events-none block rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[1.4rem]' : 'translate-x-[0.2rem]',
        )}
        style={{ height: '1.125rem', width: '1.125rem' }}
      />
    </button>
  );
}

export function Badge({
  className,
  tone = 'muted',
  children,
}: {
  className?: string;
  tone?: 'muted' | 'brand' | 'aqua' | 'sun' | 'rose' | 'success' | 'destructive';
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    muted: 'bg-muted text-muted-foreground border-border',
    brand: 'bg-brand-500/15 text-brand-400 border-brand-500/30',
    aqua: 'bg-aqua-500/15 text-aqua-400 border-aqua-500/30',
    sun: 'bg-sun-500/15 text-sun-400 border-sun-500/30',
    rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    destructive: 'bg-destructive/15 text-destructive border-destructive/30',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
