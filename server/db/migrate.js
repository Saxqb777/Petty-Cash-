// ═══════════════════════════════════════════════════════════════════════════
//  Schema migration — `npm run db:migrate`
//
//  Applies server/db/schema.sql (idempotent DDL) and then seeds org 1 and its
//  defaults. Run it once after provisioning the Neon database, and again after
//  any schema.sql change. It is deliberately NOT invoked from the request path.
// ═══════════════════════════════════════════════════════════════════════════

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('./index');
const { runSeed } = require('./seed');

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  // Multi-statement DDL needs the real Postgres protocol — the Neon HTTP driver
  // accepts a single statement per request.
  const conn = await pool().connect();
  try {
    await conn.query(schema);
  } finally {
    conn.release();
  }
  console.log('[migrate] schema applied.');

  await runSeed();
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate] failed:', err.message);
    if (err.position) console.error('[migrate] at character offset', err.position);
    process.exit(1);
  });
