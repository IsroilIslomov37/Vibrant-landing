import { promises as fs } from 'node:fs';
import path from 'node:path';
import { SEED_CONTENT } from '../seed';
import type { Lead, LeadInput, SiteContent } from '../types';
import {
  buildLead,
  nextVersion,
  sortLeadsNewestFirst,
  StorageUnavailableError,
  type StoreAdapter,
  type StoredAsset,
} from './shared';

/**
 * File-backed JSON store — the zero-config default for local development.
 *
 * Writes are serialized through a promise chain so two concurrent admin saves
 * cannot interleave, and every write goes to a temp file first so a crash
 * mid-write cannot leave a truncated JSON document behind.
 *
 * Not suitable for serverless hosting: the filesystem there is read-only and
 * per-invocation. Set a Postgres connection string and `store/index.ts` will
 * pick the SQL adapter instead.
 */

const DATA_DIR = process.env.VIBRANT_DATA_DIR
  ? path.resolve(process.env.VIBRANT_DATA_DIR)
  : path.join(process.cwd(), 'data');

const CONTENT_FILE = path.join(DATA_DIR, 'site.json');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const ASSETS_DIR = path.join(DATA_DIR, 'assets');

let writeQueue: Promise<unknown> = Promise.resolve();

/** Serializes writes so concurrent requests cannot interleave read-modify-write cycles. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => undefined);
  return run;
}

async function ensureDir(dir = DATA_DIR) {
  await fs.mkdir(dir, { recursive: true });
}

const warned = new Set<string>();
function warnOnce(message: string, cause?: unknown) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message, cause);
}

async function atomicWrite(file: string, data: unknown) {
  try {
    await ensureDir(path.dirname(file));
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, file);
  } catch (error) {
    throw asStorageError(error);
  }
}

function asStorageError(error: unknown): unknown {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM' || code === 'ENOTDIR') {
    return new StorageUnavailableError(
      'The data directory is not writable. On a serverless host set DATABASE_URL to use the ' +
        'Postgres store, or point VIBRANT_DATA_DIR at a mounted volume.',
      error,
    );
  }
  return error;
}

/**
 * Reads a JSON document, never throwing.
 *
 * A missing file is seeded when the filesystem allows it; when it does not, the
 * caller still gets the fallback, so rendering the public site never depends on
 * being able to write.
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
          `[store/fs] ${file} is missing and cannot be created; serving built-in defaults.`,
          writeError,
        );
      }
      return fallback;
    }
    // A corrupted file should not take the whole site down.
    console.error(`[store/fs] Could not read ${file}, falling back to defaults.`, error);
    return fallback;
  }
}

export const fsStore: StoreAdapter = {
  kind: 'fs',

  async getContent(): Promise<SiteContent> {
    const content = await readJson<SiteContent>(CONTENT_FILE, SEED_CONTENT);
    // Shallow-merge new seed keys so a schema addition never breaks an old file.
    return { ...SEED_CONTENT, ...content };
  },

  async saveContent(next: SiteContent): Promise<SiteContent> {
    return enqueue(async () => {
      const current = await readJson<SiteContent>(CONTENT_FILE, SEED_CONTENT);
      const merged = nextVersion(current.version, next);
      await atomicWrite(CONTENT_FILE, merged);
      return merged;
    });
  },

  async resetContent(): Promise<SiteContent> {
    return enqueue(async () => {
      const fresh: SiteContent = { ...SEED_CONTENT, updatedAt: new Date().toISOString() };
      await atomicWrite(CONTENT_FILE, fresh);
      return fresh;
    });
  },

  async getLeads(): Promise<Lead[]> {
    return sortLeadsNewestFirst(await readJson<Lead[]>(LEADS_FILE, []));
  },

  async createLead(input: LeadInput, courseTitle: string): Promise<Lead> {
    const lead = buildLead(input, courseTitle);
    return enqueue(async () => {
      const leads = await readJson<Lead[]>(LEADS_FILE, []);
      leads.push(lead);
      await atomicWrite(LEADS_FILE, leads);
      return lead;
    });
  },

  async updateLead(id, patch): Promise<Lead | null> {
    return enqueue(async () => {
      const leads = await readJson<Lead[]>(LEADS_FILE, []);
      const index = leads.findIndex((lead) => lead.id === id);
      if (index === -1) return null;
      leads[index] = { ...leads[index], ...patch };
      await atomicWrite(LEADS_FILE, leads);
      return leads[index];
    });
  },

  async deleteLead(id): Promise<boolean> {
    return enqueue(async () => {
      const leads = await readJson<Lead[]>(LEADS_FILE, []);
      const next = leads.filter((lead) => lead.id !== id);
      if (next.length === leads.length) return false;
      await atomicWrite(LEADS_FILE, next);
      return true;
    });
  },

  async putAsset(id: string, asset: StoredAsset): Promise<void> {
    try {
      await ensureDir(ASSETS_DIR);
      await fs.writeFile(path.join(ASSETS_DIR, `${id}.bin`), asset.bytes);
      await fs.writeFile(path.join(ASSETS_DIR, `${id}.type`), asset.mime, 'utf8');
    } catch (error) {
      throw asStorageError(error);
    }
  },

  async getAsset(id: string): Promise<StoredAsset | null> {
    try {
      const [bytes, mime] = await Promise.all([
        fs.readFile(path.join(ASSETS_DIR, `${id}.bin`)),
        fs.readFile(path.join(ASSETS_DIR, `${id}.type`), 'utf8'),
      ]);
      return { bytes: new Uint8Array(bytes), mime: mime.trim() };
    } catch {
      return null;
    }
  },

  async isWritable(): Promise<boolean> {
    try {
      await ensureDir();
      const probe = path.join(DATA_DIR, `.probe-${process.pid}`);
      await fs.writeFile(probe, 'ok', 'utf8');
      await fs.rm(probe, { force: true });
      return true;
    } catch {
      return false;
    }
  },
};
