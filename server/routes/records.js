const express = require('express');
const db = require('../db/database');

const router = express.Router();

// GET all records with optional filters
router.get('/', (req, res) => {
  try {
    const { from, to, category, business_unit, search, page = 1, limit = 50 } = req.query;
    let query = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];

    if (from) { query += ' AND date >= ?'; params.push(from); }
    if (to) { query += ' AND date <= ?'; params.push(to); }
    if (category) { query += ' AND category = ?'; params.push(category); }
    if (business_unit) { query += ' AND business_unit = ?'; params.push(business_unit); }
    if (search) {
      query += ' AND (vendor_name LIKE ? OR purpose LIKE ? OR invoice_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY date DESC, created_at DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const total = db.prepare(countQuery).get(...params)?.total || 0;

    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const records = db.prepare(query).all(...params);
    const parsed = records.map(r => ({ ...r, line_items: JSON.parse(r.line_items || '[]') }));

    res.json({ records: parsed, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single record
router.get('/:id', (req, res) => {
  try {
    const record = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json({ ...record, line_items: JSON.parse(record.line_items || '[]') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create record
router.post('/', (req, res) => {
  try {
    const {
      invoice_number, vendor_name, amount, currency = 'AED', date,
      category, business_unit, payment_method = 'Cash',
      purpose, submitted_by, line_items = [], notes, image_path
    } = req.body;

    if (!vendor_name || !amount || !date || !category) {
      return res.status(400).json({ error: 'vendor_name, amount, date, and category are required' });
    }

    const stmt = db.prepare(`
      INSERT INTO expenses (invoice_number, vendor_name, amount, currency, date, category,
        business_unit, payment_method, purpose, submitted_by, line_items, notes, image_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      invoice_number || null, vendor_name, parseFloat(amount), currency, date, category,
      business_unit || null, payment_method, purpose || null, submitted_by || null,
      JSON.stringify(line_items), notes || null, image_path || null
    );

    const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ ...created, line_items: JSON.parse(created.line_items || '[]') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update record
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    const {
      invoice_number, vendor_name, amount, currency, date, category,
      business_unit, payment_method, purpose, submitted_by, line_items, notes, image_path
    } = req.body;

    db.prepare(`
      UPDATE expenses SET
        invoice_number = ?, vendor_name = ?, amount = ?, currency = ?, date = ?,
        category = ?, business_unit = ?, payment_method = ?, purpose = ?,
        submitted_by = ?, line_items = ?, notes = ?, image_path = ?
      WHERE id = ?
    `).run(
      invoice_number ?? existing.invoice_number,
      vendor_name ?? existing.vendor_name,
      amount !== undefined ? parseFloat(amount) : existing.amount,
      currency ?? existing.currency,
      date ?? existing.date,
      category ?? existing.category,
      business_unit !== undefined ? business_unit : existing.business_unit,
      payment_method ?? existing.payment_method,
      purpose !== undefined ? purpose : existing.purpose,
      submitted_by !== undefined ? submitted_by : existing.submitted_by,
      JSON.stringify(line_items ?? JSON.parse(existing.line_items || '[]')),
      notes !== undefined ? notes : existing.notes,
      image_path !== undefined ? image_path : existing.image_path,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    res.json({ ...updated, line_items: JSON.parse(updated.line_items || '[]') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE record
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET dashboard stats
router.get('/stats/dashboard', (req, res) => {
  try {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const totalSpent = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses").get().total;
    const thisMonthTotal = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y-%m', date) = ?").get(thisMonth).total;
    const lastMonthTotal = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y-%m', date) = ?").get(lastMonth).total;
    const avgTransaction = db.prepare("SELECT COALESCE(AVG(amount), 0) as avg FROM expenses").get().avg;
    const totalCount = db.prepare("SELECT COUNT(*) as count FROM expenses").get().count;

    const topCategory = db.prepare(`
      SELECT category, SUM(amount) as total FROM expenses
      GROUP BY category ORDER BY total DESC LIMIT 1
    `).get();

    const categoryBreakdown = db.prepare(`
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM expenses GROUP BY category ORDER BY total DESC
    `).all();

    const monthlyTrend = db.prepare(`
      SELECT strftime('%Y-%m', date) as month, SUM(amount) as total, COUNT(*) as count
      FROM expenses
      WHERE date >= date('now', '-6 months')
      GROUP BY month ORDER BY month ASC
    `).all();

    const recentTransactions = db.prepare(`
      SELECT * FROM expenses ORDER BY date DESC, created_at DESC LIMIT 8
    `).all().map(r => ({ ...r, line_items: JSON.parse(r.line_items || '[]') }));

    const monthChange = lastMonthTotal > 0
      ? (((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1)
      : null;

    res.json({
      totalSpent,
      thisMonthTotal,
      lastMonthTotal,
      monthChange,
      avgTransaction,
      totalCount,
      topCategory,
      categoryBreakdown,
      monthlyTrend,
      recentTransactions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
