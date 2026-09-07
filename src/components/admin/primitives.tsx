'use client';

import * as React from 'react';
import { ChevronDown, GripVertical, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Switch, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import type { LocalizedText } from '@/lib/types';

/* ------------------------------------------------------------------ layout */

export function Panel({
  title,
  description,
  children,
  actions,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('surface-card p-5 sm:p-6', className)}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  return (
    <div
      className={cn(
        'grid gap-4',
        cols === 1 && 'grid-cols-1',
        cols === 2 && 'sm:grid-cols-2',
        cols === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ fields */

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = 'text',
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
  multiline?: boolean;
}) {
  const id = React.useId();
  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      {multiline ? (
        <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  const id = React.useId();
  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(Number.isFinite(next) ? next : 0);
        }}
      />
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  const id = React.useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} label={label} />
    </div>
  );
}

/**
 * Bilingual input pair. Every editable string on the site is `{ ru, en }`, so
 * this is the single component that keeps both locales visible while editing —
 * a missing translation is impossible to overlook.
 */
export function LocalizedField({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const Control = multiline ? Textarea : Input;
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(['ru', 'en'] as const).map((locale) => (
          <div key={locale} className="relative">
            <span className="pointer-events-none absolute right-2.5 top-2.5 z-10 rounded bg-muted px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-muted-foreground">
              {locale}
            </span>
            <Control
              value={value?.[locale] ?? ''}
              onChange={(event: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) =>
                onChange({ ...value, [locale]: event.target.value })
              }
              placeholder={placeholder}
              className={multiline ? 'pr-12' : 'pr-12'}
              aria-label={`${label} (${locale.toUpperCase()})`}
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/** Reads a local file into a data URL so uploads work with no storage bucket. */
export function ImageField({
  label,
  value,
  onChange,
  hint = 'PNG / JPG / WebP, до 2 МБ',
}: {
  label: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  hint?: string;
}) {
  const id = React.useId();
  const [error, setError] = React.useState<string | null>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Файл больше 2 МБ — сожмите изображение.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.onerror = () => setError('Не удалось прочитать файл.');
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-muted-foreground">
              <ImagePlus className="h-5 w-5" aria-hidden />
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-wrap gap-2">
          <input
            id={id}
            type="file"
            accept="image/*"
            className="block w-full text-xs text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-2 file:text-xs file:font-semibold hover:file:bg-border"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
          {value ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
              <X className="h-3.5 w-3.5" aria-hidden />
              Удалить
            </Button>
          ) : null}
        </div>
      </div>
      <Input
        className="mt-2"
        value={value?.startsWith('data:') ? '' : (value ?? '')}
        placeholder="…или вставьте URL изображения"
        onChange={(event) => onChange(event.target.value || undefined)}
      />
      {error ? <p className="mt-1 text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

/** Editable list of bilingual bullet points (course outcomes, qualifications). */
export function LocalizedListField({
  label,
  items,
  onChange,
  addLabel = 'Добавить пункт',
}: {
  label: string;
  items: LocalizedText[];
  onChange: (items: LocalizedText[]) => void;
  addLabel?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...items, { ru: '', en: '' }])}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {addLabel}
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              {(['ru', 'en'] as const).map((locale) => (
                <Input
                  key={locale}
                  value={item[locale] ?? ''}
                  aria-label={`${label} ${index + 1} (${locale.toUpperCase()})`}
                  placeholder={locale.toUpperCase()}
                  onChange={(event) => {
                    const next = [...items];
                    next[index] = { ...item, [locale]: event.target.value };
                    onChange(next);
                  }}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Удалить пункт ${index + 1}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
            </Button>
          </div>
        ))}
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
            Пока пусто
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- collection editor */

export interface CollectionItem {
  id: string;
  order: number;
  published?: boolean;
}

/**
 * Generic add / remove / reorder / expand shell used by the Courses, Mentors and
 * Reviews tabs. Each tab only supplies a title, a summary line and the fields.
 */
export function CollectionEditor<T extends CollectionItem>({
  items,
  onChange,
  onCreate,
  renderTitle,
  renderSummary,
  renderFields,
  addLabel,
  emptyLabel = 'Пока ничего не добавлено.',
}: {
  items: T[];
  onChange: (items: T[]) => void;
  onCreate: () => T;
  renderTitle: (item: T) => React.ReactNode;
  renderSummary?: (item: T) => React.ReactNode;
  renderFields: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
  addLabel: string;
  emptyLabel?: string;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);

  const sorted = React.useMemo(() => [...items].sort((a, b) => a.order - b.order), [items]);

  const update = (id: string, patch: Partial<T>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const move = (id: string, direction: -1 | 1) => {
    const index = sorted.findIndex((item) => item.id === id);
    const swapWith = index + direction;
    if (index === -1 || swapWith < 0 || swapWith >= sorted.length) return;
    // Swap the `order` values rather than array positions so the change survives
    // the re-sort on the next render.
    const next = [...sorted];
    const a = next[index];
    const b = next[swapWith];
    onChange(
      items.map((item) => {
        if (item.id === a.id) return { ...item, order: b.order };
        if (item.id === b.id) return { ...item, order: a.order };
        return item;
      }),
    );
  };

  const remove = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
    if (openId === id) setOpenId(null);
  };

  const add = () => {
    const created = onCreate();
    onChange([...items, created]);
    setOpenId(created.id);
  };

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : null}

      {sorted.map((item, index) => {
        const open = openId === item.id;
        return (
          <article key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 p-3">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(item.id, -1)}
                  disabled={index === 0}
                  aria-label="Переместить выше"
                  className="rounded p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-25"
                >
                  <ChevronDown className="h-3.5 w-3.5 rotate-180" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(item.id, 1)}
                  disabled={index === sorted.length - 1}
                  aria-label="Переместить ниже"
                  className="rounded p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-25"
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>

              <GripVertical className="hidden h-4 w-4 shrink-0 text-muted-foreground/50 sm:block" aria-hidden />

              <button
                type="button"
                onClick={() => setOpenId(open ? null : item.id)}
                aria-expanded={open}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-semibold">{renderTitle(item)}</span>
                {renderSummary ? (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {renderSummary(item)}
                  </span>
                ) : null}
              </button>

              {'published' in item ? (
                <Switch
                  checked={Boolean(item.published)}
                  onCheckedChange={(value) => update(item.id, { published: value } as Partial<T>)}
                  label="Опубликовано"
                />
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Удалить"
                onClick={() => remove(item.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={open ? 'Свернуть' : 'Развернуть'}
                onClick={() => setOpenId(open ? null : item.id)}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
              </Button>
            </div>

            {open ? (
              <div className="space-y-4 border-t border-border/70 bg-muted/20 p-4 sm:p-5">
                {renderFields(item, (patch) => update(item.id, patch))}
              </div>
            ) : null}
          </article>
        );
      })}

      <Button type="button" variant="outline" onClick={add} className="w-full">
        <Plus className="h-4 w-4" aria-hidden />
        {addLabel}
      </Button>
    </div>
  );
}
