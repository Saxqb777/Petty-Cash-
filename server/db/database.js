const Database = require('better-sqlite3');
const { DB_PATH } = require('../config/paths');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT,
    vendor_name TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'AED',
    date TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Miscellaneous',
    business_unit TEXT,
    payment_method TEXT DEFAULT 'Cash',
    purpose TEXT,
    submitted_by TEXT,
    line_items TEXT DEFAULT '[]',
    notes TEXT,
    image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Safe migrations — add new columns without breaking existing data
const migrate = (sql) => { try { db.exec(sql); } catch (_) {} };
migrate(`ALTER TABLE expenses ADD COLUMN expense_type TEXT DEFAULT 'general'`);
migrate(`ALTER TABLE expenses ADD COLUMN bl_number TEXT`);
migrate(`ALTER TABLE expenses ADD COLUMN container_number TEXT`);
migrate(`ALTER TABLE expenses ADD COLUMN port TEXT`);
migrate(`ALTER TABLE expenses ADD COLUMN shipment_type TEXT`);
migrate(`ALTER TABLE expenses ADD COLUMN amount_aed REAL`);
migrate(`ALTER TABLE expenses ADD COLUMN exchange_rate REAL DEFAULT 1`);
migrate(`ALTER TABLE expenses ADD COLUMN container_numbers TEXT DEFAULT '[]'`);
migrate(`ALTER TABLE expenses ADD COLUMN bl_numbers TEXT DEFAULT '[]'`);

// New tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clearance_savings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    month TEXT,
    business_unit TEXT,
    port TEXT,
    reference_number TEXT,
    import_export TEXT,
    previous_agent TEXT,
    current_agent TEXT,
    old_fee REAL NOT NULL DEFAULT 0,
    new_fee REAL NOT NULL DEFAULT 0,
    savings REAL NOT NULL DEFAULT 0,
    project_name TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Must run AFTER clearance_savings table exists
migrate(`ALTER TABLE clearance_savings ADD COLUMN expense_id INTEGER REFERENCES expenses(id)`);

// Seed default exchange rates
db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('exchange_rates', ?)`)
  .run('{"USD":3.6725,"EUR":4.02,"GBP":4.68,"SAR":0.98,"QAR":1.01,"KWD":11.96,"OMR":9.53,"INR":0.044}');

// Backfill amount_aed for old records
db.exec(`UPDATE expenses SET amount_aed = amount, exchange_rate = 1 WHERE amount_aed IS NULL`);

// Indexes for common query patterns (safe — CREATE INDEX IF NOT EXISTS)
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_expenses_date          ON expenses(date DESC);
  CREATE INDEX IF NOT EXISTS idx_expenses_type          ON expenses(expense_type);
  CREATE INDEX IF NOT EXISTS idx_expenses_category      ON expenses(category);
  CREATE INDEX IF NOT EXISTS idx_expenses_business_unit ON expenses(business_unit);
  CREATE INDEX IF NOT EXISTS idx_expenses_created_at    ON expenses(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_savings_date           ON clearance_savings(date DESC);
  CREATE INDEX IF NOT EXISTS idx_savings_expense_id     ON clearance_savings(expense_id);
  CREATE INDEX IF NOT EXISTS idx_savings_port_agent     ON clearance_savings(previous_agent, port, import_export);
`);

module.exports = db;
