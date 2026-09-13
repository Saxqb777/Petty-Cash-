const express = require('express');
const { sql, query, one, withTransaction, toId } = require('../db');
const { requireAuth, requireMinRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/by-expense/:expenseId', async (req, res) => {
  try {
    const expenseId = toId(req.params.expenseId);
    if (!expenseId) return res.json(null);
    const row = (await sql`
      SELECT * FROM clearance_savings
      WHERE expense_id = ${expenseId} AND org_id = ${req.user.org_id}`)[0];
    res.json(row || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireMinRole('finance'), async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Not found' });

    const existing = await one('SELECT * FROM clearance_savings WHERE id = $1 AND org_id = $2', [id, req.user.org_id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const b = req.body;
    const old_fee = b.old_fee !== undefined ? parseFloat(b.old_fee) : existing.old_fee;
    const new_fee = b.new_fee !== undefined ? parseFloat(b.new_fee) : existing.new_fee;

    const updated = await one(
      `UPDATE clearance_savings SET
         old_fee=$1, new_fee=$2, savings=$3,
         previous_agent=$4, current_agent=$5, port=$6, import_export=$7,
         business_unit=$8, description=$9
       WHERE id=$10 AND org_id=$11
       RETURNING *`,
      [old_fee, new_fee, old_fee - new_fee,
       b.previous_agent ?? existing.previous_agent, b.current_agent ?? existing.current_agent,
       b.port ?? existing.port, b.import_export ?? existing.import_export,
       b.business_unit ?? existing.business_unit, b.description ?? existing.description,
       id, req.user.org_id]
    );
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Suggest the historical fee this agent used to charge, most specific first.
router.get('/agent-rates', async (req, res) => {
  try {
    const { previous_agent, port, import_export } = req.query;
    if (!previous_agent) return res.json({ suggested_fee: null });
    const orgId = req.user.org_id;

    const hasPort = port !== undefined && port !== '';
    const hasIE   = import_export !== undefined && import_export !== '';

    // NOTE: the SQLite version built three fixed-placeholder queries and then
    // filtered empty params out of the argument list, so the arity stopped
    // matching whenever `port` or `import_export` was absent and the endpoint
    // threw. Each candidate is now only attempted when all of its parameters
    // are actually present.
    const candidates = [];
    if (hasPort && hasIE) {
      candidates.push({
        sql: `SELECT old_fee, COUNT(*)::int AS freq FROM clearance_savings
              WHERE org_id=$1 AND LOWER(previous_agent)=LOWER($2) AND port=$3 AND import_export=$4
              GROUP BY old_fee ORDER BY freq DESC LIMIT 1`,
        params: [orgId, previous_agent, port, import_export],
      });
    }
    if (hasPort) {
      candidates.push({
        sql: `SELECT old_fee, COUNT(*)::int AS freq FROM clearance_savings
              WHERE org_id=$1 AND LOWER(previous_agent)=LOWER($2) AND port=$3
              GROUP BY old_fee ORDER BY freq DESC LIMIT 1`,
        params: [orgId, previous_agent, port],
      });
    }
    candidates.push({
      sql: `SELECT old_fee, COUNT(*)::int AS freq FROM clearance_savings
            WHERE org_id=$1 AND LOWER(previous_agent)=LOWER($2)
            GROUP BY old_fee ORDER BY freq DESC LIMIT 1`,
      params: [orgId, previous_agent],
    });

    for (const c of candidates) {
      const row = await one(c.sql, c.params);
      if (row) return res.json({ suggested_fee: row.old_fee, match: 'historical' });
    }
    res.json({ suggested_fee: null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { business_unit, from, to, import_export, page = 1, limit = 50 } = req.query;

    const where = ['org_id = $1'];
    const params = [req.user.org_id];
    const bind = (v) => { params.push(v); return `$${params.length}`; };

    if (business_unit) where.push(`business_unit = ${bind(business_unit)}`);
    if (from)          where.push(`date >= ${bind(from)}`);
    if (to)            where.push(`date <= ${bind(to)}`);
    if (import_export) where.push(`import_export = ${bind(import_export)}`);
    const whereSql = where.join(' AND ');

    const totalRow = await one(`SELECT COUNT(*)::int AS total FROM clearance_savings WHERE ${whereSql}`, params);
    const total = totalRow?.total || 0;

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, parseInt(limit, 10) || 50);
    const limitP  = bind(pageSize);
    const offsetP = bind((pageNum - 1) * pageSize);

    const records = await query(
      `SELECT * FROM clearance_savings WHERE ${whereSql}
       ORDER BY date DESC, created_at DESC
       LIMIT ${limitP} OFFSET ${offsetP}`,
      params
    );

    res.json({ records, total, page: pageNum, pages: Math.ceil(total / pageSize) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/summary', async (req, res) => {
  try {
    const { from, to } = req.query;

    const where = ['org_id = $1'];
    const params = [req.user.org_id];
    const bind = (v) => { params.push(v); return `$${params.length}`; };
    if (from) where.push(`date >= ${bind(from)}`);
    if (to)   where.push(`date <= ${bind(to)}`);
    const whereSql = where.join(' AND ');

    const grossRow = await one(`SELECT COALESCE(SUM(savings),0) AS v FROM clearance_savings WHERE ${whereSql}`, params);
    const byBU = await query(
      `SELECT business_unit, SUM(savings) AS total, COUNT(*)::int AS count
       FROM clearance_savings WHERE ${whereSql}
       GROUP BY business_unit ORDER BY total DESC`, params);
    // strftime('%Y-%m', date) → substr(date,1,7); `date` is TEXT 'YYYY-MM-DD'.
    const monthlyTrend = await query(
      `SELECT substr(date,1,7) AS month, SUM(savings) AS total, COUNT(*)::int AS count
       FROM clearance_savings WHERE ${whereSql}
       GROUP BY substr(date,1,7) ORDER BY month ASC`, params);

    const gross = grossRow.v;
    res.json({ gross, fuelCost: 0, net: gross, byBU, monthlyTrend });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireMinRole('finance'), async (req, res) => {
  try {
    const {
      date, month, business_unit, port, reference_number, import_export,
      previous_agent, current_agent, old_fee = 0, new_fee = 0, savings,
      project_name, description,
    } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });

    const computedSavings = savings !== undefined
      ? parseFloat(savings)
      : parseFloat(old_fee) - parseFloat(new_fee);

    const inserted = await one(
      `INSERT INTO clearance_savings
         (org_id, date, month, business_unit, port, reference_number, import_export,
          previous_agent, current_agent, old_fee, new_fee, savings, project_name, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [req.user.org_id, date, month || null, business_unit || null, port || null,
       reference_number || null, import_export || null, previous_agent || null,
       current_agent || null, parseFloat(old_fee), parseFloat(new_fee), computedSavings,
       project_name || null, description || null]
    );
    res.status(201).json(inserted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk', requireMinRole('finance'), async (req, res) => {
  try {
    const records = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'Expected an array' });
    if (records.length === 0) return res.status(201).json({ inserted: 0 });

    await withTransaction(async (tx) => {
      for (const r of records) {
        const s = r.savings !== undefined
          ? parseFloat(r.savings)
          : parseFloat(r.old_fee || 0) - parseFloat(r.new_fee || 0);
        await tx.query(
          `INSERT INTO clearance_savings
             (org_id, date, month, business_unit, port, reference_number, import_export,
              previous_agent, current_agent, old_fee, new_fee, savings, project_name, description)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [req.user.org_id, r.date, r.month || null, r.business_unit || null, r.port || null,
           r.reference_number || null, r.import_export || null, r.previous_agent || null,
           r.current_agent || null, parseFloat(r.old_fee || 0), parseFloat(r.new_fee || 0), s,
           r.project_name || null, r.description || null]
        );
      }
    });

    res.status(201).json({ inserted: records.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireMinRole('finance'), async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Record not found' });

    const deleted = await query(
      'DELETE FROM clearance_savings WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.org_id]
    );
    if (deleted.length === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
