const db = require('../db/database');

// Loads session cookie → user + active membership → attaches to req
function requireAuth(req, res, next) {
  const token = req.cookies?.session;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const session = db.prepare(
    `SELECT s.user_id, s.expires_at, u.email, u.full_name,
            m.org_id, m.role, m.status,
            o.name as org_name, o.slug as org_slug, o.accent_color
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN memberships m ON m.user_id = s.user_id AND m.status = 'active'
     JOIN organizations o ON o.id = m.org_id
     WHERE s.id = ? AND s.expires_at > datetime('now')
     LIMIT 1`
  ).get(token);

  if (!session) return res.status(401).json({ error: 'Session expired or invalid' });

  // Rolling session — extend by 30 days on each request
  db.prepare(`UPDATE sessions SET expires_at = datetime('now', '+30 days') WHERE id = ?`).run(token);

  req.user = {
    id: session.user_id,
    email: session.email,
    full_name: session.full_name,
    org_id: session.org_id,
    role: session.role,
    org_name: session.org_name,
    org_slug: session.org_slug,
    accent_color: session.accent_color,
  };
  next();
}

// For users who just signed up but are pending approval
function requireAuthAny(req, res, next) {
  const token = req.cookies?.session;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const session = db.prepare(
    `SELECT s.user_id, s.expires_at, u.email, u.full_name
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now')`
  ).get(token);

  if (!session) return res.status(401).json({ error: 'Session expired or invalid' });

  db.prepare(`UPDATE sessions SET expires_at = datetime('now', '+30 days') WHERE id = ?`).run(token);

  req.user = { id: session.user_id, email: session.email, full_name: session.full_name };
  next();
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

module.exports = { requireAuth, requireAuthAny, requireRole, requireMinRole };
