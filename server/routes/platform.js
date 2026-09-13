const express = require('express');
const { sql, one, withTransaction, toId } = require('../db');
const { dropReceipts } = require('../utils/blob');
const { requireSuperadmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireSuperadmin);

// GET /api/platform/overview — global stats
router.get('/overview', async (req, res) => {
  try {
    const [orgs, users, expenses, spend, pending, sessions] = await Promise.all([
      one('SELECT COUNT(*)::int AS n FROM organizations'),
      one('SELECT COUNT(*)::int AS n FROM users'),
      one('SELECT COUNT(*)::int AS n FROM expenses'),
      one('SELECT COALESCE(SUM(amount_aed), 0) AS total FROM expenses'),
      one("SELECT COUNT(*)::int AS n FROM memberships WHERE status = 'pending'"),
      one('SELECT COUNT(*)::int AS n FROM sessions WHERE expires_at > NOW()'),
    ]);

    res.json({
      orgCount: orgs.n,
      userCount: users.n,
      expenseCount: expenses.n,
      totalSpend: spend.total,
      pendingJoins: pending.n,
      activeSessions: sessions.n,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/platform/orgs — list every org with per-org stats
router.get('/orgs', async (req, res) => {
  try {
    const orgs = await sql`
      SELECT
        o.id, o.name, o.slug, o.accent_color, o.created_at,
        (SELECT COUNT(*)::int FROM memberships m WHERE m.org_id = o.id AND m.status = 'active')  AS member_count,
        (SELECT COUNT(*)::int FROM memberships m WHERE m.org_id = o.id AND m.status = 'pending') AS pending_count,
        (SELECT COUNT(*)::int FROM expenses e WHERE e.org_id = o.id)                             AS expense_count,
        (SELECT COALESCE(SUM(amount_aed), 0) FROM expenses e WHERE e.org_id = o.id)              AS total_spend,
        (SELECT MAX(created_at) FROM expenses e WHERE e.org_id = o.id)                           AS last_activity
      FROM organizations o
      ORDER BY o.created_at DESC`;
    res.json(orgs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/platform/orgs/:id — single org with members
router.get('/orgs/:id', async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Org not found' });

    const org = (await sql`SELECT * FROM organizations WHERE id = ${id}`)[0];
    if (!org) return res.status(404).json({ error: 'Org not found' });

    const members = await sql`
      SELECT m.id, m.role, m.status, m.created_at, u.id AS user_id, u.email, u.full_name
      FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.org_id = ${id}
      ORDER BY m.status DESC, m.created_at ASC`;

    res.json({ ...org, members });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/platform/orgs/:id — rename / recolor an org
router.put('/orgs/:id', async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Org not found' });

    const { name, accent_color } = req.body;
    const org = await one('SELECT * FROM organizations WHERE id = $1', [id]);
    if (!org) return res.status(404).json({ error: 'Org not found' });

    const updated = await one(
      `UPDATE organizations
       SET name = COALESCE($1, name), accent_color = COALESCE($2, accent_color)
       WHERE id = $3
       RETURNING *`,
      [name?.trim().slice(0, 100) || null, accent_color || null, id]
    );
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/platform/orgs/:id — wipe an org and all its data
router.delete('/orgs/:id', async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Org not found' });

    const org = await one('SELECT * FROM organizations WHERE id = $1', [id]);
    if (!org) return res.status(404).json({ error: 'Org not found' });

    // Collect the receipts BEFORE the rows go, since afterwards there is no
    // record of what this tenant ever uploaded. Wiping an org otherwise leaves
    // every one of its receipts readable at its public Blob URL indefinitely.
    const receipts = await sql`
      SELECT image_path FROM expenses
      WHERE org_id = ${id} AND image_path IS NOT NULL`;

    // The FKs are ON DELETE CASCADE, but the deletes stay explicit and ordered
    // so the intent is readable and the operation is one atomic transaction.
    await withTransaction(async (tx) => {
      await tx.query('DELETE FROM clearance_savings WHERE org_id = $1', [id]);
      await tx.query('DELETE FROM expenses         WHERE org_id = $1', [id]);
      await tx.query('DELETE FROM settings         WHERE org_id = $1', [id]);
      await tx.query('DELETE FROM expense_types    WHERE org_id = $1', [id]);
      await tx.query('DELETE FROM memberships      WHERE org_id = $1', [id]);
      await tx.query('DELETE FROM organizations    WHERE id     = $1', [id]);
    });

    // Only once the transaction has committed. Deleting the files first would
    // destroy the receipts even if the wipe then rolled back.
    const { deleted } = await dropReceipts(receipts.map((r) => r.image_path));

    res.json({ success: true, name: org.name, receiptsDeleted: deleted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
