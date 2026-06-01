const express = require('express');
const db = require('../db/database');
const router = express.Router();

function getAll() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  rows.forEach(r => { try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; } });
  return out;
}

// GET /api/settings
router.get('/', (req, res) => {
  try { res.json(getAll()); } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/settings  { key: value, ... }
router.put('/', (req, res) => {
  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    db.transaction(() => {
      Object.entries(req.body).forEach(([k, v]) => {
        stmt.run(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      });
    })();
    res.json(getAll());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/settings/exchange-rates
router.get('/exchange-rates', (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rates'").get();
    res.json({ AED: 1, ...(row ? JSON.parse(row.value) : {}) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
