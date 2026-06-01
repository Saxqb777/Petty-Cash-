const express = require('express');
const db = require('../db/database');

const router = express.Router();

function getRate(currency) {
  if (!currency || currency === 'AED') return 1;
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rates'").get();
    const rates = JSON.parse(row?.value || '{}');
    return rates[currency] || 1;
  } catch { return 1; }
}

const parseRecord = (r) => {
  if (!r) return null;
  try {
    return {
      ...r,
      line_items:        JSON.parse(r.line_items        || '[]'),
      container_numbers: JSON.parse(r.container_numbers || '[]'),
      bl_numbers:        JSON.parse(r.bl_numbers        || '[]'),
    };
  } catch (e) {
    console.error('JSON parse error for record', r.id, e.message);
    return { ...r, line_items: [], container_numbers: [], bl_numbers: [] };
  }
};

// GET all records with optional filters
router.get('/', (req, res) => {
  try {
    const { from, to, category, business_unit, expense_type, search, page = 1, limit = 50, sort_by, sort_dir } = req.query;
    let query = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];

    if (from) { query += ' AND date >= ?'; params.push(from); }
    if (to) { query += ' AND date <= ?'; params.push(to); }
    if (category) { query += ' AND category = ?'; params.push(category); }
    if (business_unit) { query += ' AND business_unit = ?'; params.push(business_unit); }
    if (expense_type) { query += ' AND expense_type = ?'; params.push(expense_type); }
    if (search) {
      query += ' AND (vendor_name LIKE ? OR purpose LIKE ? OR invoice_number LIKE ? OR bl_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const ALLOWED_SORT = { date: 'date', amount_aed: 'COALESCE(amount_aed,amount)', vendor_name: 'vendor_name', category: 'category', business_unit: 'business_unit' };
    const sortCol = ALLOWED_SORT[sort_by] || 'date';
    const sortDir = sort_dir === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${sortDir}, created_at DESC`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const total = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as total')).get(...params)?.total || 0;
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const records = db.prepare(query).all(...params).map(parseRecord);
    res.json({ records, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single record
router.get('/:id', (req, res) => {
  try {
    const record = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(parseRecord(record));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create record
router.post('/', (req, res) => {
  try {
    const {
      expense_type = 'general', invoice_number, vendor_name, amount, currency = 'AED', date,
      category, business_unit, payment_method = 'Cash', purpose, submitted_by,
      line_items = [], notes, image_path,
      bl_number, container_number, port, shipment_type,
      container_numbers = [], bl_numbers = [],
      savings_old_fee, savings_previous_agent, savings_record = false,
    } = req.body;

    // Required field validation
    if (!vendor_name || !amount || !date || !category) {
      return res.status(400).json({ error: 'vendor_name, amount, date, and category are required' });
    }

    // Type validation
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    }

    // Sanitize strings
    const clean = (s, max = 500) => (s || '').toString().trim().slice(0, max) || null;

    // Duplicate detection — same invoice + vendor + amount + date
    if (invoice_number) {
      const dupe = db.prepare(
        'SELECT id FROM expenses WHERE invoice_number=? AND vendor_name=? AND date=? AND amount=?'
      ).get(invoice_number, vendor_name, date, parsedAmount);
      if (dupe) return res.status(409).json({ error: `Duplicate: this bill was already recorded (Record #${dupe.id})`, existingId: dupe.id });
    }

    const rate = getRate(currency);
    const amount_aed = parsedAmount * rate;

    const doInsert = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO expenses (expense_type, invoice_number, vendor_name, amount, currency, date,
          category, business_unit, payment_method, purpose, submitted_by, line_items, notes,
          image_path, bl_number, container_number, port, shipment_type,
          amount_aed, exchange_rate, container_numbers, bl_numbers)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        clean(expense_type, 50) || 'general', clean(invoice_number, 100), clean(vendor_name, 255), parsedAmount, clean(currency, 10) || 'AED', date,
        clean(category, 100), clean(business_unit, 50), clean(payment_method, 50) || 'Cash', clean(purpose), clean(submitted_by, 100),
        JSON.stringify(line_items), clean(notes, 1000), image_path || null,
        bl_number || null, container_number || null, port || null, shipment_type || null,
        amount_aed, rate,
        JSON.stringify(Array.isArray(container_numbers) ? container_numbers : []),
        JSON.stringify(Array.isArray(bl_numbers) ? bl_numbers : [])
      );

      const expenseId = result.lastInsertRowid;

      // Auto-create savings record for shipping bills when old fee is provided
      if (expense_type === 'shipping' && savings_record && savings_old_fee != null) {
        const parsedItems = Array.isArray(line_items) ? line_items : [];
        // new_fee = total bill paid (what you now pay instead of the old agent covering everything)
        const new_fee = parsedItems.reduce((s, li) => s + (parseFloat(li.amount) || 0), 0) || parseFloat(amount) || 0;
        const old_fee = parseFloat(savings_old_fee) || 0;
        const savings = old_fee - new_fee;
        const bls = Array.isArray(bl_numbers) && bl_numbers.length ? bl_numbers : bl_number ? [bl_number] : [];

        // Delete any existing savings record linked to this expense (in case of re-save)
        db.prepare('DELETE FROM clearance_savings WHERE expense_id = ?').run(expenseId);

        db.prepare(`
          INSERT INTO clearance_savings
            (expense_id, date, business_unit, port, import_export, reference_number,
             previous_agent, current_agent, old_fee, new_fee, savings)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          expenseId, date, business_unit || null, port || null,
          shipment_type || null,
          bls.join(', ') || invoice_number || null,
          savings_previous_agent || null,
          vendor_name,
          old_fee, new_fee, savings
        );
      }

      return expenseId;
    });

    const expenseId = doInsert();
    res.status(201).json(parseRecord(db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update record
router.put('/:id', (req, res) => {
  try {
    const ex = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Record not found' });
    const b = req.body;

    const newCurrency = b.currency ?? ex.currency;
    const newAmount = b.amount !== undefined ? parseFloat(b.amount) : ex.amount;
    const rate = getRate(newCurrency);
    const amount_aed = newAmount * rate;

    const newContainerNumbers = b.container_numbers !== undefined
      ? JSON.stringify(Array.isArray(b.container_numbers) ? b.container_numbers : [])
      : (ex.container_numbers || '[]');
    const newBlNumbers = b.bl_numbers !== undefined
      ? JSON.stringify(Array.isArray(b.bl_numbers) ? b.bl_numbers : [])
      : (ex.bl_numbers || '[]');

    db.prepare(`
      UPDATE expenses SET
        expense_type = ?, invoice_number = ?, vendor_name = ?, amount = ?, currency = ?, date = ?,
        category = ?, business_unit = ?, payment_method = ?, purpose = ?, submitted_by = ?,
        line_items = ?, notes = ?, image_path = ?,
        bl_number = ?, container_number = ?, port = ?, shipment_type = ?,
        amount_aed = ?, exchange_rate = ?, container_numbers = ?, bl_numbers = ?
      WHERE id = ?
    `).run(
      b.expense_type ?? ex.expense_type ?? 'general',
      b.invoice_number ?? ex.invoice_number,
      b.vendor_name ?? ex.vendor_name,
      newAmount,
      newCurrency,
      b.date ?? ex.date,
      b.category ?? ex.category,
      b.business_unit !== undefined ? b.business_unit : ex.business_unit,
      b.payment_method ?? ex.payment_method,
      b.purpose !== undefined ? b.purpose : ex.purpose,
      b.submitted_by !== undefined ? b.submitted_by : ex.submitted_by,
      JSON.stringify(b.line_items ?? JSON.parse(ex.line_items || '[]')),
      b.notes !== undefined ? b.notes : ex.notes,
      b.image_path !== undefined ? b.image_path : ex.image_path,
      b.bl_number !== undefined ? b.bl_number : ex.bl_number,
      b.container_number !== undefined ? b.container_number : ex.container_number,
      b.port !== undefined ? b.port : ex.port,
      b.shipment_type !== undefined ? b.shipment_type : ex.shipment_type,
      amount_aed, rate,
      newContainerNumbers, newBlNumbers,
      req.params.id
    );

    res.json(parseRecord(db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE record
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM clearance_savings WHERE expense_id = ?').run(req.params.id);
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

    const totalSpent = db.prepare("SELECT COALESCE(SUM(COALESCE(amount_aed, amount)), 0) as total FROM expenses").get().total;
    const thisMonthTotal = db.prepare("SELECT COALESCE(SUM(COALESCE(amount_aed, amount)), 0) as total FROM expenses WHERE strftime('%Y-%m', date) = ?").get(thisMonth).total;
    const lastMonthTotal = db.prepare("SELECT COALESCE(SUM(COALESCE(amount_aed, amount)), 0) as total FROM expenses WHERE strftime('%Y-%m', date) = ?").get(lastMonth).total;
    const avgTransaction = db.prepare("SELECT COALESCE(AVG(COALESCE(amount_aed, amount)), 0) as avg FROM expenses").get().avg;
    const totalCount = db.prepare("SELECT COUNT(*) as count FROM expenses").get().count;
    const foreignCurrencyCount = db.prepare("SELECT COUNT(*) as count FROM expenses WHERE currency != 'AED'").get().count;
    const topCategory = db.prepare("SELECT category, SUM(COALESCE(amount_aed, amount)) as total FROM expenses GROUP BY category ORDER BY total DESC LIMIT 1").get();
    const categoryBreakdown = db.prepare("SELECT category, SUM(COALESCE(amount_aed, amount)) as total, COUNT(*) as count FROM expenses GROUP BY category ORDER BY total DESC").all();
    const monthlyTrend = db.prepare("SELECT strftime('%Y-%m', date) as month, SUM(COALESCE(amount_aed, amount)) as total, COUNT(*) as count FROM expenses WHERE date >= date('now', '-6 months') GROUP BY month ORDER BY month ASC").all();
    const recentTransactions = db.prepare("SELECT * FROM expenses ORDER BY date DESC, created_at DESC LIMIT 8").all().map(parseRecord);
    const monthChange = lastMonthTotal > 0 ? (((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1) : null;

    // Savings data
    const savingsGross = db.prepare("SELECT COALESCE(SUM(savings), 0) as total FROM clearance_savings").get().total;
    const fuelSpent = db.prepare("SELECT COALESCE(SUM(COALESCE(amount_aed, amount)), 0) as total FROM expenses WHERE expense_type = 'adnoc'").get().total;
    const savingsNet = savingsGross - fuelSpent;

    res.json({
      totalSpent, thisMonthTotal, lastMonthTotal, monthChange, avgTransaction, totalCount,
      foreignCurrencyCount, topCategory, categoryBreakdown, monthlyTrend, recentTransactions,
      savingsGross, fuelSpent, savingsNet
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
