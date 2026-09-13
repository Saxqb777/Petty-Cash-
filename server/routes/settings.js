const express = require('express');
const { sql, withTransaction } = require('../db');
const { requireAuth, requireMinRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

async function getAll(orgId) {
  const rows = await sql`SELECT key, value FROM settings WHERE org_id = ${orgId}`;
  const out = {};
  rows.forEach(r => { try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; } });
  return out;
}

// GET /api/settings
router.get('/', async (req, res) => {
  try { res.json(await getAll(req.user.org_id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/settings  { key: value, ... }
router.put('/', requireMinRole('finance'), async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const entries = Object.entries(req.body || {});

    // SQLite `INSERT OR REPLACE` → Postgres upsert on the (key, org_id) PK.
    await withTransaction(async (tx) => {
      for (const [k, v] of entries) {
        await tx.query(
          `INSERT INTO settings (key, value, org_id) VALUES ($1, $2, $3)
           ON CONFLICT (key, org_id) DO UPDATE SET value = EXCLUDED.value`,
          [k, typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v), orgId]
        );
      }
    });

    res.json(await getAll(orgId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/settings/exchange-rates
router.get('/exchange-rates', async (req, res) => {
  try {
    const row = (await sql`SELECT value FROM settings WHERE key = 'exchange_rates' AND org_id = ${req.user.org_id}`)[0];
    res.json({ AED: 1, ...(row ? JSON.parse(row.value) : {}) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
