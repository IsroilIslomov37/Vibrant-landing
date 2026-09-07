import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { SEED_CONTENT } from './seed';
import type { Lead, LeadInput, LeadStatus, SiteContent } from './types';
import { createId } from './utils';

/**
 * File-backed JSON store.
 *
 * This is the single seam between the app and persistence: swapping in Supabase
 * or Prisma means reimplementing the exported functions below and nothing else.
 * Writes are serialized through a promise chain so two concurrent admin saves
 * cannot interleave, and every write goes to a temp file first so a crash
 * mid-write cannot leave a truncated JSON document behind.
 *
 * Note for deployment: serverless filesystems are ephemeral. On Vercel-style
 * hosting, point `VIBRANT_DATA_DIR` at a mounted volume or replace this module.
 */

const DATA_DIR = process.env.VIBRANT_DATA_DIR
  ? path.resolve(process.env.VIBRANT_DATA_DIR)
  : path.join(process.cwd(), 'data');

const CONTENT_FILE = path.join(DATA_DIR, 'site.json');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

/**
 * Thrown when persistence is unavailable (a read-only or serverless filesystem).
 * Routes turn this into a 503 with an actionable message instead of a 500, and
 * reads degrade to the seed rather than failing — so the public site keeps
 * rendering even when nothing can be written.
 */
export class StorageUnavailableError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageUnavailableError';
    this.cause = cause;
  }
}

let writeQueue: Promise<unknown> = Promise.resolve();

/** Serializes writes so concurrent requests cannot interleave read-modify-write cycles. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => undefined);
  return run;
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/**
 * Reads a JSON document, never throwing.
 *
 * A missing file is seeded when the filesystem allows it; when it does not
 * (read-only or serverless), the caller still gets the fallback so that
 * rendering the public site never depends on being able to write.
 */
async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      try {
        await atomicWrite(file, fallback);
      } catch (writeError) {
        warnOnce(
          `[store] ${file} is missing and cannot be created; serving built-in defaults. ` +
            'Set VIBRANT_DATA_DIR to a writable volume or swap src/lib/store.ts for a database adapter.',
          writeError,
        );
      }
      return fallback;
    }
    // A corrupted file should not take the whole site down.
    console.error(`[store] Could not read ${file}, falling back to defaults.`, error);
    return fallback;
  }
}

const warned = new Set<string>();
function warnOnce(message: string, cause?: unknown) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message, cause);
}

async function atomicWrite(file: string, data: unknown) {
  try {
    await ensureDir();
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, file);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM' || code === 'ENOTDIR') {
      throw new StorageUnavailableError(
        'The data directory is not writable. On a serverless host, point VIBRANT_DATA_DIR at a ' +
          'mounted volume or replace src/lib/store.ts with a database adapter.',
        error,
      );
    }
    throw error;
  }
}

/** True when the store can persist writes right now. */
export async function isWritable(): Promise<boolean> {
  try {
    await ensureDir();
    const probe = path.join(DATA_DIR, `.probe-${process.pid}`);
    await fs.writeFile(probe, 'ok', 'utf8');
    await fs.rm(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ content */

export async function getContent(): Promise<SiteContent> {
  const content = await readJson<SiteContent>(CONTENT_FILE, SEED_CONTENT);
  // Shallow-merge new seed keys so a schema addition never breaks an old file.
  return { ...SEED_CONTENT, ...content };
}

export async function saveContent(next: SiteContent): Promise<SiteContent> {
  return enqueue(async () => {
    const current = await readJson<SiteContent>(CONTENT_FILE, SEED_CONTENT);
    const merged: SiteContent = {
      ...next,
      version: (current.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    await atomicWrite(CONTENT_FILE, merged);
    return merged;
  });
}

export async function resetContent(): Promise<SiteContent> {
  return enqueue(async () => {
    const fresh: SiteContent = { ...SEED_CONTENT, updatedAt: new Date().toISOString() };
    await atomicWrite(CONTENT_FILE, fresh);
    return fresh;
  });
}

/* -------------------------------------------------------------------- leads */

export async function getLeads(): Promise<Lead[]> {
  const leads = await readJson<Lead[]>(LEADS_FILE, []);
  return [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

export async function createLead(input: LeadInput, courseTitle: string): Promise<Lead> {
  const lead = buildLead(input, courseTitle);
  return enqueue(async () => {
    const leads = await readJson<Lead[]>(LEADS_FILE, []);
    leads.push(lead);
    await atomicWrite(LEADS_FILE, leads);
    return lead;
  });
}

export async function updateLead(
  id: string,
  patch: Partial<Pick<Lead, 'status' | 'notes'>>,
): Promise<Lead | null> {
  return enqueue(async () => {
    const leads = await readJson<Lead[]>(LEADS_FILE, []);
    const index = leads.findIndex((lead) => lead.id === id);
    if (index === -1) return null;
    leads[index] = { ...leads[index], ...patch };
    await atomicWrite(LEADS_FILE, leads);
    return leads[index];
  });
}

export async function deleteLead(id: string): Promise<boolean> {
  return enqueue(async () => {
    const leads = await readJson<Lead[]>(LEADS_FILE, []);
    const next = leads.filter((lead) => lead.id !== id);
    if (next.length === leads.length) return false;
    await atomicWrite(LEADS_FILE, next);
    return true;
  });
}

export async function leadStats(): Promise<Record<LeadStatus | 'total', number>> {
  const leads = await getLeads();
  const base: Record<LeadStatus | 'total', number> = {
    total: leads.length,
    new: 0,
    contacted: 0,
    enrolled: 0,
    archived: 0,
  };
  for (const lead of leads) base[lead.status] += 1;
  return base;
}
