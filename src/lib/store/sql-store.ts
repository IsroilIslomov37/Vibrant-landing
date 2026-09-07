import { SEED_CONTENT } from '../seed';
import type { Lead, LeadInput, SiteContent } from '../types';
import { SCHEMA_STATEMENTS } from './schema';
import {
  buildLead,
  nextVersion,
  StorageUnavailableError,
  type StoreAdapter,
  type StoredAsset,
} from './shared';

/**
 * Postgres-backed store.
 *
 * Deliberately written against a two-method client so the exact same SQL can be
 * exercised locally against PGlite (real Postgres in WASM) in
 * `tools/test-sql-store.mjs`, and in production against Neon/Vercel Postgres
 * over HTTP. The HTTP driver means no connection pool to exhaust from
 * serverless functions.
 */
export interface SqlClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

/** Any of the names Vercel, Neon and Supabase inject. */
export function getConnectionString(): string | null {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_POSTGRES_URL ||
    null
  );
}

async function createNeonClient(connectionString: string): Promise<SqlClient> {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString);
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.query(text, params)) as T[];
    },
  };
}

/* --------------------------------------------------------------- row mapping */

interface LeadRow {
  id: string;
  created_at: Date | string;
  name: string;
  phone: string;
  email: string;
  course_id: string;
  course_title: string;
  format: string;
  level: string;
  message: string;
  status: string;
  source: string;
  locale: string;
  notes: string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowToLead(row: LeadRow): Lead {
  return {
    id: row.id,
    createdAt: toIso(row.created_at),
    name: row.name,
    phone: row.phone,
    email: row.email,
    courseId: row.course_id,
    courseTitle: row.course_title,
    format: row.format as Lead['format'],
    level: row.level as Lead['level'],
    message: row.message,
    status: row.status as Lead['status'],
    source: row.source,
    locale: row.locale === 'en' ? 'en' : 'ru',
    notes: row.notes,
  };
}

/**
 * Binary is moved across the wire as hex text and converted inside Postgres with
 * `encode`/`decode`.
 *
 * Every driver serializes bytea parameters differently — some want a Buffer,
 * some a `\x…` literal, and PGlite rejects both a hex string and a plain array.
 * Keeping the parameter a plain string sidesteps the whole problem, so the same
 * SQL is correct on PGlite, Neon and node-postgres alike. The column stays a
 * real bytea; only the transfer encoding changes.
 */
function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('\\x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/* ------------------------------------------------------------------ adapter */

export function createSqlStore(clientFactory: () => Promise<SqlClient>): StoreAdapter {
  let clientPromise: Promise<SqlClient> | null = null;
  let readyPromise: Promise<SqlClient> | null = null;

  function unavailable(error: unknown): never {
    throw new StorageUnavailableError(
      'The database is unreachable. Check DATABASE_URL / POSTGRES_URL in the deployment settings.',
      error,
    );
  }

  /** Connects once per process and applies the schema before first use. */
  async function ready(): Promise<SqlClient> {
    if (!readyPromise) {
      readyPromise = (async () => {
        clientPromise = clientPromise ?? clientFactory();
        const client = await clientPromise;
        for (const statement of SCHEMA_STATEMENTS) {
          await client.query(statement);
        }
        return client;
      })().catch((error) => {
        // Allow a later request to retry rather than caching the failure forever.
        readyPromise = null;
        clientPromise = null;
        throw error;
      });
    }
    return readyPromise;
  }

  return {
    kind: 'sql',

    async getContent(): Promise<SiteContent> {
      try {
        const client = await ready();
        const rows = await client.query<{ data: SiteContent }>(
          'SELECT data FROM site_content WHERE id = 1',
        );
        if (rows.length === 0) return SEED_CONTENT;
        // Merge over the seed so a newly added field never breaks an old row.
        return { ...SEED_CONTENT, ...rows[0].data };
      } catch (error) {
        // Reads must never take the public site down.
        console.error('[store/sql] Could not read content, serving defaults.', error);
        return SEED_CONTENT;
      }
    },

    async saveContent(next: SiteContent): Promise<SiteContent> {
      try {
        const client = await ready();
        const current = await client.query<{ version: number }>(
          'SELECT version FROM site_content WHERE id = 1',
        );
        const merged = nextVersion(current[0]?.version ?? null, next);
        await client.query(
          `INSERT INTO site_content (id, data, version, updated_at)
           VALUES (1, $1::jsonb, $2, $3)
           ON CONFLICT (id) DO UPDATE
             SET data = EXCLUDED.data,
                 version = EXCLUDED.version,
                 updated_at = EXCLUDED.updated_at`,
          [JSON.stringify(merged), merged.version, merged.updatedAt],
        );
        return merged;
      } catch (error) {
        unavailable(error);
      }
    },

    async resetContent(): Promise<SiteContent> {
      try {
        const client = await ready();
        const fresh: SiteContent = { ...SEED_CONTENT, updatedAt: new Date().toISOString() };
        await client.query(
          `INSERT INTO site_content (id, data, version, updated_at)
           VALUES (1, $1::jsonb, $2, $3)
           ON CONFLICT (id) DO UPDATE
             SET data = EXCLUDED.data,
                 version = EXCLUDED.version,
                 updated_at = EXCLUDED.updated_at`,
          [JSON.stringify(fresh), fresh.version, fresh.updatedAt],
        );
        return fresh;
      } catch (error) {
        unavailable(error);
      }
    },

    async getLeads(): Promise<Lead[]> {
      try {
        const client = await ready();
        const rows = await client.query<LeadRow>(
          'SELECT * FROM leads ORDER BY created_at DESC, id DESC',
        );
        return rows.map(rowToLead);
      } catch (error) {
        console.error('[store/sql] Could not read leads.', error);
        return [];
      }
    },

    async createLead(input: LeadInput, courseTitle: string): Promise<Lead> {
      const lead = buildLead(input, courseTitle);
      try {
        const client = await ready();
        // A single INSERT: no read-modify-write, so concurrent submissions from
        // separate serverless invocations cannot overwrite each other.
        await client.query(
          `INSERT INTO leads
             (id, created_at, name, phone, email, course_id, course_title,
              format, level, message, status, source, locale, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            lead.id,
            lead.createdAt,
            lead.name,
            lead.phone,
            lead.email,
            lead.courseId,
            lead.courseTitle,
            lead.format,
            lead.level,
            lead.message,
            lead.status,
            lead.source,
            lead.locale,
            lead.notes,
          ],
        );
        return lead;
      } catch (error) {
        unavailable(error);
      }
    },

    async updateLead(id, patch): Promise<Lead | null> {
      try {
        const client = await ready();
        const rows = await client.query<LeadRow>(
          `UPDATE leads
              SET status = COALESCE($2, status),
                  notes  = COALESCE($3, notes)
            WHERE id = $1
            RETURNING *`,
          [id, patch.status ?? null, patch.notes ?? null],
        );
        return rows.length > 0 ? rowToLead(rows[0]) : null;
      } catch (error) {
        unavailable(error);
      }
    },

    async deleteLead(id): Promise<boolean> {
      try {
        const client = await ready();
        const rows = await client.query<{ id: string }>(
          'DELETE FROM leads WHERE id = $1 RETURNING id',
          [id],
        );
        return rows.length > 0;
      } catch (error) {
        unavailable(error);
      }
    },

    async putAsset(id: string, asset: StoredAsset): Promise<void> {
      try {
        const client = await ready();
        await client.query(
          `INSERT INTO assets (id, mime, bytes)
           VALUES ($1, $2, decode($3, 'hex'))
           ON CONFLICT (id) DO UPDATE SET mime = EXCLUDED.mime, bytes = EXCLUDED.bytes`,
          [id, asset.mime, bytesToHex(asset.bytes)],
        );
      } catch (error) {
        unavailable(error);
      }
    },

    async getAsset(id: string): Promise<StoredAsset | null> {
      try {
        const client = await ready();
        const rows = await client.query<{ mime: string; bytes_hex: string }>(
          `SELECT mime, encode(bytes, 'hex') AS bytes_hex FROM assets WHERE id = $1`,
          [id],
        );
        if (rows.length === 0) return null;
        return { mime: rows[0].mime, bytes: hexToBytes(rows[0].bytes_hex) };
      } catch (error) {
        console.error('[store/sql] Could not read asset.', error);
        return null;
      }
    },

    async isWritable(): Promise<boolean> {
      try {
        await ready();
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** The production adapter, wired to Neon/Vercel Postgres over HTTP. */
export function createNeonStore(connectionString: string): StoreAdapter {
  return createSqlStore(() => createNeonClient(connectionString));
}
