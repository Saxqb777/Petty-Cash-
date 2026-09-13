const express = require('express');
const { sql, toId } = require('../db');
const { requireAuth, requireMinRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/members — list all members + pending requests for this org
router.get('/', requireMinRole('admin'), async (req, res) => {
  try {
    const members = await sql`
      SELECT m.id, m.role, m.status, m.created_at,
             u.id AS user_id, u.email, u.full_name
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.org_id = ${req.user.org_id}
      ORDER BY (m.status = 'active') DESC, m.created_at ASC`;
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/members/:id/approve — approve a pending request with a role
router.put('/:id/approve', requireMinRole('admin'), async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Membership not found' });

    const { role = 'member' } = req.body;
    const valid = ['member', 'finance', 'admin'];
    if (!valid.includes(role)) return res.status(400).json({ error: `role must be one of: ${valid.join(', ')}` });

    const membership = (await sql`SELECT * FROM memberships WHERE id = ${id} AND org_id = ${req.user.org_id}`)[0];
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.status === 'active') return res.status(400).json({ error: 'Already active' });

    const updated = await sql`
      UPDATE memberships SET status = 'active', role = ${role} WHERE id = ${id} RETURNING *`;
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/members/:id/reject — reject a pending request
router.put('/:id/reject', requireMinRole('admin'), async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Membership not found' });

    const membership = (await sql`SELECT * FROM memberships WHERE id = ${id} AND org_id = ${req.user.org_id}`)[0];
    if (!membership) return res.status(404).json({ error: 'Membership not found' });

    await sql`UPDATE memberships SET status = 'rejected' WHERE id = ${id}`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/members/:id/role — change an active member's role
router.put('/:id/role', requireMinRole('admin'), async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Membership not found' });

    const { role } = req.body;
    const valid = ['member', 'finance', 'admin'];
    if (!valid.includes(role)) return res.status(400).json({ error: `role must be one of: ${valid.join(', ')}` });

    const membership = (await sql`SELECT * FROM memberships WHERE id = ${id} AND org_id = ${req.user.org_id}`)[0];
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.role === 'owner') return res.status(403).json({ error: 'Cannot change owner role' });

    const updated = await sql`UPDATE memberships SET role = ${role} WHERE id = ${id} RETURNING *`;
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/members/:id — remove a member from the org
router.delete('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Membership not found' });

    const membership = (await sql`SELECT * FROM memberships WHERE id = ${id} AND org_id = ${req.user.org_id}`)[0];
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.role === 'owner') return res.status(403).json({ error: 'Cannot remove the owner' });
    // Prevent self-removal
    if (membership.user_id === req.user.id) return res.status(403).json({ error: 'Cannot remove yourself' });

    await sql`DELETE FROM memberships WHERE id = ${id}`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
