const express = require('express');
const { sql, query, one, withTransaction, toId } = require('../db');
const { convertToAed, addMoney } = require('../utils/money');
const { requireAuth, requireMinRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

async function getRates(orgId) {
  try {
    const row = await one("SELECT value FROM settings WHERE key = 'exchange_rates' AND org_id = $1", [orgId]);
    return { AED: 1, ...JSON.parse(row?.value || '{}') };
  } catch { return { AED: 1 }; }
}

async function getRate(currency, orgId) {
  if (!currency || currency === 'AED') return 1;
  return (await getRates(orgId))[currency] || 1;
}

// JSON blobs are stored as TEXT (see server/db/schema.sql) so they are parsed
// on the way out, exactly as under SQLite.
const parseRecord = (r) => {
  if (!r) return null;
  try {
    return {
      ...r,
      line_items:        JSON.parse(r.line_items        || '[]'),
      container_numbers: JSON.parse(r.container_numbers || '[]'),
      bl_numbers:        JSON.parse(r.bl_numbers        || '[]'),
      custom_fields:     JSON.parse(r.custom_fields     || '{}'),
    };
  } catch {
    return { ...r, line_items: [], container_numbers: [], bl_numbers: [], custom_fields: {} };
  }
};

// GET all records
router.get('/', async (req, res) => {
  try {
    const { from, to, category, business_unit, expense_type, search, page = 1, limit = 50, sort_by, sort_dir } = req.query;

    const where = ['org_id = $1'];
    const params = [req.user.org_id];
    const bind = (value) => { params.push(value); return `$${params.length}`; };

    if (from)          where.push(`date >= ${bind(from)}`);
    if (to)            where.push(`date <= ${bind(to)}`);
    if (category)      where.push(`category = ${bind(category)}`);
    if (business_unit) where.push(`business_unit = ${bind(business_unit)}`);
    if (expense_type)  where.push(`expense_type = ${bind(expense_type)}`);
    if (search) {
      // SQLite's LIKE is case-insensitive by default; Postgres's is not — ILIKE.
      const p = bind(`%${search}%`);
      where.push(`(vendor_name ILIKE ${p} OR purpose ILIKE ${p} OR invoice_number ILIKE ${p} OR bl_number ILIKE ${p})`);
    }
    const whereSql = where.join(' AND ');

    const ALLOWED_SORT = {
      date: 'date',
      amount_aed: 'COALESCE(amount_aed,amount)',
      vendor_name: 'vendor_name',
      category: 'category',
      business_unit: 'business_unit',
    };
    const sortCol = ALLOWED_SORT[sort_by] || 'date';
    const sortDir = sort_dir === 'asc' ? 'ASC' : 'DESC';

    const totalRow = await one(`SELECT COUNT(*)::int AS total FROM expenses WHERE ${whereSql}`, params);
    const total = totalRow?.total || 0;

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, parseInt(limit, 10) || 50);
    const limitP  = bind(pageSize);
    const offsetP = bind((pageNum - 1) * pageSize);

    const records = (await query(
      `SELECT * FROM expenses WHERE ${whereSql}
       ORDER BY ${sortCol} ${sortDir}, created_at DESC
       LIMIT ${limitP} OFFSET ${offsetP}`,
      params
    )).map(parseRecord);

    res.json({ records, total, page: pageNum, pages: Math.ceil(total / pageSize) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET dashboard stats
// NOTE: declared before '/:id' so "stats" is not swallowed by the id route.
router.get('/stats/dashboard', async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    // `date` is TEXT 'YYYY-MM-DD', so strftime('%Y-%m', date) → substr(date,1,7)
    // and date('now','-N months') → to_char(NOW() - INTERVAL 'N months','YYYY-MM-DD').
    // Both sides stay text, which keeps the comparison lexicographic and exact.
    const [
      totalSpentRow, thisMonthRow, lastMonthRow, avgRow, countRow,
      foreignRow, needsReviewRow, topCategory, categoryBreakdown, monthlyTrend,
      recentRows, savingsRow, dailySpend,
    ] = await Promise.all([
      one('SELECT COALESCE(SUM(COALESCE(amount_aed,amount)),0) AS v FROM expenses WHERE org_id=$1', [orgId]),
      one('SELECT COALESCE(SUM(COALESCE(amount_aed,amount)),0) AS v FROM expenses WHERE org_id=$1 AND substr(date,1,7)=$2', [orgId, thisMonth]),
      one('SELECT COALESCE(SUM(COALESCE(amount_aed,amount)),0) AS v FROM expenses WHERE org_id=$1 AND substr(date,1,7)=$2', [orgId, lastMonth]),
      one('SELECT COALESCE(AVG(COALESCE(amount_aed,amount)),0) AS v FROM expenses WHERE org_id=$1', [orgId]),
      one('SELECT COUNT(*)::int AS v FROM expenses WHERE org_id=$1', [orgId]),
      one("SELECT COUNT(*)::int AS v FROM expenses WHERE org_id=$1 AND currency <> 'AED'", [orgId]),
      one('SELECT COUNT(*)::int AS v FROM expenses WHERE org_id=$1 AND needs_review = TRUE', [orgId]),
      one('SELECT category, SUM(COALESCE(amount_aed,amount)) AS total FROM expenses WHERE org_id=$1 GROUP BY category ORDER BY total DESC LIMIT 1', [orgId]),
      query('SELECT category, SUM(COALESCE(amount_aed,amount)) AS total, COUNT(*)::int AS count FROM expenses WHERE org_id=$1 GROUP BY category ORDER BY total DESC', [orgId]),
      query(
        `SELECT substr(date,1,7) AS month,
                SUM(COALESCE(amount_aed,amount)) AS total,
                COUNT(*)::int AS count
         FROM expenses
         WHERE org_id=$1 AND date >= to_char(NOW() - INTERVAL '6 months', 'YYYY-MM-DD')
         GROUP BY substr(date,1,7)
         ORDER BY month ASC`, [orgId]),
      query('SELECT * FROM expenses WHERE org_id=$1 ORDER BY date DESC, created_at DESC LIMIT 8', [orgId]),
      one('SELECT COALESCE(SUM(savings),0) AS v FROM clearance_savings WHERE org_id=$1', [orgId]),
      query(
        // ROUND(double precision, int) does not exist in Postgres — only
        // ROUND(numeric, int) — hence the cast down to numeric and back.
        `SELECT date, ROUND(SUM(COALESCE(amount_aed,amount))::numeric, 2)::float8 AS total
         FROM expenses
         WHERE org_id=$1 AND date >= to_char(NOW() - INTERVAL '365 days', 'YYYY-MM-DD')
         GROUP BY date
         ORDER BY date ASC`, [orgId]),
    ]);

    const totalSpent     = totalSpentRow.v;
    const thisMonthTotal = thisMonthRow.v;
    const lastMonthTotal = lastMonthRow.v;
    const savingsGross   = savingsRow.v;
    const monthChange = lastMonthTotal > 0
      ? (((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1)
      : null;

    res.json({
      totalSpent,
      thisMonthTotal,
      lastMonthTotal,
      monthChange,
      avgTransaction: avgRow.v,
      totalCount: countRow.v,
      foreignCurrencyCount: foreignRow.v,
      needsReviewCount: needsReviewRow.v,
      topCategory: topCategory || null,
      categoryBreakdown,
      monthlyTrend,
      recentTransactions: recentRows.map(parseRecord),
      savingsGross,
      savingsNet: savingsGross,
      dailySpend,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single record
router.get('/:id', async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Record not found' });

    const record = (await sql`SELECT * FROM expenses WHERE id = ${id} AND org_id = ${req.user.org_id}`)[0];
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(parseRecord(record));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create record
router.post('/', async (req, res) => {
  try {
    const {
      expense_type = 'general', expense_type_id, invoice_number, vendor_name, amount, currency = 'AED', date,
      category, business_unit, payment_method = 'Cash', purpose, submitted_by,
      line_items = [], notes, image_path, file_hash,
      bl_number, container_number, port, shipment_type,
      container_numbers = [], bl_numbers = [],
      savings_old_fee, savings_previous_agent, savings_record = false,
      needs_review = false, review_notes,
      custom_fields = {},
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

    // ── Duplicate detection — all checks scoped to this org ──────────────────
    if (file_hash) {
      const hashDupe = await one(
        'SELECT id, vendor_name, date FROM expenses WHERE file_hash = $1 AND org_id = $2',
        [file_hash, orgId]
      );
      if (hashDupe) return res.status(409).json({
        error: `Duplicate: this exact receipt was already recorded (Record #${hashDupe.id})`,
        existingId: hashDupe.id, duplicateType: 'file',
      });
    }
    if (invoice_number) {
      const invDupe = await one(
        'SELECT id FROM expenses WHERE invoice_number=$1 AND vendor_name=$2 AND date=$3 AND amount=$4 AND org_id=$5',
        [invoice_number, vendor_name, date, parsedAmount, orgId]
      );
      if (invDupe) return res.status(409).json({
        error: `Duplicate: invoice already recorded (Record #${invDupe.id})`,
        existingId: invDupe.id, duplicateType: 'invoice',
      });
    }
    let softDuplicateWarning = null;
    if (!invoice_number) {
      const softDupe = await one(
        `SELECT id FROM expenses
         WHERE (invoice_number IS NULL OR invoice_number = '')
           AND vendor_name=$1 AND date=$2 AND amount=$3 AND org_id=$4`,
        [vendor_name, date, parsedAmount, orgId]
      );
      if (softDupe) softDuplicateWarning = {
        existingId: softDupe.id,
        message: `Similar expense already exists as Record #${softDupe.id} — saved anyway, please verify.`,
      };
    }

    // ── Currency → AED snapshot (never recomputed later; see CLAUDE.md) ──────
    const cleanCurrency = (clean(currency, 10) || 'AED').toUpperCase();
    let rate, amount_aed;
    if (cleanCurrency === 'AED') {
      rate = 1; amount_aed = parsedAmount;
    } else {
      const rates = await getRates(orgId);
      if (!rates[cleanCurrency]) return res.status(400).json({ error: `Unsupported currency: ${cleanCurrency}` });
      rate = rates[cleanCurrency];
      amount_aed = convertToAed(parsedAmount, rate);
    }

    const expenseId = await withTransaction(async (tx) => {
      const inserted = await tx.one(
        `INSERT INTO expenses (
           org_id, expense_type, expense_type_id, invoice_number, vendor_name, amount, currency, date,
           category, business_unit, payment_method, purpose, submitted_by, line_items, notes,
           image_path, bl_number, container_number, port, shipment_type,
           amount_aed, exchange_rate, container_numbers, bl_numbers, file_hash, needs_review, review_notes, custom_fields)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
         RETURNING id`,
        [
          orgId,
          clean(expense_type, 50) || 'general',
          toId(expense_type_id),
          clean(invoice_number, 100), clean(vendor_name, 255),
          parsedAmount, cleanCurrency, date, clean(category, 100), clean(business_unit, 50),
          clean(payment_method, 50) || 'Cash', clean(purpose), clean(submitted_by, 100),
          JSON.stringify(line_items), clean(notes, 1000), image_path || null,
          bl_number || null, container_number || null, port || null, shipment_type || null,
          amount_aed, rate,
          JSON.stringify(Array.isArray(container_numbers) ? container_numbers : []),
          JSON.stringify(Array.isArray(bl_numbers) ? bl_numbers : []),
          file_hash || null, !!needs_review, review_notes || null,
          JSON.stringify(typeof custom_fields === 'object' && custom_fields ? custom_fields : {}),
        ]
      );

      if (expense_type === 'shipping' && savings_record && savings_old_fee != null) {
        const parsedItems = Array.isArray(line_items) ? line_items : [];
        const new_fee = parsedItems.length ? addMoney(...parsedItems.map(li => li.amount)) : parsedAmount;
        const old_fee = parseFloat(savings_old_fee) || 0;
        const savings = addMoney(old_fee, -new_fee);
        const bls = Array.isArray(bl_numbers) && bl_numbers.length ? bl_numbers : bl_number ? [bl_number] : [];

        await tx.query('DELETE FROM clearance_savings WHERE expense_id = $1', [inserted.id]);
        await tx.query(
          `INSERT INTO clearance_savings
             (org_id, expense_id, date, business_unit, port, import_export, reference_number,
              previous_agent, current_agent, old_fee, new_fee, savings)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [orgId, inserted.id, date, business_unit || null, port || null,
           shipment_type || null, bls.join(', ') || invoice_number || null,
           savings_previous_agent || null, vendor_name, old_fee, new_fee, savings]
        );
      }

      return inserted.id;
    });

    const saved = parseRecord(await one('SELECT * FROM expenses WHERE id = $1', [expenseId]));
    res.status(201).json({ ...saved, warning: softDuplicateWarning || undefined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update record
router.put('/:id', async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Record not found' });

    const ex = await one('SELECT * FROM expenses WHERE id = $1 AND org_id = $2', [id, req.user.org_id]);
    if (!ex) return res.status(404).json({ error: 'Record not found' });
    const b = req.body;

    const newCurrency = (b.currency ?? ex.currency ?? 'AED').toUpperCase();
    const newAmount = b.amount !== undefined ? parseFloat(b.amount) : ex.amount;
    const rate = newCurrency === 'AED' ? 1 : await getRate(newCurrency, req.user.org_id);
    const amount_aed = newCurrency === 'AED' ? newAmount : convertToAed(newAmount, rate);

    await query(
      `UPDATE expenses SET
         expense_type=$1, invoice_number=$2, vendor_name=$3, amount=$4, currency=$5, date=$6,
         category=$7, business_unit=$8, payment_method=$9, purpose=$10, submitted_by=$11,
         line_items=$12, notes=$13, image_path=$14,
         bl_number=$15, container_number=$16, port=$17, shipment_type=$18,
         amount_aed=$19, exchange_rate=$20, container_numbers=$21, bl_numbers=$22, custom_fields=$23
       WHERE id=$24 AND org_id=$25`,
      [
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
        b.custom_fields !== undefined ? JSON.stringify(b.custom_fields || {}) : (ex.custom_fields || '{}'),
        id, req.user.org_id,
      ]
    );

    res.json(parseRecord(await one('SELECT * FROM expenses WHERE id = $1', [id])));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE record — clearance_savings rows go with it via ON DELETE CASCADE
router.delete('/:id', requireMinRole('finance'), async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Record not found' });

    const deleted = await query(
      'DELETE FROM expenses WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.org_id]
    );
    if (deleted.length === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
