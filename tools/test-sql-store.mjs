/**
 * Exercises the Postgres store against a real Postgres.
 *
 *   node tools/test-sql-store.mjs
 *
 * PGlite is Postgres compiled to WASM, so this runs the exact SQL that ships to
 * Neon/Vercel Postgres — schema, parameter placeholders, jsonb round-trips,
 * bytea encoding, RETURNING clauses and all. Only the network driver differs in
 * production, and that layer is two lines.
 *
 * Requires the built TypeScript, so it is run through the compiled output of
 * `tsc` in a scratch directory (see the npm script `test:sql`).
 */

import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';

// The store is TypeScript; `npm run test:sql` compiles it to .sqltest first.
const require = createRequire(import.meta.url);
const { SCHEMA_STATEMENTS } = require('../.sqltest/store/schema.js');
const { createSqlStore } = require('../.sqltest/store/sql-store.js');

let failures = 0;
let checks = 0;

function check(label, condition, detail) {
  checks += 1;
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

const db = new PGlite();
await db.waitReady;

// Same two-method contract the Neon HTTP driver is wrapped in.
const client = {
  async query(text, params = []) {
    const result = await db.query(text, params);
    return result.rows;
  },
};

const store = createSqlStore(async () => client);

section('schema');
{
  // createSqlStore applies the schema lazily on first use.
  await store.getContent();
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`,
  );
  const names = tables.map((row) => row.table_name);
  check('creates site_content, leads and assets',
    ['assets', 'leads', 'site_content'].every((t) => names.includes(t)),
    names.join(', '));

  // Applying it twice must be a no-op (every deploy re-runs it).
  for (const statement of SCHEMA_STATEMENTS) await client.query(statement);
  check('schema is idempotent', true);
}

section('content');
{
  const seeded = await store.getContent();
  check('falls back to the seed when the table is empty', seeded.brand.name === 'Vibrant School');

  const edited = { ...seeded, brand: { ...seeded.brand, name: 'Vibrant School Pro' } };
  const saved = await store.saveContent(edited);
  check('saveContent bumps the version', saved.version === (seeded.version ?? 0) + 1,
    `got ${saved.version}`);

  const read = await store.getContent();
  check('persists the edit', read.brand.name === 'Vibrant School Pro', read.brand.name);
  check('jsonb round-trips nested arrays',
    Array.isArray(read.courses.items) && read.courses.items.length === seeded.courses.items.length);
  check('jsonb round-trips Cyrillic',
    read.hero.stages[0].title.ru === seeded.hero.stages[0].title.ru,
    read.hero.stages[0].title.ru);

  const second = await store.saveContent(read);
  check('version increments again', second.version === saved.version + 1, `got ${second.version}`);

  const rows = await client.query('SELECT count(*)::int AS n FROM site_content');
  check('stays a single row', rows[0].n === 1, `rows=${rows[0].n}`);

  const reset = await store.resetContent();
  check('resetContent restores the seed', reset.brand.name === 'Vibrant School');
}

section('leads');
{
  const input = {
    name: '  Малика Собирова  ',
    phone: ' +998 90 555 12 34 ',
    email: '  Malika@Example.COM ',
    courseId: 'ielts-intensive',
    format: 'online',
    level: 'intermediate',
    message: 'Нужен балл 7.0 к марту',
    locale: 'ru',
    source: 'landing',
  };
  const created = await store.createLead(input, 'IELTS Intensive 6.5+');
  check('trims the name', created.name === 'Малика Собирова', `"${created.name}"`);
  check('lowercases the email', created.email === 'malika@example.com', created.email);
  check('starts as new', created.status === 'new');

  await store.createLead({ ...input, name: 'Bekzod T.', email: 'b@example.com' }, 'Frontend');

  const leads = await store.getLeads();
  check('returns both leads', leads.length === 2, `got ${leads.length}`);
  check('newest first', leads[0].createdAt >= leads[1].createdAt);
  check('preserves Cyrillic', leads.some((l) => l.message === 'Нужен балл 7.0 к марту'));
  check('createdAt is ISO', !Number.isNaN(Date.parse(leads[0].createdAt)), leads[0].createdAt);

  const patched = await store.updateLead(created.id, { status: 'contacted' });
  check('updates the status', patched?.status === 'contacted', patched?.status);
  check('leaves notes untouched when omitted', patched?.notes === '', JSON.stringify(patched?.notes));

  const noted = await store.updateLead(created.id, { notes: 'Перезвонить в пятницу' });
  check('updates notes', noted?.notes === 'Перезвонить в пятницу', noted?.notes);
  check('keeps the earlier status', noted?.status === 'contacted', noted?.status);

  const missing = await store.updateLead('lead-does-not-exist', { status: 'new' });
  check('returns null for an unknown id', missing === null);

  check('deletes', (await store.deleteLead(created.id)) === true);
  check('reports a second delete as false', (await store.deleteLead(created.id)) === false);
  check('one lead remains', (await store.getLeads()).length === 1);
}

section('concurrency');
{
  // Two serverless invocations submitting at the same instant must both land —
  // this is exactly what the old read-modify-write JSON store could not promise.
  const before = (await store.getLeads()).length;
  await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      store.createLead(
        {
          name: `Student ${i}`,
          phone: '+998900000000',
          email: `s${i}@example.com`,
          courseId: 'frontend-pro',
          format: 'offline',
          level: 'beginner',
        },
        'Frontend',
      ),
    ),
  );
  const after = (await store.getLeads()).length;
  check('12 concurrent inserts all persist', after === before + 12, `${before} -> ${after}`);

  const ids = new Set((await store.getLeads()).map((l) => l.id));
  check('ids are unique', ids.size === after, `${ids.size} unique of ${after}`);
}

section('assets');
{
  // A tiny PNG, including a zero byte and a high byte — the cases that break
  // naive bytea encoding.
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x1a, 0x0a, 0x42]);
  await store.putAsset('img-test-1', { mime: 'image/png', bytes });

  const loaded = await store.getAsset('img-test-1');
  check('returns the asset', loaded !== null);
  check('preserves the mime type', loaded?.mime === 'image/png', loaded?.mime);
  check(
    'round-trips bytes exactly',
    loaded && loaded.bytes.length === bytes.length && bytes.every((b, i) => loaded.bytes[i] === b),
    loaded ? `[${Array.from(loaded.bytes).join(',')}]` : 'null',
  );

  await store.putAsset('img-test-1', { mime: 'image/webp', bytes: new Uint8Array([1, 2, 3]) });
  const replaced = await store.getAsset('img-test-1');
  check('upsert replaces the content', replaced?.mime === 'image/webp' && replaced?.bytes.length === 3);

  check('missing asset returns null', (await store.getAsset('img-nope')) === null);
}

section('availability');
{
  check('reports writable', (await store.isWritable()) === true);

  // A store whose client cannot connect must surface StorageUnavailableError on
  // writes but still serve content on reads.
  const broken = createSqlStore(async () => {
    throw new Error('connection refused');
  });
  check('isWritable is false when the database is unreachable',
    (await broken.isWritable()) === false);

  const content = await broken.getContent();
  check('reads still return the seed when unreachable', content.brand.name === 'Vibrant School');
  check('reads return an empty lead list when unreachable', (await broken.getLeads()).length === 0);

  let thrown = null;
  try {
    await broken.saveContent(content);
  } catch (error) {
    thrown = error;
  }
  check('writes throw StorageUnavailableError',
    thrown?.name === 'StorageUnavailableError', String(thrown));
}

await db.close();

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
