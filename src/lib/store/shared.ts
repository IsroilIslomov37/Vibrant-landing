import type { Lead, LeadInput, LeadStatus, SiteContent } from '../types';
import { createId } from '../utils';

/**
 * Thrown when persistence is unavailable (a read-only filesystem, or a database
 * that cannot be reached). Routes turn this into a 503 with an actionable
 * message instead of a 500, and reads degrade to the seed rather than failing —
 * so the public site keeps rendering even when nothing can be written.
 */
export class StorageUnavailableError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageUnavailableError';
    this.cause = cause;
  }
}

export interface StoredAsset {
  mime: string;
  bytes: Uint8Array;
}

/**
 * Everything the app needs from persistence.
 *
 * Two implementations ship: `fs-store` (JSON files, the zero-config local
 * default) and `sql-store` (Postgres, used whenever a connection string is
 * present). Nothing outside this folder knows which one is active.
 */
export interface StoreAdapter {
  readonly kind: 'fs' | 'sql';

  getContent(): Promise<SiteContent>;
  saveContent(next: SiteContent): Promise<SiteContent>;
  resetContent(): Promise<SiteContent>;

  getLeads(): Promise<Lead[]>;
  createLead(input: LeadInput, courseTitle: string): Promise<Lead>;
  updateLead(id: string, patch: Partial<Pick<Lead, 'status' | 'notes'>>): Promise<Lead | null>;
  deleteLead(id: string): Promise<boolean>;

  putAsset(id: string, asset: StoredAsset): Promise<void>;
  getAsset(id: string): Promise<StoredAsset | null>;

  isWritable(): Promise<boolean>;
}

/**
 * Builds the lead record without touching storage.
 *
 * Split out so a submission can still be delivered to Telegram/webhook when the
 * store itself is unavailable — losing an application because the CMS cannot
 * write is far worse than losing the archive copy of it.
 */
export function buildLead(input: LeadInput, courseTitle: string): Lead {
  return {
    id: createId('lead'),
    createdAt: new Date().toISOString(),
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    courseId: input.courseId,
    courseTitle,
    format: input.format,
    level: input.level,
    message: (input.message ?? '').trim(),
    status: 'new',
    source: input.source ?? 'landing',
    locale: input.locale ?? 'ru',
    notes: '',
  };
}

/**
 * Stamps the next version onto a content save.
 *
 * Takes the greater of the stored version and the version the editor was working
 * from, so the counter still moves forward on the very first save — when there
 * is no stored row yet and the draft came straight from the seed.
 */
export function nextVersion(storedVersion: number | null | undefined, next: SiteContent): SiteContent {
  return {
    ...next,
    version: Math.max(storedVersion ?? 0, next.version ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function sortLeadsNewestFirst(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function emptyLeadStats(): Record<LeadStatus | 'total', number> {
  return { total: 0, new: 0, contacted: 0, enrolled: 0, archived: 0 };
}
