'use client';

import { Check } from 'lucide-react';
import { GRADIENT_PRESETS } from '@/lib/seed';
import { cn } from '@/lib/utils';

export function GradientPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {GRADIENT_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            aria-label={preset}
            aria-pressed={value === preset}
            className={cn(
              'relative h-10 w-14 overflow-hidden rounded-xl bg-gradient-to-br ring-2 ring-offset-2 ring-offset-background transition-all',
              preset,
              value === preset ? 'ring-brand-400' : 'ring-transparent hover:ring-border',
            )}
          >
            {value === preset ? (
              <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" aria-hidden />
            ) : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
