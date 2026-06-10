const express = require('express');
const db = require('../db/database');
const { requireAuth, requireMinRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/members — list all members + pending requests for this org
router.get('/', requireMinRole('admin'), (req, res) => {
  try {
    const members = db.prepare(
      `SELECT m.id, m.role, m.status, m.created_at,
              u.id as user_id, u.email, u.full_name
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.org_id = ?
       ORDER BY m.status = 'active' DESC, m.created_at ASC`
    ).all(req.user.org_id);
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/members/:id/approve — approve a pending request with a role
router.put('/:id/approve', requireMinRole('admin'), (req, res) => {
  try {
    const { role = 'member' } = req.body;
    const valid = ['member', 'finance', 'admin'];
    if (!valid.includes(role)) return res.status(400).json({ error: `role must be one of: ${valid.join(', ')}` });

    const membership = db.prepare(
      'SELECT * FROM memberships WHERE id = ? AND org_id = ?'
    ).get(req.params.id, req.user.org_id);

    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.status === 'active') return res.status(400).json({ error: 'Already active' });

    db.prepare(`UPDATE memberships SET status = 'active', role = ? WHERE id = ?`).run(role, req.params.id);
    res.json(db.prepare('SELECT * FROM memberships WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/members/:id/reject — reject a pending request
router.put('/:id/reject', requireMinRole('admin'), (req, res) => {
  try {
    const membership = db.prepare(
      'SELECT * FROM memberships WHERE id = ? AND org_id = ?'
    ).get(req.params.id, req.user.org_id);
    if (!membership) return res.status(404).json({ error: 'Membership not found' });

    db.prepare(`UPDATE memberships SET status = 'rejected' WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/members/:id/role — change an active member's role
router.put('/:id/role', requireMinRole('admin'), (req, res) => {
  try {
    const { role } = req.body;
    const valid = ['member', 'finance', 'admin'];
    if (!valid.includes(role)) return res.status(400).json({ error: `role must be one of: ${valid.join(', ')}` });

    const membership = db.prepare(
      'SELECT * FROM memberships WHERE id = ? AND org_id = ?'
    ).get(req.params.id, req.user.org_id);
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.role === 'owner') return res.status(403).json({ error: 'Cannot change owner role' });

    db.prepare('UPDATE memberships SET role = ? WHERE id = ?').run(role, req.params.id);
    res.json(db.prepare('SELECT * FROM memberships WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/members/:id — remove a member from the org
router.delete('/:id', requireMinRole('admin'), (req, res) => {
  try {
    const membership = db.prepare(
      'SELECT * FROM memberships WHERE id = ? AND org_id = ?'
    ).get(req.params.id, req.user.org_id);
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.role === 'owner') return res.status(403).json({ error: 'Cannot remove the owner' });
    // Prevent self-removal
    if (membership.user_id === req.user.id) return res.status(403).json({ error: 'Cannot remove yourself' });

    db.prepare('DELETE FROM memberships WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
