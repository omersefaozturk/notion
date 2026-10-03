// Small async database layer over PostgreSQL.
//
//   DATABASE_URL set   → postgres.js against that server (e.g. Supabase). Prepared
//                         statements are disabled and the pool is tiny so it works
//                         behind Supabase's transaction pooler (port 6543) and in
//                         serverless functions.
//   DATABASE_URL unset → PGlite (real Postgres compiled to WASM), stored in
//                         server/data/pglite (or PGLITE_DIR), or in memory for tests.
//
// Both expose the same interface:
//   db.query(sql, params) → rows      db.one(sql, params) → first row | null
//   db.many(sql, params)  → rows      db.exec(sql)        → multi-statement, no params
//   db.tx(async (t) => …)  → runs fn in a transaction; `t` has query/one/many/exec
//   db.ready()            → connects and makes sure the schema exists (memoised)
//   db.close()
//
// SQL is written with `?` placeholders; they are rewritten to $1, $2, … here so
// query fragments (see lib/access.js) can be composed freely.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SCHEMA_PATH = path.resolve(__dirname, '../sql/schema.sql');
export const DEFAULT_PGLITE_DIR = path.resolve(__dirname, '../data/pglite');

let schemaCache;
export function schemaSql() {
  schemaCache ??= fs.readFileSync(SCHEMA_PATH, 'utf8');
  return schemaCache;
}

/** Tables the schema creates (used for the cheap "is the schema there?" check). */
export function schemaTables(sql = schemaSql()) {
  return [...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+"?(\w+)"?/gi)].map((m) => m[1]);
}

/** Rewrite `?` placeholders (outside quotes) to `$n`. */
export function toPositional(sql) {
  let out = '';
  let n = 0;
  let quote = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === '?') {
      out += `$${++n}`;
      continue;
    }
    out += ch;
  }
  return out;
}

/** Wrap a driver-level `run(text, params)` / `runExec(text)` pair into the public API. */
function wrap(run, runExec) {
  const query = (sql, params = []) => run(toPositional(sql), params);
  return {
    query,
    many: query,
    one: async (sql, params) => (await query(sql, params))[0] ?? null,
    exec: (sql) => runExec(sql),
  };
}

function isLocalUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';
  } catch {
    return false;
  }
}

async function openPostgres(url) {
  const { default: postgres } = await import('postgres');
  const sslmode = (() => {
    try {
      return new URL(url).searchParams.get('sslmode');
    } catch {
      return null;
    }
  })();
  const ssl = sslmode === 'disable' || (!sslmode && isLocalUrl(url)) ? false : 'require';
  const sql = postgres(url, {
    prepare: false, // required by Supabase's transaction pooler (PgBouncer, port 6543)
    max: Number(process.env.PG_POOL_MAX) || 2,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl,
    onnotice: () => {},
    connection: { application_name: 'ortak-plan' },
  });
  const forSql = (s) =>
    wrap(
      (text, params) => s.unsafe(text, params),
      (text) => s.unsafe(text),
    );
  return {
    kind: 'postgres',
    api: forSql(sql),
    tx: (fn) => sql.begin((t) => fn(forSql(t))),
    close: () => sql.end({ timeout: 5 }),
  };
}

async function openPglite(dataDir) {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  const pg = await PGlite.create(dataDir || undefined);
  const forPg = (p) =>
    wrap(
      async (text, params) => (await p.query(text, params)).rows,
      async (text) => {
        await p.exec(text);
      },
    );
  return {
    kind: 'pglite',
    api: forPg(pg),
    tx: (fn) => pg.transaction((t) => fn(forPg(t))),
    close: () => pg.close(),
  };
}

/** Create the schema if any of its tables is missing (one cheap query when it exists). */
export async function ensureSchema(db) {
  const tables = schemaTables();
  const row = await db.one(
    `SELECT count(*)::int AS n FROM pg_catalog.pg_tables
      WHERE schemaname = current_schema() AND tablename IN (${tables.map(() => '?').join(', ')})`,
    tables,
  );
  if (row.n === tables.length) return false;
  await applySchema(db);
  return true;
}

/** Apply schema.sql unconditionally (idempotent). Serialised with an advisory lock. */
export async function applySchema(db) {
  await db.tx(async (t) => {
    await t.query('SELECT pg_advisory_xact_lock(?)', [727274]);
    await t.exec(schemaSql());
  });
}

/**
 * Create a database handle. Connection happens lazily on first use (or ready()).
 * @param {{ url?: string, dataDir?: string, memory?: boolean, ensure?: boolean }} [opts]
 */
export function createDb(opts = {}) {
  const url = opts.url ?? process.env.DATABASE_URL;
  const memory = opts.memory ?? false;
  const dataDir = memory ? null : opts.dataDir ?? process.env.PGLITE_DIR ?? DEFAULT_PGLITE_DIR;
  const ensure = opts.ensure ?? true;

  let driver;
  let readyPromise;
  let isReady = false;

  const db = {
    get kind() {
      return url ? 'postgres' : 'pglite';
    },
    ready() {
      readyPromise ??= (async () => {
        if (!url && process.env.VERCEL) {
          // the serverless file system is read-only/ephemeral: a real database is required
          throw new Error('DATABASE_URL tanımlı değil (Vercel → Settings → Environment Variables)');
        }
        driver = url ? await openPostgres(url) : await openPglite(dataDir);
        if (ensure) await ensureSchema({ ...driver.api, tx: driver.tx });
        isReady = true;
      })().catch((err) => {
        readyPromise = undefined; // retry on the next request (e.g. transient network error)
        const d = driver;
        driver = undefined;
        d?.close().catch(() => {});
        throw err;
      });
      return readyPromise;
    },
    async query(sql, params) {
      if (!isReady) await db.ready();
      return driver.api.query(sql, params);
    },
    async many(sql, params) {
      return db.query(sql, params);
    },
    async one(sql, params) {
      return (await db.query(sql, params))[0] ?? null;
    },
    async exec(sql) {
      if (!isReady) await db.ready();
      return driver.api.exec(sql);
    },
    async tx(fn) {
      if (!isReady) await db.ready();
      return driver.tx(fn);
    },
    async close() {
      const d = driver;
      driver = undefined;
      readyPromise = undefined;
      isReady = false;
      if (d) await d.close();
    },
  };
  return db;
}
