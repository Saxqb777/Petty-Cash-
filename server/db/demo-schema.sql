-- ═══════════════════════════════════════════════════════════════════════════
--  Demo database only (DEMO_DATABASE_URL), applied after schema.sql.
--  Daily counters that keep the public demo inside its budget.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS demo_usage (
  day       TEXT PRIMARY KEY,              -- 'YYYY-MM-DD', UTC
  reads     INTEGER NOT NULL DEFAULT 0,    -- documents read by the model
  companies INTEGER NOT NULL DEFAULT 0     -- sample companies opened
);
