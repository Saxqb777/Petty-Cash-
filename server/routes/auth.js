const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sql, withTransaction, isUniqueViolation } = require('../db');
const { seedOrgDefaults } = require('../db/seed');
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

// Resolves a free slug. Runs inside the signup transaction so the uniqueness
// check and the insert cannot race with another signup.
async function uniqueSlug(tx, name) {
  const base = slugify(name) || 'org';
  let slug = base;
  let i = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await tx.one('SELECT id FROM organizations WHERE slug = $1', [slug])) {
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
    const existing = await sql`SELECT id FROM users WHERE LOWER(email) = ${normalEmail}`;
    if (existing.length) return res.status(409).json({ error: 'An account with this email already exists' });

    const password_hash = await bcrypt.hash(password, 12);

    const { userId, orgId, status, role } = await withTransaction(async (tx) => {
      const user = await tx.one(
        'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id',
        [normalEmail, password_hash, full_name.trim().slice(0, 100)]
      );

      if (action === 'create') {
        if (!org_name?.trim()) throw Object.assign(new Error('org_name is required when creating an org'), { status: 400 });

        const slug = await uniqueSlug(tx, org_name);
        const org = await tx.one(
          'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id',
          [org_name.trim().slice(0, 100), slug]
        );

        // Default exchange rates + built-in expense types for the new org.
        await seedOrgDefaults(org.id, tx);

        await tx.query(
          `INSERT INTO memberships (user_id, org_id, role, status) VALUES ($1, $2, 'owner', 'active')`,
          [user.id, org.id]
        );

        return { userId: user.id, orgId: org.id, status: 'active', role: 'owner' };
      }

      // join — normally a pending membership, approved by an admin of that org
      if (!org_id) throw Object.assign(new Error('org_id is required when joining an org'), { status: 400 });
      const org = await tx.one('SELECT id FROM organizations WHERE id = $1', [Number(org_id) || 0]);
      if (!org) throw Object.assign(new Error('Organization not found'), { status: 404 });

      // An organisation with nobody in it has nobody who can approve anyone, so
      // a pending request there would wait forever. This happens to any org
      // created by seeding rather than by a person signing up. The first person
      // to join an empty one therefore becomes its owner and approves everyone
      // after them. Once there is a single active member this branch never runs
      // again, so approval still gates every populated organisation.
      const populated = await tx.one(
        `SELECT 1 AS x FROM memberships WHERE org_id = $1 AND status = 'active' LIMIT 1`,
        [org.id]
      );
      const role   = populated ? 'member' : 'owner';
      const status = populated ? 'pending' : 'active';

      await tx.query(
        `INSERT INTO memberships (user_id, org_id, role, status) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, org_id) DO NOTHING`,
        [user.id, org.id, role, status]
      );

      return { userId: user.id, orgId: org.id, status, role };
    });

    // Create session
    const token = generateToken();
    await sql`INSERT INTO sessions (id, user_id, expires_at) VALUES (${token}, ${userId}, NOW() + INTERVAL '30 days')`;

    res.cookie('session', token, COOKIE_OPTS);
    res.status(201).json({
      status, role, org_id: orgId,
      message: status === 'pending' ? 'Request sent — waiting for approval' : 'Account created',
    });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: 'Email already registered' });
    res.status(err.status || 400).json({ error: err.message });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const normalEmail = email.trim().toLowerCase();
    const user = (await sql`SELECT * FROM users WHERE LOWER(email) = ${normalEmail}`)[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    // Check membership status — prefer an active membership over a pending one.
    const membership = (await sql`
      SELECT m.*, o.name AS org_name, o.slug, o.accent_color
      FROM memberships m JOIN organizations o ON o.id = m.org_id
      WHERE m.user_id = ${user.id}
      ORDER BY (m.status = 'active') DESC
      LIMIT 1`)[0];

    const token = generateToken();
    await sql`INSERT INTO sessions (id, user_id, expires_at) VALUES (${token}, ${user.id}, NOW() + INTERVAL '30 days')`;

    res.cookie('session', token, COOKIE_OPTS);
    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      is_superadmin: !!user.is_superadmin,
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
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies?.session;
    if (token) await sql`DELETE FROM sessions WHERE id = ${token}`;
    res.clearCookie('session', { path: '/' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get('/me', requireAuthAny, async (req, res) => {
  try {
    const memberships = await sql`
      SELECT m.role, m.status, m.org_id, o.name AS org_name, o.slug, o.accent_color
      FROM memberships m JOIN organizations o ON o.id = m.org_id
      WHERE m.user_id = ${req.user.id}`;

    const userRow = (await sql`SELECT is_superadmin FROM users WHERE id = ${req.user.id}`)[0];

    res.json({ ...req.user, memberships, is_superadmin: !!userRow?.is_superadmin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /auth/orgs — list orgs for the join dropdown ──────────────────────────
router.get('/orgs', async (req, res) => {
  try {
    const orgs = await sql`SELECT id, name, slug FROM organizations ORDER BY name ASC`;
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /auth/cancel-request — pending user cancels their join request ───────
router.post('/cancel-request', requireAuthAny, async (req, res) => {
  try {
    await sql`DELETE FROM memberships WHERE user_id = ${req.user.id} AND status = 'pending'`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
