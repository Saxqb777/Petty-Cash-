// ═══════════════════════════════════════════════════════════════════════════
//  /api/demo — the public demo at demo.docledger.site
//
//  Every visitor gets a sample company of their own in the demo database,
//  already filled with three months of paperwork, and is signed straight in.
//  A link from a Doc Ledger email carries ?for=<code>; the company is then
//  named after the reader and gets one of their own documents as a type.
//
//  These routes answer only on a demo host (see server/demo/context.js), so
//  nothing here can create rows in the real database.
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, one, withTransaction } = require('../db');
const { seedOrgDefaults } = require('../db/seed');
const { isDemo } = require('../demo/context');
const { takeDemoCompany, readsLeft, READS_PER_COMPANY } = require('../demo/limits');
const { seedSampleCompany, seedTailored } = require('../demo/sample');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Same cookie as a normal sign in (server/routes/auth.js), host only, so a
// demo session never travels to docledger.site.
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 3 * 24 * 60 * 60 * 1000,
  path: '/',
};

const TOWER_URL = (process.env.TOWER_URL || 'https://the-tower-saxqb777s-projects.vercel.app').replace(/\/$/, '');
const DEFAULT_COMPANY = 'Harbour Line Trading LLC';

router.use((req, res, next) => (isDemo() ? next() : res.status(404).json({ error: 'Not found' })));

// The preview the sales team made for this company, or null. Never blocks the
// demo for long: a slow or missing answer just means the standard sample company.
// The Tower may be cold (a few seconds to wake), so one retry with a longer wait.
// The visitor's browser goes along in x-visitor-agent: the Tower counts the call as
// that company opening its demo, and tells link checkers from people by it.
async function previewFor(code, agent) {
  if (!/^[a-z0-9]{4,12}$/.test(String(code || ''))) return null;
  const headers = agent ? { 'x-visitor-agent': String(agent).slice(0, 300) } : {};
  for (const wait of [5000, 8000]) {
    try {
      const r = await fetch(`${TOWER_URL}/api/public/preview/${code}`, { headers, signal: AbortSignal.timeout(wait) });
      if (r.status === 404) return null;
      if (!r.ok) continue;
      const p = await r.json();
      const company = String(p.company || '').trim().slice(0, 80);
      return company ? { ...p, company } : null;
    } catch (_) {
      // timed out or unreachable: try once more, then give up
    }
  }
  return null;
}

// A document read inside a company's demo is the warmest signal the sales floor
// gets before a reply: the Tower hears about it, signed with DEMO_EVENT_KEY.
// Never blocks the upload and never throws.
async function reportDemoRead(orgId) {
  if (!process.env.DEMO_EVENT_KEY) return;
  try {
    const row = await one("SELECT value FROM settings WHERE key = 'demo_for' AND org_id = $1", [orgId]);
    const code = row && row.value;
    if (!code || !/^[a-z0-9]{4,12}$/.test(code)) return;
    await fetch(`${TOWER_URL}/api/public/preview/${code}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tower-key': process.env.DEMO_EVENT_KEY },
      body: JSON.stringify({ kind: 'read' }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn('[demo read report]', err.message);
  }
}

// ── POST /api/demo/start ──────────────────────────────────────────────────────
router.post('/start', async (req, res) => {
  try {
    // Sample companies live three days, then go.
    await query("DELETE FROM organizations WHERE slug LIKE 'demo-%' AND created_at < NOW() - INTERVAL '3 days'");
    await query("DELETE FROM users WHERE email LIKE '%@visitors.docledger.site' AND created_at < NOW() - INTERVAL '3 days'");

    if (!(await takeDemoCompany())) {
      return res.status(429).json({ error: 'The demo is full for today. Try again tomorrow, or start your free month.' });
    }

    const code = String(req.body?.for || '');
    const preview = await previewFor(code, req.get('user-agent'));
    const company = preview?.company || DEFAULT_COMPANY;
    const tag = crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 4);

    const { userId, tailoredType } = await withTransaction(async (tx) => {
      const org = await tx.one('INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id', [company, `demo-${tag}`]);
      await seedOrgDefaults(org.id, tx);
      const user = await tx.one(
        'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id',
        [`visitor-${tag}@visitors.docledger.site`, passwordHash, 'Finance team']
      );
      await tx.query(`INSERT INTO memberships (user_id, org_id, role, status) VALUES ($1, $2, 'owner', 'active')`, [user.id, org.id]);
      await seedSampleCompany(tx, org.id);
      const typeName = preview ? await seedTailored(tx, org.id, preview) : null;
      // Remembered so a document read in this company can be reported to the Tower by code.
      if (preview) await tx.query("INSERT INTO settings (key, value, org_id) VALUES ('demo_for', $1, $2) ON CONFLICT (key, org_id) DO UPDATE SET value = EXCLUDED.value", [code, org.id]);
      return { userId: user.id, tailoredType: typeName };
    });

    const token = crypto.randomBytes(32).toString('hex');
    await query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '3 days')", [token, userId]);
    res.cookie('session', token, COOKIE_OPTS);
    res.status(201).json({ company, tailoredType, reads: READS_PER_COMPANY() });
  } catch (err) {
    console.error('[demo start]', err.message);
    res.status(500).json({ error: 'The demo could not open. Please try again.' });
  }
});

// ── GET /api/demo/status ── for the banner ─────────────────────────────────────
router.get('/status', requireAuth, async (req, res) => {
  try {
    res.json({ demo: true, company: req.user.org_name, readsLeft: await readsLeft(req.user.org_id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.reportDemoRead = reportDemoRead;
