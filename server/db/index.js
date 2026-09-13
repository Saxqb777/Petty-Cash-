// ═══════════════════════════════════════════════════════════════════════════
//  Neon Postgres client
//
//  Two access paths:
//    · `sql` / `query` / `one` — the HTTP driver (@neondatabase/serverless
//      `neon()`). One statement per round trip, no connection to manage. This is
//      the right tool for ~95% of the app.
//    · `withTransaction(fn)` — a real Postgres connection from a `Pool`, used
//      only where several statements must succeed or fail together AND later
//      statements depend on earlier results (signup, expense+savings insert,
//      settings bulk write, the platform org cascade-delete).
//
//  Nothing here connects at require() time — DATABASE_URL is read lazily so a
//  missing env var surfaces as a clean 500 instead of killing a cold start.
// ═══════════════════════════════════════════════════════════════════════════

const { neon, neonConfig, Pool, types } = require('@neondatabase/serverless');

// ── Type parsers ───────────────────────────────────────────────────────────
// Postgres int8 (BIGSERIAL ids, COUNT(*)) and numeric are returned as *strings*
// by node-postgres to avoid precision loss. Every id and count in this app fits
// comfortably in a JS number and the API contract (and the client) expects
// numbers, so parse them back. Done once, globally — both the HTTP driver and
// the Pool read from this same pg-types registry.
types.setTypeParser(20,   (v) => (v === null ? null : parseInt(v, 10)));   // int8
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));     // numeric

// `Pool` speaks the real Postgres wire protocol over a WebSocket. Node 22+ (the
// Vercel runtime) has a global WebSocket; fall back to the `ws` package locally.
if (typeof globalThis.WebSocket === 'undefined') {
  try {
    neonConfig.webSocketConstructor = require('ws');
  } catch (_) {
    /* Pool will raise a clear error if it is ever used without a constructor */
  }
}

function connectionString() {
  const url = (process.env.DATABASE_URL || '').trim();
  if (!url) {
    const err = new Error(
      'DATABASE_URL is not set. Add your Neon connection string to the environment ' +
      '(Vercel → Project → Settings → Environment Variables, or .env locally).'
    );
    err.status = 500;
    throw err;
  }
  return url;
}

let _sql = null;
function http() {
  if (!_sql) _sql = neon(connectionString());
  return _sql;
}

let _pool = null;
function pool() {
  if (!_pool) _pool = new Pool({ connectionString: connectionString() });
  return _pool;
}

// ── Tagged template (preferred for static statements) ──────────────────────
//   const rows = await sql`SELECT * FROM expenses WHERE id = ${id}`;
// Interpolations become bound parameters — they are never string-concatenated.
function sql(strings, ...params) {
  return http()(strings, ...params);
}

// ── Positional form (for dynamically assembled WHERE clauses) ──────────────
//   const rows = await query('SELECT * FROM t WHERE a = $1 AND b = $2', [a, b]);
sql.query = (text, params = []) => http().query(text, params);
const query = (text, params = []) => http().query(text, params);

/** First row of a positional query, or null. */
async function one(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

/**
 * Run `fn` inside a real BEGIN/COMMIT transaction.
 * `fn` receives { query(text, params) → rows, one(text, params) → row|null }.
 * Any throw rolls back and re-throws.
 */
async function withTransaction(fn) {
  const conn = await pool().connect();
  try {
    await conn.query('BEGIN');
    const tx = {
      query: async (text, params = []) => (await conn.query(text, params)).rows,
      one:   async (text, params = []) => (await conn.query(text, params)).rows[0] || null,
    };
    const result = await fn(tx);
    await conn.query('COMMIT');
    return result;
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (_) { /* connection already gone */ }
    throw err;
  } finally {
    conn.release();
  }
}

/** Postgres unique-violation. Replaces the old `err.message.includes('UNIQUE')`. */
const isUniqueViolation = (err) => err && err.code === '23505';

/**
 * Coerce a route param to a positive integer id, or null. Postgres raises
 * `invalid input syntax for type bigint` on junk, where SQLite silently matched
 * nothing — so validate before querying and return a 404 instead of a 500.
 */
function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

module.exports = { sql, query, one, withTransaction, pool, isUniqueViolation, toId };
