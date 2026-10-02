// ═══════════════════════════════════════════════════════════════════════════
//  /api/tower — what the sales floor may read about the companies it brought (D080)
//  Signed with x-tower-key (DEMO_EVENT_KEY). Usage only: never a document, never a person's data.
// ═══════════════════════════════════════════════════════════════════════════
const express = require('express');
const { sql } = require('../db');
const { towerKeyOk } = require('../tower');

const router = express.Router();

router.use((req, res, next) => (towerKeyOk(req) ? next() : res.status(401).json({ error: 'x-tower-key missing or wrong' })));

// GET /api/tower/usage?orgs=1,2 or ?codes=abc123,def456 — one row per organisation
router.get('/usage', async (req, res) => {
  try {
    const ids = String(req.query.orgs || '').split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0).slice(0, 50);
    const codes = String(req.query.codes || '').split(',').map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z0-9]{4,12}$/.test(s)).slice(0, 50);
    if (!ids.length && !codes.length) return res.json({ orgs: [] });
    const rows = await sql`
      SELECT o.id, o.name, o.plan, o.trial_ends_at, o.tower_code, o.created_at,
             (SELECT COUNT(*)::int FROM expenses e WHERE e.org_id = o.id) AS reads_total,
             (SELECT COUNT(*)::int FROM expenses e WHERE e.org_id = o.id AND e.created_at > NOW() - INTERVAL '7 days') AS reads_7d,
             (SELECT MAX(e.created_at) FROM expenses e WHERE e.org_id = o.id) AS last_read_at,
             (SELECT COUNT(*)::int FROM memberships m WHERE m.org_id = o.id AND m.status = 'active') AS members,
             (SELECT COUNT(*)::int FROM expense_types t WHERE t.org_id = o.id AND t.is_builtin = FALSE AND t.is_archived = FALSE) AS own_types
      FROM organizations o
      WHERE o.id = ANY(${ids}::bigint[]) OR o.tower_code = ANY(${codes}::text[])`;
    res.json({
      orgs: rows.map((r) => ({
        orgId: String(r.id),
        company: r.name,
        plan: r.plan,
        trialEndsAt: r.trial_ends_at,
        code: r.tower_code,
        since: r.created_at,
        readsTotal: r.reads_total,
        reads7d: r.reads_7d,
        lastReadAt: r.last_read_at,
        members: r.members,
        ownTypes: r.own_types,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
