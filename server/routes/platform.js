const express = require('express');
const db = require('../db/database');
const { requireSuperadmin } = require('../middleware/auth');
const router = express.Router();

router.use(requireSuperadmin);

// GET /api/platform/overview — global stats
router.get('/overview', (req, res) => {
  try {
    const orgCount       = db.prepare('SELECT COUNT(*) AS n FROM organizations').get().n;
    const userCount      = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    const expenseCount   = db.prepare('SELECT COUNT(*) AS n FROM expenses').get().n;
    const totalSpend     = db.prepare('SELECT COALESCE(SUM(amount_aed), 0) AS total FROM expenses').get().total;
    const pendingJoins   = db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE status = 'pending'").get().n;
    const activeSessions = db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > datetime('now')").get().n;

    res.json({ orgCount, userCount, expenseCount, totalSpend, pendingJoins, activeSessions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/platform/orgs — list every org with per-org stats
router.get('/orgs', (req, res) => {
  try {
    const orgs = db.prepare(`
      SELECT
        o.id, o.name, o.slug, o.accent_color, o.created_at,
        (SELECT COUNT(*) FROM memberships m WHERE m.org_id = o.id AND m.status = 'active')  AS member_count,
        (SELECT COUNT(*) FROM memberships m WHERE m.org_id = o.id AND m.status = 'pending') AS pending_count,
        (SELECT COUNT(*) FROM expenses e WHERE e.org_id = o.id) AS expense_count,
        (SELECT COALESCE(SUM(amount_aed), 0) FROM expenses e WHERE e.org_id = o.id) AS total_spend,
        (SELECT MAX(created_at) FROM expenses e WHERE e.org_id = o.id) AS last_activity
      FROM organizations o
      ORDER BY o.created_at DESC
    `).all();
    res.json(orgs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/platform/orgs/:id — single org with members
router.get('/orgs/:id', (req, res) => {
  try {
    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.params.id);
    if (!org) return res.status(404).json({ error: 'Org not found' });

    const members = db.prepare(`
      SELECT m.id, m.role, m.status, m.created_at, u.id AS user_id, u.email, u.full_name
      FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.org_id = ?
      ORDER BY m.status DESC, m.created_at ASC
    `).all(req.params.id);

    res.json({ ...org, members });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/platform/orgs/:id — rename / recolor an org
router.put('/orgs/:id', (req, res) => {
  try {
    const { name, accent_color } = req.body;
    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.params.id);
    if (!org) return res.status(404).json({ error: 'Org not found' });

    db.prepare('UPDATE organizations SET name = COALESCE(?, name), accent_color = COALESCE(?, accent_color) WHERE id = ?')
      .run(name?.trim().slice(0, 100) || null, accent_color || null, req.params.id);

    res.json(db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/platform/orgs/:id — wipe an org and all its data
router.delete('/orgs/:id', (req, res) => {
  try {
    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.params.id);
    if (!org) return res.status(404).json({ error: 'Org not found' });

    db.transaction(() => {
      db.prepare('DELETE FROM clearance_savings WHERE org_id = ?').run(req.params.id);
      db.prepare('DELETE FROM expenses WHERE org_id = ?').run(req.params.id);
      db.prepare('DELETE FROM settings WHERE org_id = ?').run(req.params.id);
      db.prepare('DELETE FROM expense_types WHERE org_id = ?').run(req.params.id);
      db.prepare('DELETE FROM memberships WHERE org_id = ?').run(req.params.id);
      db.prepare('DELETE FROM organizations WHERE id = ?').run(req.params.id);
    })();

    res.json({ success: true, name: org.name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
