// ═══════════════════════════════════════════════════════════════════════════
//  /api/billing — the company's plan and the Paddle checkout (D080)
// ═══════════════════════════════════════════════════════════════════════════
const express = require('express');
const { one } = require('../db');
const { isDemo } = require('../demo/context');
const { requireAuth, requireMinRole } = require('../middleware/auth');
const { billingState, checkoutConfig, applyPaddleEvent, verifyPaddleSignature } = require('../billing/paddle');
const { towerNotify } = require('../tower');

const router = express.Router();

// GET /api/billing — plan, days left, and what the checkout needs. Everyone signed in may read it (the banner).
router.get('/', requireAuth, async (req, res) => {
  try {
    if (isDemo()) return res.json({ demo: true, plan: 'demo', blocked: false, reason: null, checkout: { enabled: false } });
    const org = await one('SELECT id, name, plan, trial_ends_at, billing_email, paddle_subscription_id FROM organizations WHERE id = $1', [req.user.org_id]);
    if (!org) return res.status(404).json({ error: 'Organisation not found' });
    const state = billingState(org);
    const cfg = checkoutConfig();
    res.json({
      ...state,
      company: org.name,
      hasSubscription: !!org.paddle_subscription_id,
      checkout: { enabled: cfg.enabled && state.plan !== 'free' && state.plan !== 'active', env: cfg.env, clientToken: cfg.clientToken, priceId: cfg.priceId, email: req.user.email, orgId: String(org.id) },
      canManage: ['owner', 'admin'].includes(req.user.role),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/billing/email — the address invoices go to (owner or admin)
router.post('/email', requireAuth, requireMinRole('admin'), async (req, res) => {
  try {
    const email = String(req.body && req.body.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'A valid email is needed' });
    await one('UPDATE organizations SET billing_email = $2 WHERE id = $1 RETURNING id', [req.user.org_id, email]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// The Paddle webhook, mounted in app.js with the raw body (the signature covers the exact bytes).
async function paddleWebhook(req, res) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'PADDLE_WEBHOOK_SECRET is not set' });
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (!verifyPaddleSignature(raw, req.get('paddle-signature'), secret)) return res.status(401).json({ error: 'Bad signature' });
  let event;
  try {
    event = JSON.parse(raw);
  } catch (_) {
    return res.status(400).json({ error: 'Not JSON' });
  }
  try {
    const change = await applyPaddleEvent(event);
    if (change && change.towerCode) {
      const kind = change.plan === 'active' ? 'paid' : change.plan === 'cancelled' ? 'cancelled' : change.plan === 'past_due' ? 'past_due' : null;
      if (kind) await towerNotify(change.towerCode, { kind, orgId: String(change.orgId), company: change.company, monthlyUsd: change.monthlyUsd });
    }
    res.json({ ok: true, applied: !!change });
  } catch (e) {
    console.error('[paddle webhook]', e.message);
    res.status(500).json({ error: e.message });
  }
}

module.exports = router;
module.exports.paddleWebhook = paddleWebhook;
