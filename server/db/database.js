const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/agthia.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

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

module.exports = db;
