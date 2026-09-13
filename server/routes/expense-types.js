const express = require('express');
const { sql, one, query, isUniqueViolation, toId } = require('../db');
const { requireAuth, requireMinRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// fields_schema is stored as TEXT (see schema.sql) and parsed on the way out.
const parseType = (t) => (t ? { ...t, fields_schema: JSON.parse(t.fields_schema || '[]') } : null);

// GET all active types for org
router.get('/', async (req, res) => {
  try {
    const types = await sql`
      SELECT * FROM expense_types
      WHERE org_id = ${req.user.org_id} AND is_archived = FALSE
      ORDER BY sort_order ASC, id ASC`;
    res.json(types.map(parseType));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single type
router.get('/:id', async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Type not found' });

    const t = (await sql`SELECT * FROM expense_types WHERE id = ${id} AND org_id = ${req.user.org_id}`)[0];
    if (!t) return res.status(404).json({ error: 'Type not found' });
    res.json(parseType(t));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create custom type (admin+)
router.post('/', requireMinRole('admin'), async (req, res) => {
  try {
    const { name, slug, icon = 'receipt', color = '#62833A', description, fields_schema = [], ai_hints, sort_order = 99 } = req.body;
    if (!name?.trim() || !slug?.trim()) return res.status(400).json({ error: 'name and slug are required' });
    if (!/^[a-z0-9_-]+$/.test(slug)) return res.status(400).json({ error: 'slug must be lowercase alphanumeric with - or _' });

    const inserted = await one(
      `INSERT INTO expense_types
         (org_id, name, slug, icon, color, description, fields_schema, ai_hints, is_builtin, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9)
       RETURNING *`,
      [req.user.org_id, name.trim(), slug.trim(), icon, color, description || null,
       JSON.stringify(fields_schema), ai_hints || null, parseInt(sort_order, 10) || 0]
    );

    res.status(201).json(parseType(inserted));
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: 'A type with this slug already exists for your org' });
    res.status(500).json({ error: err.message });
  }
});

// PUT update type (admin+) — cannot change slug or is_builtin
router.put('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Type not found' });

    const t = await one('SELECT * FROM expense_types WHERE id = $1 AND org_id = $2', [id, req.user.org_id]);
    if (!t) return res.status(404).json({ error: 'Type not found' });

    const { name, description, icon, color, fields_schema, ai_hints, sort_order, is_archived } = req.body;

    const updated = await one(
      `UPDATE expense_types SET
         name          = COALESCE($1, name),
         description   = COALESCE($2, description),
         icon          = COALESCE($3, icon),
         color         = COALESCE($4, color),
         fields_schema = COALESCE($5, fields_schema),
         ai_hints      = COALESCE($6, ai_hints),
         sort_order    = COALESCE($7, sort_order),
         is_archived   = COALESCE($8, is_archived)
       WHERE id = $9 AND org_id = $10
       RETURNING *`,
      [
        name || null,
        description !== undefined ? description : null,
        icon || null,
        color || null,
        fields_schema !== undefined ? JSON.stringify(fields_schema) : null,
        ai_hints !== undefined ? ai_hints : null,
        sort_order === undefined || sort_order === null ? null : parseInt(sort_order, 10),
        // BOOLEAN column now — coerce 0/1/'true' from older clients.
        is_archived === undefined || is_archived === null ? null : !!is_archived,
        id, req.user.org_id,
      ]
    );

    res.json(parseType(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE (archive) custom type only
router.delete('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Type not found' });

    const t = await one('SELECT * FROM expense_types WHERE id = $1 AND org_id = $2', [id, req.user.org_id]);
    if (!t) return res.status(404).json({ error: 'Type not found' });
    if (t.is_builtin) return res.status(403).json({ error: 'Built-in expense types cannot be removed' });

    await query('UPDATE expense_types SET is_archived = TRUE WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
