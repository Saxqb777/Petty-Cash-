const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { requireAuthAny } = require('../middleware/auth');

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/',
};

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function uniqueSlug(name) {
  const base = slugify(name) || 'org';
  let slug = base;
  let i = 2;
  while (db.prepare('SELECT id FROM organizations WHERE slug = ?').get(slug)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

// ── POST /auth/signup ─────────────────────────────────────────────────────────
// Body: { full_name, email, password, action: 'create'|'join', org_name?, org_id? }
router.post('/signup', async (req, res) => {
  try {
    const { full_name, email, password, action, org_name, org_id } = req.body;

    if (!full_name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'full_name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!['create', 'join'].includes(action)) {
      return res.status(400).json({ error: 'action must be "create" or "join"' });
    }

    const normalEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalEmail);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const password_hash = await bcrypt.hash(password, 12);

    const doSignup = db.transaction(() => {
      const userResult = db.prepare(
        'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)'
      ).run(normalEmail, password_hash, full_name.trim().slice(0, 100));

      const userId = userResult.lastInsertRowid;

      if (action === 'create') {
        if (!org_name?.trim()) throw new Error('org_name is required when creating an org');
        const slug = uniqueSlug(org_name);
        const orgResult = db.prepare(
          'INSERT INTO organizations (name, slug) VALUES (?, ?)'
        ).run(org_name.trim().slice(0, 100), slug);

        const orgId = orgResult.lastInsertRowid;

        // Seed exchange rates for new org
        db.prepare('INSERT OR IGNORE INTO settings (key, value, org_id) VALUES (?, ?, ?)')
          .run('exchange_rates', '{"USD":3.6725,"EUR":4.02,"GBP":4.68,"SAR":0.98,"QAR":1.01,"KWD":11.96,"OMR":9.53,"INR":0.044}', orgId);

        // Seed default expense types for new org
        db.seedExpenseTypesForOrg(orgId);

        db.prepare(
          'INSERT INTO memberships (user_id, org_id, role, status) VALUES (?, ?, ?, ?)'
        ).run(userId, orgId, 'owner', 'active');

        return { userId, orgId, status: 'active', role: 'owner' };
      } else {
        // join — create pending membership
        if (!org_id) throw new Error('org_id is required when joining an org');
        const org = db.prepare('SELECT id FROM organizations WHERE id = ?').get(org_id);
        if (!org) throw new Error('Organization not found');

        db.prepare(
          'INSERT OR IGNORE INTO memberships (user_id, org_id, role, status) VALUES (?, ?, ?, ?)'
        ).run(userId, org_id, 'member', 'pending');

        return { userId, orgId: org_id, status: 'pending', role: 'member' };
      }
    });

    const { userId, orgId, status, role } = doSignup();

    // Create session
    const token = generateToken();
    db.prepare(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))`
    ).run(token, userId);

    res.cookie('session', token, COOKIE_OPTS);
    res.status(201).json({ status, role, org_id: orgId, message: status === 'pending' ? 'Request sent — waiting for approval' : 'Account created' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already registered' });
    res.status(400).json({ error: err.message });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    // Check membership status
    const membership = db.prepare(
      `SELECT m.*, o.name as org_name, o.slug, o.accent_color
       FROM memberships m JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = ? ORDER BY m.status = 'active' DESC LIMIT 1`
    ).get(user.id);

    const token = generateToken();
    db.prepare(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))`
    ).run(token, user.id);

    res.cookie('session', token, COOKIE_OPTS);
    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      membership: membership ? {
        status: membership.status,
        role: membership.role,
        org_id: membership.org_id,
        org_name: membership.org_name,
        accent_color: membership.accent_color,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const token = req.cookies?.session;
  if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
  res.clearCookie('session', { path: '/' });
  res.json({ success: true });
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get('/me', requireAuthAny, (req, res) => {
  const memberships = db.prepare(
    `SELECT m.role, m.status, m.org_id, o.name as org_name, o.slug, o.accent_color
     FROM memberships m JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = ?`
  ).all(req.user.id);

  const userRow = db.prepare('SELECT is_superadmin FROM users WHERE id = ?').get(req.user.id);

  res.json({ ...req.user, memberships, is_superadmin: !!userRow?.is_superadmin });
});

// ── GET /auth/orgs — list orgs for join dropdown ──────────────────────────────
router.get('/orgs', (req, res) => {
  try {
    const orgs = db.prepare('SELECT id, name, slug FROM organizations ORDER BY name ASC').all();
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /auth/cancel-request — pending user cancels their join request ───────
router.post('/cancel-request', requireAuthAny, (req, res) => {
  try {
    db.prepare(
      `DELETE FROM memberships WHERE user_id = ? AND status = 'pending'`
    ).run(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
