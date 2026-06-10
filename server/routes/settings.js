const express = require('express');
const db = require('../db/database');
const { requireAuth, requireMinRole } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

function getAll(orgId) {
  const rows = db.prepare('SELECT key, value FROM settings WHERE org_id = ?').all(orgId);
  const out = {};
  rows.forEach(r => { try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; } });
  return out;
}

// GET /api/settings
router.get('/', (req, res) => {
  try { res.json(getAll(req.user.org_id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/settings  { key: value, ... }
router.put('/', requireMinRole('finance'), (req, res) => {
  try {
    const orgId = req.user.org_id;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, org_id) VALUES (?, ?, ?)');
    db.transaction(() => {
      Object.entries(req.body).forEach(([k, v]) => {
        stmt.run(k, typeof v === 'object' ? JSON.stringify(v) : String(v), orgId);
      });
    })();
    res.json(getAll(orgId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/settings/exchange-rates
router.get('/exchange-rates', (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rates' AND org_id = ?").get(req.user.org_id);
    res.json({ AED: 1, ...(row ? JSON.parse(row.value) : {}) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
