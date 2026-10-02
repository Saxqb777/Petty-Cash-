// Billing through Paddle (D080): Paddle is the merchant of record, so VAT, invoices and cards are theirs.
// The app only needs four values in its environment:
//   PADDLE_ENV             sandbox or production
//   PADDLE_CLIENT_TOKEN    the client side token Paddle.js initialises with
//   PADDLE_PRICE_ID        the monthly price (pri_...)
//   PADDLE_WEBHOOK_SECRET  the notification destination's secret (pdl_ntfset_...)
// A company starts in a free month (plan trial, trial_ends_at). Paddle's webhook moves it to active,
// past_due or cancelled. Organisations made before billing existed stay on plan free and are never gated.
const crypto = require('crypto');
const { one, query } = require('../db');

const TRIAL_DAYS = 30;
const MS_DAY = 24 * 3600 * 1000;

function billingEnabled() {
  return !!(process.env.PADDLE_CLIENT_TOKEN && process.env.PADDLE_PRICE_ID);
}

function checkoutConfig() {
  return {
    enabled: billingEnabled(),
    env: process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox',
    clientToken: process.env.PADDLE_CLIENT_TOKEN || null,
    priceId: process.env.PADDLE_PRICE_ID || null,
  };
}

// Paddle-Signature: ts=1671552777;h1=<hex>. Signed payload is "<ts>:<raw body>", HMAC SHA256 with the secret.
function verifyPaddleSignature(rawBody, header, secret, now = Date.now()) {
  if (!secret || !header || !rawBody) return false;
  const parts = Object.fromEntries(String(header).split(';').map((p) => p.trim().split('=')).filter((kv) => kv.length === 2));
  const ts = Number(parts.ts);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 5 * 60) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.ts}:${rawBody}`).digest('hex');
  const given = String(parts.h1 || '');
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
}

function planFromSubscription(status) {
  switch (String(status || '').toLowerCase()) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'paused':
    case 'canceled':
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

// Applies one Paddle event. Returns what changed, or null when the event is not about a subscription we know.
async function applyPaddleEvent(event) {
  const type = String(event && event.event_type || '');
  const data = (event && event.data) || {};
  const custom = data.custom_data || {};
  const orgId = Number(custom.org_id || custom.orgId || 0);
  if (!orgId) return null;
  let plan = null;
  if (type.startsWith('subscription.')) plan = planFromSubscription(data.status);
  else if (type === 'transaction.completed' && data.subscription_id) plan = 'active';
  if (!plan) return null;
  const org = await one('SELECT id, name, tower_code, plan FROM organizations WHERE id = $1', [orgId]);
  if (!org) return null;
  await query(
    `UPDATE organizations SET plan = $2, plan_updated_at = NOW(), paddle_customer_id = COALESCE($3, paddle_customer_id), paddle_subscription_id = COALESCE($4, paddle_subscription_id) WHERE id = $1`,
    [orgId, plan, data.customer_id || null, data.subscription_id || (type.startsWith('subscription.') ? data.id : null) || null]
  );
  const items = Array.isArray(data.items) ? data.items : [];
  const first = items[0] && items[0].price ? items[0].price : null;
  const unit = first && first.unit_price ? first.unit_price : null;
  const monthlyUsd = unit && unit.currency_code === 'USD' && Number.isFinite(Number(unit.amount)) ? Number(unit.amount) / 100 : null;
  return { orgId, plan, before: org.plan, towerCode: org.tower_code, company: org.name, monthlyUsd };
}

// What the app and its banner need to know about a company's plan.
function billingState(org, now = new Date()) {
  const plan = String(org.plan || 'free');
  const ends = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const daysLeft = ends ? Math.ceil((ends.getTime() - now.getTime()) / MS_DAY) : null;
  let blocked = false;
  let reason = null;
  if (plan === 'trial' && ends && ends.getTime() < now.getTime()) {
    blocked = true;
    reason = 'Your free month has ended. Continue with a card on the Billing page and every document reads again.';
  } else if (plan === 'cancelled') {
    blocked = true;
    reason = 'The subscription was cancelled. Continue with a card on the Billing page to keep reading documents.';
  } else if (plan === 'past_due') {
    reason = 'The last payment did not go through. Update the card on the Billing page.';
  }
  return { plan, trialEndsAt: ends ? ends.toISOString() : null, daysLeft, blocked, reason };
}

function trialEnd(from = new Date()) {
  return new Date(from.getTime() + TRIAL_DAYS * MS_DAY);
}

module.exports = { TRIAL_DAYS, billingEnabled, checkoutConfig, verifyPaddleSignature, applyPaddleEvent, billingState, trialEnd, planFromSubscription };
