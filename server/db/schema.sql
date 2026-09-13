-- ═══════════════════════════════════════════════════════════════════════════
--  Doc Ledger — Postgres schema (Neon)
--
--  Idempotent: every statement is CREATE ... IF NOT EXISTS, so this file can be
--  applied repeatedly. It is applied by `npm run db:migrate`, NEVER at request
--  time — serverless functions must not run DDL on every cold start.
--
--  Conventions carried over from the original SQLite schema:
--    · `date` columns (expenses.date, clearance_savings.date) stay TEXT in
--      'YYYY-MM-DD' form. They are compared and grouped as text throughout the
--      app and are handed to the client verbatim; making them DATE would return
--      JS Date objects and introduce timezone drift in the reports.
--    · JSON blobs (line_items, bl_numbers, container_numbers, custom_fields,
--      fields_schema) stay TEXT and are JSON.parse/stringify'd in JS, exactly as
--      before. See the note in server/db/index.js.
--    · Money columns are DOUBLE PRECISION (SQLite REAL). NUMERIC would be more
--      correct but node-postgres returns it as a *string*, which would break
--      every consumer. Arithmetic is done in integer fils in server/utils/money.js.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Organizations (tenants) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  accent_color TEXT DEFAULT '#62833A',
  logo_path    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Users ──────────────────────────────────────────────────────────────────
-- SQLite used `email TEXT UNIQUE COLLATE NOCASE`. Postgres has no per-column
-- collation equivalent without CITEXT, so uniqueness is enforced on LOWER(email)
-- and every write/read path lowercases the address first.
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  is_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- ── Memberships (user ↔ org, with role + approval status) ──────────────────
CREATE TABLE IF NOT EXISTS memberships (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id     BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member'  CHECK (role   IN ('owner','admin','finance','member')),
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, org_id)
);

-- ── Sessions (cookie token → user) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Expense types (built-in + per-org custom) ──────────────────────────────
CREATE TABLE IF NOT EXISTS expense_types (
  id            BIGSERIAL PRIMARY KEY,
  org_id        BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  icon          TEXT DEFAULT 'receipt',
  color         TEXT DEFAULT '#62833A',
  description   TEXT,
  fields_schema TEXT DEFAULT '[]',
  ai_hints      TEXT,
  is_builtin    BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

-- ── Expenses ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id                BIGSERIAL PRIMARY KEY,
  org_id            BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expense_type      TEXT NOT NULL DEFAULT 'general',
  expense_type_id   BIGINT REFERENCES expense_types(id) ON DELETE SET NULL,
  invoice_number    TEXT,
  vendor_name       TEXT NOT NULL DEFAULT '',
  amount            DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'AED',
  amount_aed        DOUBLE PRECISION,
  exchange_rate     DOUBLE PRECISION DEFAULT 1,
  date              TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT 'Miscellaneous',
  business_unit     TEXT,
  payment_method    TEXT DEFAULT 'Cash',
  purpose           TEXT,
  submitted_by      TEXT,
  line_items        TEXT DEFAULT '[]',
  custom_fields     TEXT DEFAULT '{}',
  notes             TEXT,
  image_path        TEXT,            -- Vercel Blob public URL
  file_hash         TEXT,            -- SHA-256 of the uploaded bytes
  needs_review      BOOLEAN NOT NULL DEFAULT FALSE,
  review_notes      TEXT,
  bl_number         TEXT,
  bl_numbers        TEXT DEFAULT '[]',
  container_number  TEXT,
  container_numbers TEXT DEFAULT '[]',
  port              TEXT,
  shipment_type     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Clearance savings (freight agent-fee savings tracker) ──────────────────
CREATE TABLE IF NOT EXISTS clearance_savings (
  id               BIGSERIAL PRIMARY KEY,
  org_id           BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expense_id       BIGINT REFERENCES expenses(id) ON DELETE CASCADE,
  date             TEXT NOT NULL,
  month            TEXT,
  business_unit    TEXT,
  port             TEXT,
  reference_number TEXT,
  import_export    TEXT,
  previous_agent   TEXT,
  current_agent    TEXT,
  old_fee          DOUBLE PRECISION NOT NULL DEFAULT 0,
  new_fee          DOUBLE PRECISION NOT NULL DEFAULT 0,
  savings          DOUBLE PRECISION NOT NULL DEFAULT 0,
  project_name     TEXT,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Settings (per-org key/value, e.g. exchange_rates) ──────────────────────
-- Composite primary key, so org_id must be NOT NULL (it was nullable in SQLite,
-- but every code path already supplies it).
CREATE TABLE IF NOT EXISTS settings (
  key    TEXT NOT NULL,
  value  TEXT NOT NULL,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (key, org_id)
);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_expenses_date          ON expenses (date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_type          ON expenses (expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_category      ON expenses (category);
CREATE INDEX IF NOT EXISTS idx_expenses_business_unit ON expenses (business_unit);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at    ON expenses (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_org           ON expenses (org_id);
CREATE INDEX IF NOT EXISTS idx_expenses_file_hash     ON expenses (file_hash);
CREATE INDEX IF NOT EXISTS idx_savings_date           ON clearance_savings (date DESC);
CREATE INDEX IF NOT EXISTS idx_savings_expense_id     ON clearance_savings (expense_id);
CREATE INDEX IF NOT EXISTS idx_savings_port_agent     ON clearance_savings (previous_agent, port, import_export);
CREATE INDEX IF NOT EXISTS idx_savings_org            ON clearance_savings (org_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user          ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires       ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_memberships_user       ON memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org        ON memberships (org_id);
CREATE INDEX IF NOT EXISTS idx_expense_types_org      ON expense_types (org_id);
