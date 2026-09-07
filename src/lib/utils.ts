import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Locale, LocalizedText } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Reads a bilingual field with a graceful fallback to the other locale. */
export function t(value: LocalizedText | undefined, locale: Locale): string {
  if (!value) return '';
  return value[locale] || value.ru || value.en || '';
}

export function localized(ru: string, en: string): LocalizedText {
  return { ru, en };
}

export function emptyLocalized(): LocalizedText {
  return { ru: '', en: '' };
}

const CURRENCY_LABEL: Record<string, { ru: string; en: string }> = {
  UZS: { ru: 'сум', en: 'UZS' },
  USD: { ru: '$', en: '$' },
  EUR: { ru: '€', en: '€' },
  RUB: { ru: '₽', en: '₽' },
};

export function formatPrice(value: number, currency: string, locale: Locale): string {
  const grouped = new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(value);
  const label = CURRENCY_LABEL[currency];
  if (!label) return `${grouped} ${currency}`;
  if (currency === 'UZS') return `${grouped} ${label[locale]}`;
  return `${label[locale]}${grouped}`;
}

export function formatDate(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
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
