-- ═══════════════════════════════════════════════════════════════════════════
--  Demo database only (DEMO_DATABASE_URL), applied after schema.sql.
--  Daily counters that keep the public demo inside its budget.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS demo_usage (
  day       TEXT PRIMARY KEY,              -- 'YYYY-MM-DD', UTC
  reads     INTEGER NOT NULL DEFAULT 0,    -- documents read by the model
  companies INTEGER NOT NULL DEFAULT 0     -- sample companies opened
);

-- Billing columns (D080) exist here too so shared queries work; the demo never bills anyone.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tower_code TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ;
