/**
 * Schema for the Postgres-backed store.
 *
 * Applied with `CREATE TABLE IF NOT EXISTS` on first use in each process, so a
 * fresh Neon/Supabase database needs no migration step from the operator —
 * deploying is enough. Statements are run one at a time because the Neon HTTP
 * driver does not accept multi-statement strings.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS site_content (
     id          integer PRIMARY KEY DEFAULT 1,
     data        jsonb       NOT NULL,
     version     integer     NOT NULL DEFAULT 1,
     updated_at  timestamptz NOT NULL DEFAULT now(),
     CONSTRAINT site_content_singleton CHECK (id = 1)
   )`,

  `CREATE TABLE IF NOT EXISTS leads (
     id           text PRIMARY KEY,
     created_at   timestamptz NOT NULL DEFAULT now(),
     name         text NOT NULL,
     phone        text NOT NULL,
     email        text NOT NULL,
     course_id    text NOT NULL DEFAULT '',
     course_title text NOT NULL DEFAULT '',
     format       text NOT NULL DEFAULT 'offline',
     level        text NOT NULL DEFAULT 'beginner',
     message      text NOT NULL DEFAULT '',
     status       text NOT NULL DEFAULT 'new',
     source       text NOT NULL DEFAULT 'landing',
     locale       text NOT NULL DEFAULT 'ru',
     notes        text NOT NULL DEFAULT ''
   )`,

  // The admin table is always ordered newest-first and usually filtered by status.
  `CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status)`,

  // Admin-uploaded images. Kept out of site_content so the content document
  // stays small — it is read on every page render.
  `CREATE TABLE IF NOT EXISTS assets (
     id         text PRIMARY KEY,
     mime       text  NOT NULL,
     bytes      bytea NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
];
