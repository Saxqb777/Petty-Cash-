const express = require('express');
const db = require('../db/database');
const router = express.Router();

// GET /api/savings — paginated list with filters
router.get('/', (req, res) => {
  try {
    const { business_unit, from, to, import_export, page = 1, limit = 50 } = req.query;
    let query = 'SELECT * FROM clearance_savings WHERE 1=1';
    const params = [];

    if (business_unit) { query += ' AND business_unit = ?'; params.push(business_unit); }
    if (from) { query += ' AND date >= ?'; params.push(from); }
    if (to) { query += ' AND date <= ?'; params.push(to); }
    if (import_export) { query += ' AND import_export = ?'; params.push(import_export); }

    query += ' ORDER BY date DESC, created_at DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const total = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as total')).get(...params)?.total || 0;
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const records = db.prepare(query).all(...params);
    res.json({ records, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/savings/summary — dashboard data
router.get('/summary', (req, res) => {
  try {
    const { from, to } = req.query;

    let savingsQuery = 'SELECT COALESCE(SUM(savings), 0) as gross FROM clearance_savings WHERE 1=1';
    const savingsParams = [];
    if (from) { savingsQuery += ' AND date >= ?'; savingsParams.push(from); }
    if (to) { savingsQuery += ' AND date <= ?'; savingsParams.push(to); }

    const gross = db.prepare(savingsQuery).get(...savingsParams).gross;

    let fuelQuery = "SELECT COALESCE(SUM(COALESCE(amount_aed, amount)), 0) as fuel FROM expenses WHERE expense_type = 'adnoc'";
    const fuelParams = [];
    if (from) { fuelQuery += ' AND date >= ?'; fuelParams.push(from); }
    if (to) { fuelQuery += ' AND date <= ?'; fuelParams.push(to); }

    const fuelCost = db.prepare(fuelQuery).get(...fuelParams).fuel;
    const net = gross - fuelCost;

    // By BU
    let buQuery = 'SELECT business_unit, SUM(savings) as total, COUNT(*) as count FROM clearance_savings WHERE 1=1';
    const buParams = [...savingsParams];
    if (from) buQuery += ' AND date >= ?';
    if (to) buQuery += ' AND date <= ?';
    buQuery += ' GROUP BY business_unit ORDER BY total DESC';
    // Avoid double-pushing — rebuild
    let buQ2 = 'SELECT business_unit, SUM(savings) as total, COUNT(*) as count FROM clearance_savings WHERE 1=1';
    const buP2 = [];
    if (from) { buQ2 += ' AND date >= ?'; buP2.push(from); }
    if (to) { buQ2 += ' AND date <= ?'; buP2.push(to); }
    buQ2 += ' GROUP BY business_unit ORDER BY total DESC';
    const byBU = db.prepare(buQ2).all(...buP2);

    // Monthly trend
    let trendQ = "SELECT strftime('%Y-%m', date) as month, SUM(savings) as total, COUNT(*) as count FROM clearance_savings WHERE 1=1";
    const trendP = [];
    if (from) { trendQ += ' AND date >= ?'; trendP.push(from); }
    if (to) { trendQ += ' AND date <= ?'; trendP.push(to); }
    trendQ += " GROUP BY strftime('%Y-%m', date) ORDER BY month ASC";
    const monthlyTrend = db.prepare(trendQ).all(...trendP);

    res.json({ gross, fuelCost, net, byBU, monthlyTrend });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/savings — create single record
router.post('/', (req, res) => {
  try {
    const {
      date, month, business_unit, port, reference_number, import_export,
      previous_agent, current_agent, old_fee = 0, new_fee = 0, savings,
      project_name, description
    } = req.body;

    if (!date) return res.status(400).json({ error: 'date is required' });

    const computedSavings = savings !== undefined ? parseFloat(savings) : parseFloat(old_fee) - parseFloat(new_fee);

    const result = db.prepare(`
      INSERT INTO clearance_savings
        (date, month, business_unit, port, reference_number, import_export,
         previous_agent, current_agent, old_fee, new_fee, savings, project_name, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      date, month || null, business_unit || null, port || null,
      reference_number || null, import_export || null,
      previous_agent || null, current_agent || null,
      parseFloat(old_fee), parseFloat(new_fee), computedSavings,
      project_name || null, description || null
    );

    res.status(201).json(db.prepare('SELECT * FROM clearance_savings WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/savings/bulk — create many records
router.post('/bulk', (req, res) => {
  try {
    const records = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'Expected an array' });

    const stmt = db.prepare(`
      INSERT INTO clearance_savings
        (date, month, business_unit, port, reference_number, import_export,
         previous_agent, current_agent, old_fee, new_fee, savings, project_name, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows) => {
      for (const r of rows) {
        const computedSavings = r.savings !== undefined ? parseFloat(r.savings) : parseFloat(r.old_fee || 0) - parseFloat(r.new_fee || 0);
        stmt.run(
          r.date, r.month || null, r.business_unit || null, r.port || null,
          r.reference_number || null, r.import_export || null,
          r.previous_agent || null, r.current_agent || null,
          parseFloat(r.old_fee || 0), parseFloat(r.new_fee || 0), computedSavings,
          r.project_name || null, r.description || null
        );
      }
    });

    insertMany(records);
    res.status(201).json({ inserted: records.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/savings/:id
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM clearance_savings WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
