const express = require('express');
const db = require('../db/database');
const { convertToAed, addMoney } = require('../utils/money');
const { requireAuth, requireMinRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const SUPPORTED_CURRENCIES = ['AED','USD','EUR','GBP','SAR','QAR','KWD','OMR','INR'];

function getRates(orgId) {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rates' AND org_id = ?").get(orgId);
    return { AED: 1, ...JSON.parse(row?.value || '{}') };
  } catch { return { AED: 1 }; }
}

function getRate(currency, orgId) {
  if (!currency || currency === 'AED') return 1;
  return getRates(orgId)[currency] || 1;
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
  } catch {
    return { ...r, line_items: [], container_numbers: [], bl_numbers: [] };
  }
};

// GET all records
router.get('/', (req, res) => {
  try {
    const { from, to, category, business_unit, expense_type, search, page = 1, limit = 50, sort_by, sort_dir } = req.query;
    let query = 'SELECT * FROM expenses WHERE org_id = ?';
    const params = [req.user.org_id];

    if (from)         { query += ' AND date >= ?';        params.push(from); }
    if (to)           { query += ' AND date <= ?';        params.push(to); }
    if (category)     { query += ' AND category = ?';     params.push(category); }
    if (business_unit){ query += ' AND business_unit = ?';params.push(business_unit); }
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
    const record = db.prepare('SELECT * FROM expenses WHERE id = ? AND org_id = ?').get(req.params.id, req.user.org_id);
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
      line_items = [], notes, image_path, file_hash,
      bl_number, container_number, port, shipment_type,
      container_numbers = [], bl_numbers = [],
      savings_old_fee, savings_previous_agent, savings_record = false,
      needs_review = 0, review_notes,
    } = req.body;

    if (!vendor_name || !amount || !date || !category)
      return res.status(400).json({ error: 'vendor_name, amount, date, and category are required' });

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0)
      return res.status(400).json({ error: 'amount must be a positive number' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });

    const clean = (s, max = 500) => (s || '').toString().trim().slice(0, max) || null;
    const orgId = req.user.org_id;

    // Duplicate detection — all checks scoped to this org
    if (file_hash) {
      const hashDupe = db.prepare('SELECT id, vendor_name, date FROM expenses WHERE file_hash = ? AND org_id = ?').get(file_hash, orgId);
      if (hashDupe) return res.status(409).json({ error: `Duplicate: this exact receipt was already recorded (Record #${hashDupe.id})`, existingId: hashDupe.id, duplicateType: 'file' });
    }
    if (invoice_number) {
      const invDupe = db.prepare('SELECT id FROM expenses WHERE invoice_number=? AND vendor_name=? AND date=? AND amount=? AND org_id=?').get(invoice_number, vendor_name, date, parsedAmount, orgId);
      if (invDupe) return res.status(409).json({ error: `Duplicate: invoice already recorded (Record #${invDupe.id})`, existingId: invDupe.id, duplicateType: 'invoice' });
    }
    let softDuplicateWarning = null;
    if (!invoice_number) {
      const softDupe = db.prepare("SELECT id FROM expenses WHERE (invoice_number IS NULL OR invoice_number = '') AND vendor_name=? AND date=? AND amount=? AND org_id=?").get(vendor_name, date, parsedAmount, orgId);
      if (softDupe) softDuplicateWarning = { existingId: softDupe.id, message: `Similar expense already exists as Record #${softDupe.id} — saved anyway, please verify.` };
    }

    const cleanCurrency = (clean(currency, 10) || 'AED').toUpperCase();
    let rate, amount_aed;
    if (cleanCurrency === 'AED') {
      rate = 1; amount_aed = parsedAmount;
    } else {
      const rates = getRates(orgId);
      if (!rates[cleanCurrency]) return res.status(400).json({ error: `Unsupported currency: ${cleanCurrency}` });
      rate = rates[cleanCurrency];
      amount_aed = convertToAed(parsedAmount, rate);
    }

    const doInsert = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO expenses (org_id, expense_type, invoice_number, vendor_name, amount, currency, date,
          category, business_unit, payment_method, purpose, submitted_by, line_items, notes,
          image_path, bl_number, container_number, port, shipment_type,
          amount_aed, exchange_rate, container_numbers, bl_numbers, file_hash, needs_review, review_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orgId,
        clean(expense_type, 50) || 'general', clean(invoice_number, 100), clean(vendor_name, 255),
        parsedAmount, cleanCurrency, date, clean(category, 100), clean(business_unit, 50),
        clean(payment_method, 50) || 'Cash', clean(purpose), clean(submitted_by, 100),
        JSON.stringify(line_items), clean(notes, 1000), image_path || null,
        bl_number || null, container_number || null, port || null, shipment_type || null,
        amount_aed, rate,
        JSON.stringify(Array.isArray(container_numbers) ? container_numbers : []),
        JSON.stringify(Array.isArray(bl_numbers) ? bl_numbers : []),
        file_hash || null, needs_review ? 1 : 0, review_notes || null
      );

      const expenseId = result.lastInsertRowid;

      if (expense_type === 'shipping' && savings_record && savings_old_fee != null) {
        const parsedItems = Array.isArray(line_items) ? line_items : [];
        const new_fee = parsedItems.length ? addMoney(...parsedItems.map(li => li.amount)) : parsedAmount;
        const old_fee = parseFloat(savings_old_fee) || 0;
        const savings = addMoney(old_fee, -new_fee);
        const bls = Array.isArray(bl_numbers) && bl_numbers.length ? bl_numbers : bl_number ? [bl_number] : [];

        db.prepare('DELETE FROM clearance_savings WHERE expense_id = ?').run(expenseId);
        db.prepare(`
          INSERT INTO clearance_savings
            (org_id, expense_id, date, business_unit, port, import_export, reference_number,
             previous_agent, current_agent, old_fee, new_fee, savings)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(orgId, expenseId, date, business_unit || null, port || null,
          shipment_type || null, bls.join(', ') || invoice_number || null,
          savings_previous_agent || null, vendor_name, old_fee, new_fee, savings);
      }

      return expenseId;
    });

    const expenseId = doInsert();
    const saved = parseRecord(db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId));
    res.status(201).json({ ...saved, warning: softDuplicateWarning || undefined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update record
router.put('/:id', (req, res) => {
  try {
    const ex = db.prepare('SELECT * FROM expenses WHERE id = ? AND org_id = ?').get(req.params.id, req.user.org_id);
    if (!ex) return res.status(404).json({ error: 'Record not found' });
    const b = req.body;

    const newCurrency = (b.currency ?? ex.currency ?? 'AED').toUpperCase();
    const newAmount = b.amount !== undefined ? parseFloat(b.amount) : ex.amount;
    const rate = newCurrency === 'AED' ? 1 : getRate(newCurrency, req.user.org_id);
    const amount_aed = newCurrency === 'AED' ? newAmount : convertToAed(newAmount, rate);

    db.prepare(`
      UPDATE expenses SET
        expense_type=?, invoice_number=?, vendor_name=?, amount=?, currency=?, date=?,
        category=?, business_unit=?, payment_method=?, purpose=?, submitted_by=?,
        line_items=?, notes=?, image_path=?,
        bl_number=?, container_number=?, port=?, shipment_type=?,
        amount_aed=?, exchange_rate=?, container_numbers=?, bl_numbers=?
      WHERE id=? AND org_id=?
    `).run(
      b.expense_type ?? ex.expense_type ?? 'general',
      b.invoice_number ?? ex.invoice_number,
      b.vendor_name ?? ex.vendor_name, newAmount, newCurrency,
      b.date ?? ex.date, b.category ?? ex.category,
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
      b.container_numbers !== undefined ? JSON.stringify(Array.isArray(b.container_numbers) ? b.container_numbers : []) : (ex.container_numbers || '[]'),
      b.bl_numbers !== undefined ? JSON.stringify(Array.isArray(b.bl_numbers) ? b.bl_numbers : []) : (ex.bl_numbers || '[]'),
      req.params.id, req.user.org_id
    );

    res.json(parseRecord(db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE record
router.delete('/:id', requireMinRole('finance'), (req, res) => {
  try {
    db.prepare('DELETE FROM clearance_savings WHERE expense_id = ?').run(req.params.id);
    const result = db.prepare('DELETE FROM expenses WHERE id = ? AND org_id = ?').run(req.params.id, req.user.org_id);
    if (result.changes === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET dashboard stats
router.get('/stats/dashboard', (req, res) => {
  try {
    const orgId = req.user.org_id;
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const q = (sql, ...p) => db.prepare(sql).get(orgId, ...p);
    const qa = (sql, ...p) => db.prepare(sql).all(orgId, ...p);

    const totalSpent      = q("SELECT COALESCE(SUM(COALESCE(amount_aed,amount)),0) as v FROM expenses WHERE org_id=?").v;
    const thisMonthTotal  = q("SELECT COALESCE(SUM(COALESCE(amount_aed,amount)),0) as v FROM expenses WHERE org_id=? AND strftime('%Y-%m',date)=?", thisMonth).v;
    const lastMonthTotal  = q("SELECT COALESCE(SUM(COALESCE(amount_aed,amount)),0) as v FROM expenses WHERE org_id=? AND strftime('%Y-%m',date)=?", lastMonth).v;
    const avgTransaction  = q("SELECT COALESCE(AVG(COALESCE(amount_aed,amount)),0) as v FROM expenses WHERE org_id=?").v;
    const totalCount      = q("SELECT COUNT(*) as v FROM expenses WHERE org_id=?").v;
    const foreignCurrencyCount = q("SELECT COUNT(*) as v FROM expenses WHERE org_id=? AND currency!='AED'").v;
    const needsReviewCount = q("SELECT COUNT(*) as v FROM expenses WHERE org_id=? AND needs_review=1").v;
    const topCategory     = q("SELECT category, SUM(COALESCE(amount_aed,amount)) as total FROM expenses WHERE org_id=? GROUP BY category ORDER BY total DESC LIMIT 1");
    const categoryBreakdown = qa("SELECT category, SUM(COALESCE(amount_aed,amount)) as total, COUNT(*) as count FROM expenses WHERE org_id=? GROUP BY category ORDER BY total DESC");
    const monthlyTrend    = qa("SELECT strftime('%Y-%m',date) as month, SUM(COALESCE(amount_aed,amount)) as total, COUNT(*) as count FROM expenses WHERE org_id=? AND date>=date('now','-6 months') GROUP BY month ORDER BY month ASC");
    const recentTransactions = db.prepare("SELECT * FROM expenses WHERE org_id=? ORDER BY date DESC, created_at DESC LIMIT 8").all(orgId).map(parseRecord);
    const monthChange = lastMonthTotal > 0 ? (((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1) : null;

    const savingsGross = db.prepare("SELECT COALESCE(SUM(savings),0) as v FROM clearance_savings WHERE org_id=?").get(orgId).v;

    res.json({
      totalSpent, thisMonthTotal, lastMonthTotal, monthChange, avgTransaction, totalCount,
      foreignCurrencyCount, needsReviewCount, topCategory, categoryBreakdown, monthlyTrend,
      recentTransactions, savingsGross, savingsNet: savingsGross,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
