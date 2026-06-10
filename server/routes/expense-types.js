const express = require('express');
const db = require('../db/database');
const { requireAuth, requireMinRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const parseType = (t) => ({ ...t, fields_schema: JSON.parse(t.fields_schema || '[]') });

// GET all active types for org
router.get('/', (req, res) => {
  try {
    const types = db.prepare(
      'SELECT * FROM expense_types WHERE org_id = ? AND is_archived = 0 ORDER BY sort_order ASC, id ASC'
    ).all(req.user.org_id);
    res.json(types.map(parseType));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single type
router.get('/:id', (req, res) => {
  try {
    const t = db.prepare('SELECT * FROM expense_types WHERE id = ? AND org_id = ?').get(req.params.id, req.user.org_id);
    if (!t) return res.status(404).json({ error: 'Type not found' });
    res.json(parseType(t));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create custom type (admin+)
router.post('/', requireMinRole('admin'), (req, res) => {
  try {
    const { name, slug, icon = 'receipt', color = '#62833A', description, fields_schema = [], ai_hints, sort_order = 99 } = req.body;
    if (!name?.trim() || !slug?.trim()) return res.status(400).json({ error: 'name and slug are required' });
    if (!/^[a-z0-9_-]+$/.test(slug)) return res.status(400).json({ error: 'slug must be lowercase alphanumeric with - or _' });

    const result = db.prepare(`
      INSERT INTO expense_types (org_id, name, slug, icon, color, description, fields_schema, ai_hints, is_builtin, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(req.user.org_id, name.trim(), slug.trim(), icon, color, description || null, JSON.stringify(fields_schema), ai_hints || null, sort_order);

    res.status(201).json(parseType(db.prepare('SELECT * FROM expense_types WHERE id = ?').get(result.lastInsertRowid)));
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) return res.status(409).json({ error: 'A type with this slug already exists for your org' });
    res.status(500).json({ error: err.message });
  }
});

// PUT update type (admin+) — cannot change slug or is_builtin
router.put('/:id', requireMinRole('admin'), (req, res) => {
  try {
    const t = db.prepare('SELECT * FROM expense_types WHERE id = ? AND org_id = ?').get(req.params.id, req.user.org_id);
    if (!t) return res.status(404).json({ error: 'Type not found' });

    const { name, description, icon, color, fields_schema, ai_hints, sort_order, is_archived } = req.body;

    db.prepare(`
      UPDATE expense_types SET
        name        = COALESCE(?, name),
        description = COALESCE(?, description),
        icon        = COALESCE(?, icon),
        color       = COALESCE(?, color),
        fields_schema = COALESCE(?, fields_schema),
        ai_hints    = COALESCE(?, ai_hints),
        sort_order  = COALESCE(?, sort_order),
        is_archived = COALESCE(?, is_archived)
      WHERE id = ? AND org_id = ?
    `).run(
      name || null, description !== undefined ? description : null,
      icon || null, color || null,
      fields_schema !== undefined ? JSON.stringify(fields_schema) : null,
      ai_hints !== undefined ? ai_hints : null,
      sort_order ?? null, is_archived ?? null,
      req.params.id, req.user.org_id
    );

    res.json(parseType(db.prepare('SELECT * FROM expense_types WHERE id = ?').get(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE (archive) custom type only
router.delete('/:id', requireMinRole('admin'), (req, res) => {
  try {
    const t = db.prepare('SELECT * FROM expense_types WHERE id = ? AND org_id = ?').get(req.params.id, req.user.org_id);
    if (!t) return res.status(404).json({ error: 'Type not found' });
    if (t.is_builtin) return res.status(403).json({ error: 'Built-in expense types cannot be removed' });

    db.prepare('UPDATE expense_types SET is_archived = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
