const express = require('express');
const db = require('../db/database');
const { requireAuth, requireMinRole } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

router.get('/by-expense/:expenseId', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM clearance_savings WHERE expense_id = ? AND org_id = ?').get(req.params.expenseId, req.user.org_id);
    res.json(row || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireMinRole('finance'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM clearance_savings WHERE id = ? AND org_id = ?').get(req.params.id, req.user.org_id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const b = req.body;
    const old_fee = b.old_fee !== undefined ? parseFloat(b.old_fee) : existing.old_fee;
    const new_fee = b.new_fee !== undefined ? parseFloat(b.new_fee) : existing.new_fee;
    db.prepare(`
      UPDATE clearance_savings SET old_fee=?, new_fee=?, savings=?,
        previous_agent=?, current_agent=?, port=?, import_export=?, business_unit=?, description=?
      WHERE id=? AND org_id=?
    `).run(old_fee, new_fee, old_fee - new_fee,
      b.previous_agent ?? existing.previous_agent, b.current_agent ?? existing.current_agent,
      b.port ?? existing.port, b.import_export ?? existing.import_export,
      b.business_unit ?? existing.business_unit, b.description ?? existing.description,
      req.params.id, req.user.org_id);
    res.json(db.prepare('SELECT * FROM clearance_savings WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/agent-rates', (req, res) => {
  try {
    const { previous_agent, port, import_export } = req.query;
    if (!previous_agent) return res.json({ suggested_fee: null });
    const orgId = req.user.org_id;
    const queries = [
      { sql: 'SELECT old_fee, COUNT(*) as freq FROM clearance_savings WHERE org_id=? AND LOWER(previous_agent)=LOWER(?) AND port=? AND import_export=? GROUP BY old_fee ORDER BY freq DESC LIMIT 1', params: [orgId, previous_agent, port, import_export] },
      { sql: 'SELECT old_fee, COUNT(*) as freq FROM clearance_savings WHERE org_id=? AND LOWER(previous_agent)=LOWER(?) AND port=? GROUP BY old_fee ORDER BY freq DESC LIMIT 1', params: [orgId, previous_agent, port] },
      { sql: 'SELECT old_fee, COUNT(*) as freq FROM clearance_savings WHERE org_id=? AND LOWER(previous_agent)=LOWER(?) GROUP BY old_fee ORDER BY freq DESC LIMIT 1', params: [orgId, previous_agent] },
    ];
    for (const q of queries) {
      const row = db.prepare(q.sql).get(...q.params.filter(p => p !== undefined && p !== ''));
      if (row) return res.json({ suggested_fee: row.old_fee, match: 'historical' });
    }
    res.json({ suggested_fee: null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', (req, res) => {
  try {
    const { business_unit, from, to, import_export, page = 1, limit = 50 } = req.query;
    let query = 'SELECT * FROM clearance_savings WHERE org_id = ?';
    const params = [req.user.org_id];
    if (business_unit) { query += ' AND business_unit = ?'; params.push(business_unit); }
    if (from) { query += ' AND date >= ?'; params.push(from); }
    if (to)   { query += ' AND date <= ?'; params.push(to); }
    if (import_export) { query += ' AND import_export = ?'; params.push(import_export); }
    query += ' ORDER BY date DESC, created_at DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const total = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as total')).get(...params)?.total || 0;
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    res.json({ records: db.prepare(query).all(...params), total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/summary', (req, res) => {
  try {
    const { from, to } = req.query;
    const orgId = req.user.org_id;
    const p = [orgId];
    let wh = 'org_id=?';
    if (from) { wh += ' AND date>=?'; p.push(from); }
    if (to)   { wh += ' AND date<=?'; p.push(to); }
    const gross = db.prepare(`SELECT COALESCE(SUM(savings),0) as v FROM clearance_savings WHERE ${wh}`).get(...p).v;
    const byBU  = db.prepare(`SELECT business_unit, SUM(savings) as total, COUNT(*) as count FROM clearance_savings WHERE ${wh} GROUP BY business_unit ORDER BY total DESC`).all(...p);
    const monthlyTrend = db.prepare(`SELECT strftime('%Y-%m',date) as month, SUM(savings) as total, COUNT(*) as count FROM clearance_savings WHERE ${wh} GROUP BY strftime('%Y-%m',date) ORDER BY month ASC`).all(...p);
    res.json({ gross, fuelCost: 0, net: gross, byBU, monthlyTrend });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireMinRole('finance'), (req, res) => {
  try {
    const { date, month, business_unit, port, reference_number, import_export, previous_agent, current_agent, old_fee = 0, new_fee = 0, savings, project_name, description } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });
    const computedSavings = savings !== undefined ? parseFloat(savings) : parseFloat(old_fee) - parseFloat(new_fee);
    const result = db.prepare(`
      INSERT INTO clearance_savings (org_id, date, month, business_unit, port, reference_number, import_export, previous_agent, current_agent, old_fee, new_fee, savings, project_name, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.org_id, date, month || null, business_unit || null, port || null, reference_number || null, import_export || null, previous_agent || null, current_agent || null, parseFloat(old_fee), parseFloat(new_fee), computedSavings, project_name || null, description || null);
    res.status(201).json(db.prepare('SELECT * FROM clearance_savings WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk', requireMinRole('finance'), (req, res) => {
  try {
    const records = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'Expected an array' });
    const stmt = db.prepare(`INSERT INTO clearance_savings (org_id,date,month,business_unit,port,reference_number,import_export,previous_agent,current_agent,old_fee,new_fee,savings,project_name,description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insertMany = db.transaction((rows) => {
      for (const r of rows) {
        const s = r.savings !== undefined ? parseFloat(r.savings) : parseFloat(r.old_fee || 0) - parseFloat(r.new_fee || 0);
        stmt.run(req.user.org_id, r.date, r.month||null, r.business_unit||null, r.port||null, r.reference_number||null, r.import_export||null, r.previous_agent||null, r.current_agent||null, parseFloat(r.old_fee||0), parseFloat(r.new_fee||0), s, r.project_name||null, r.description||null);
      }
    });
    insertMany(records);
    res.status(201).json({ inserted: records.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireMinRole('finance'), (req, res) => {
  try {
    const result = db.prepare('DELETE FROM clearance_savings WHERE id = ? AND org_id = ?').run(req.params.id, req.user.org_id);
    if (result.changes === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
