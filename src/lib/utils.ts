import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LOCALES, type Locale, type LocalizedText } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Reads a localized field, falling back through the remaining locales.
 *
 * A translation the admin has not filled in yet shows the Russian (then Uzbek,
 * then English) text instead of an empty element — adding a language must never
 * blank out the page while its content is still being written.
 */
export function t(value: LocalizedText | undefined, locale: Locale): string {
  if (!value) return '';
  return value[locale] || value.ru || value.uz || value.en || '';
}

export function localized(ru: string, uz: string, en: string): LocalizedText {
  return { ru, uz, en };
}

export function emptyLocalized(): LocalizedText {
  return Object.fromEntries(LOCALES.map((locale) => [locale, ''])) as LocalizedText;
}

/**
 * Fills in any locale absent from stored content.
 *
 * Content saved before a language was added has no key for it, which would make
 * the admin input uncontrolled; this keeps every field a controlled empty string.
 */
export function fillLocales(value: Partial<LocalizedText> | undefined): LocalizedText {
  return { ...emptyLocalized(), ...(value ?? {}) };
}

/** Label for collapsed admin rows — the first non-empty translation wins. */
export function preview(value: LocalizedText | undefined): string {
  if (!value) return '';
  for (const locale of LOCALES) {
    if (value[locale]) return value[locale];
  }
  return '';
}

const CURRENCY_LABEL: Record<string, LocalizedText> = {
  UZS: { ru: 'сум', uz: "so'm", en: 'UZS' },
  USD: { ru: '$', uz: '$', en: '$' },
  EUR: { ru: '€', uz: '€', en: '€' },
  RUB: { ru: '₽', uz: '₽', en: '₽' },
};

/** BCP-47 tag per locale, for Intl number and date formatting. */
const INTL_LOCALE: Record<Locale, string> = { ru: 'ru-RU', uz: 'uz-UZ', en: 'en-US' };

export function formatPrice(value: number, currency: string, locale: Locale): string {
  const grouped = new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumFractionDigits: 0,
  }).format(value);
  const label = CURRENCY_LABEL[currency];
  if (!label) return `${grouped} ${currency}`;
  if (currency === 'UZS') return `${grouped} ${label[locale]}`;
  return `${label[locale]}${grouped}`;
}

export function formatDate(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Stable id generator that works in both the browser and node. */
export function createId(prefix = 'id'): string {
  const rand =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smootherstep — flatter at both ends than smoothstep, which reads better on scroll. */
export const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Minimal, dependency-free deep clone for the content tree (JSON-safe by design). */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export const PHONE_RE = /^\+?[0-9\s()\-]{9,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function escapeCsv(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}
