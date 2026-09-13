const { sql } = require('../db');

// Loads session cookie → user + active membership → attaches to req
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.session;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const rows = await sql`
      SELECT s.user_id, s.expires_at, u.email, u.full_name, u.is_superadmin,
             m.org_id, m.role, m.status,
             o.name AS org_name, o.slug AS org_slug, o.accent_color
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      JOIN memberships m ON m.user_id = s.user_id AND m.status = 'active'
      JOIN organizations o ON o.id = m.org_id
      WHERE s.id = ${token} AND s.expires_at > NOW()
      LIMIT 1`;

    const session = rows[0];
    if (!session) return res.status(401).json({ error: 'Session expired or invalid' });

    // Rolling session — extend by 30 days on each request
    await sql`UPDATE sessions SET expires_at = NOW() + INTERVAL '30 days' WHERE id = ${token}`;

    req.user = {
      id: session.user_id,
      email: session.email,
      full_name: session.full_name,
      org_id: session.org_id,
      role: session.role,
      org_name: session.org_name,
      org_slug: session.org_slug,
      accent_color: session.accent_color,
      is_superadmin: !!session.is_superadmin,
    };
    next();
  } catch (err) {
    next(err);
  }
}

// For users who just signed up but are pending approval
async function requireAuthAny(req, res, next) {
  try {
    const token = req.cookies?.session;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const rows = await sql`
      SELECT s.user_id, s.expires_at, u.email, u.full_name
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ${token} AND s.expires_at > NOW()
      LIMIT 1`;

    const session = rows[0];
    if (!session) return res.status(401).json({ error: 'Session expired or invalid' });

    await sql`UPDATE sessions SET expires_at = NOW() + INTERVAL '30 days' WHERE id = ${token}`;

    req.user = { id: session.user_id, email: session.email, full_name: session.full_name };
    next();
  } catch (err) {
    next(err);
  }
}

const ROLE_RANK = { member: 1, finance: 2, admin: 3, owner: 4 };

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if ((ROLE_RANK[req.user.role] || 0) < (ROLE_RANK[minRole] || 0)) {
      return res.status(403).json({ error: `Requires at least ${minRole} role` });
    }
    next();
  };
}

// Platform owner only — bypasses org scoping. Does not go through requireAuth
// because the superadmin may not have an active membership in every org.
async function requireSuperadmin(req, res, next) {
  try {
    const token = req.cookies?.session;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const rows = await sql`
      SELECT u.id, u.email, u.full_name, u.is_superadmin
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ${token} AND s.expires_at > NOW()
      LIMIT 1`;

    const row = rows[0];
    if (!row) return res.status(401).json({ error: 'Session expired or invalid' });
    if (!row.is_superadmin) return res.status(403).json({ error: 'Platform owner access required' });

    req.user = { id: row.id, email: row.email, full_name: row.full_name, is_superadmin: true };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, requireAuthAny, requireRole, requireMinRole, requireSuperadmin };
