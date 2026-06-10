const Database = require('better-sqlite3');
const { DB_PATH } = require('../config/paths');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ── Core expenses table ───────────────────────────────────────────────────────
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

// ── Safe migrations — add new columns without breaking existing data ──────────
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
migrate(`ALTER TABLE expenses ADD COLUMN file_hash TEXT`);
migrate(`ALTER TABLE expenses ADD COLUMN needs_review INTEGER DEFAULT 0`);
migrate(`ALTER TABLE expenses ADD COLUMN review_notes TEXT`);
migrate(`ALTER TABLE expenses ADD COLUMN org_id INTEGER REFERENCES organizations(id)`);

// ── Auth + org tables ─────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    accent_color TEXT DEFAULT '#62833A',
    logo_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','admin','finance','member')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, org_id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    org_id INTEGER REFERENCES organizations(id),
    PRIMARY KEY (key, org_id)
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

// ── More migrations (after tables exist) ─────────────────────────────────────
migrate(`ALTER TABLE clearance_savings ADD COLUMN expense_id INTEGER REFERENCES expenses(id)`);
migrate(`ALTER TABLE clearance_savings ADD COLUMN org_id INTEGER REFERENCES organizations(id)`);

// ── Seed Agthia Group org (id=1) ─────────────────────────────────────────────
db.prepare(`INSERT OR IGNORE INTO organizations (id, name, slug, accent_color) VALUES (1, 'Agthia Group', 'agthia', '#62833A')`).run();

// ── Migrate existing rows to Agthia org ──────────────────────────────────────
db.exec(`UPDATE expenses SET org_id = 1 WHERE org_id IS NULL`);
db.exec(`UPDATE clearance_savings SET org_id = 1 WHERE org_id IS NULL`);

// ── Seed default exchange rates for Agthia org ───────────────────────────────
// Settings table now has composite PK (key, org_id) — insert for org 1
try {
  db.exec(`
    INSERT OR IGNORE INTO settings (key, value, org_id)
    SELECT key, value, 1 FROM (
      SELECT 'exchange_rates' as key,
        '{"USD":3.6725,"EUR":4.02,"GBP":4.68,"SAR":0.98,"QAR":1.01,"KWD":11.96,"OMR":9.53,"INR":0.044}' as value
    )
  `);
} catch (_) {}

// ── Also seed the old keyless row for backwards compat during transition ──────
try {
  db.exec(`INSERT OR IGNORE INTO settings (key, value) VALUES ('exchange_rates', '{"USD":3.6725,"EUR":4.02,"GBP":4.68,"SAR":0.98,"QAR":1.01,"KWD":11.96,"OMR":9.53,"INR":0.044}')`);
} catch (_) {}

// ── Backfill amount_aed for old records ───────────────────────────────────────
db.exec(`UPDATE expenses SET amount_aed = amount, exchange_rate = 1 WHERE amount_aed IS NULL`);

// ── Phase 2: Custom expense types ────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS expense_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    icon TEXT DEFAULT 'receipt',
    color TEXT DEFAULT '#62833A',
    description TEXT,
    fields_schema TEXT DEFAULT '[]',
    ai_hints TEXT,
    is_builtin INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, slug)
  )
`);

migrate(`ALTER TABLE expenses ADD COLUMN expense_type_id INTEGER REFERENCES expense_types(id)`);
migrate(`ALTER TABLE expenses ADD COLUMN custom_fields TEXT DEFAULT '{}'`);

// ── Default built-in types (seeded per-org) ───────────────────────────────────
const DEFAULT_TYPES = [
  {
    name: 'Petrol & Fuel', slug: 'adnoc', icon: 'fuel', color: '#f97316',
    description: 'Fuel station receipts and vehicle fuel expenses',
    fields_schema: JSON.stringify([
      {key:'invoice_number',label:'Receipt No.',type:'text'},
      {key:'amount',label:'Amount',type:'currency',required:true},
      {key:'date',label:'Date',type:'date',required:true},
      {key:'fuel_type',label:'Fuel Type',type:'select',options:['Special 95','Super 98','Diesel','E-Plus 91'],custom:true},
      {key:'litres',label:'Litres',type:'number',custom:true},
      {key:'odometer',label:'Odometer',type:'text',custom:true},
      {key:'vehicle_plate',label:'Vehicle Plate',type:'text',custom:true},
      {key:'business_unit',label:'Business Unit',type:'select',options:['AAFB','Al Foah','GMFF','BMB','Other']},
      {key:'payment_method',label:'Payment Method',type:'select',options:['Card','Cash']},
      {key:'purpose',label:'Trip / Route',type:'text'},
      {key:'submitted_by',label:'Submitted By',type:'text'},
      {key:'notes',label:'Notes',type:'textarea'}
    ]),
    ai_hints: 'ADNOC, ENOC, EPPCO, or other UAE fuel station receipt. Extract fuel type, litres, odometer reading, vehicle plate if visible.',
    is_builtin: 1, sort_order: 0
  },
  {
    name: 'Shipping Line Bill', slug: 'shipping', icon: 'ship', color: '#3b82f6',
    description: 'Freight invoices, THC, demurrage, customs clearance bills',
    fields_schema: JSON.stringify([
      {key:'vendor_name',label:'Shipping Line / Agent',type:'text',required:true},
      {key:'invoice_number',label:'Invoice / Reference No.',type:'text'},
      {key:'bl_numbers',label:'BL Numbers',type:'chips'},
      {key:'container_numbers',label:'Container Numbers',type:'chips'},
      {key:'port',label:'Port',type:'select',options:['AUH','DXB','AJM','SHJ']},
      {key:'shipment_type',label:'Import / Export',type:'select',options:['Import','Export']},
      {key:'date',label:'Date',type:'date',required:true},
      {key:'business_unit',label:'Business Unit',type:'select',options:['AAFB','Al Foah','GMFF','BMB','Other']},
      {key:'line_items',label:'Charges Breakdown',type:'charges'},
      {key:'notes',label:'Notes',type:'textarea'}
    ]),
    ai_hints: 'Shipping line bill, freight invoice, or clearance statement. Extract all BL numbers, container numbers, port, and every charge line item.',
    is_builtin: 1, sort_order: 1
  },
  {
    name: 'General Expense', slug: 'general', icon: 'grid', color: '#62833A',
    description: 'Parking, printing, office supplies, materials, food, and any other expense',
    fields_schema: JSON.stringify([
      {key:'vendor_name',label:'Vendor / Shop Name',type:'text',required:true},
      {key:'invoice_number',label:'Invoice Number',type:'text'},
      {key:'amount',label:'Amount',type:'currency',required:true},
      {key:'date',label:'Date',type:'date',required:true},
      {key:'category',label:'Category',type:'select',required:true,options:['Fuel & Transport','Parking','Customs & Clearance','Printing & Photocopy','Materials & Supplies','Food & Beverages','Office Supplies','Accommodation & Travel','Medical','Miscellaneous']},
      {key:'business_unit',label:'Business Unit',type:'select',options:['AAFB','Al Foah','GMFF','BMB','Other']},
      {key:'payment_method',label:'Payment Method',type:'select',options:['Cash','Card']},
      {key:'purpose',label:'Purpose',type:'text'},
      {key:'submitted_by',label:'Submitted By',type:'text'},
      {key:'notes',label:'Notes',type:'textarea'}
    ]),
    ai_hints: 'General petty cash receipt: parking, printing, photocopy, office supplies, food, stationery, accommodation, or miscellaneous expense.',
    is_builtin: 1, sort_order: 2
  }
];

const seedStmt = db.prepare(`
  INSERT OR IGNORE INTO expense_types
    (org_id, name, slug, icon, color, description, fields_schema, ai_hints, is_builtin, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedExpenseTypesForOrg = (orgId) => {
  DEFAULT_TYPES.forEach(t =>
    seedStmt.run(orgId, t.name, t.slug, t.icon, t.color, t.description, t.fields_schema, t.ai_hints, t.is_builtin, t.sort_order)
  );
};

// Seed for Agthia Group (org_id = 1)
seedExpenseTypesForOrg(1);

// ── Indexes ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_expenses_date          ON expenses(date DESC);
  CREATE INDEX IF NOT EXISTS idx_expenses_type          ON expenses(expense_type);
  CREATE INDEX IF NOT EXISTS idx_expenses_category      ON expenses(category);
  CREATE INDEX IF NOT EXISTS idx_expenses_business_unit ON expenses(business_unit);
  CREATE INDEX IF NOT EXISTS idx_expenses_created_at    ON expenses(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_expenses_org           ON expenses(org_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_file_hash     ON expenses(file_hash);
  CREATE INDEX IF NOT EXISTS idx_savings_date           ON clearance_savings(date DESC);
  CREATE INDEX IF NOT EXISTS idx_savings_expense_id     ON clearance_savings(expense_id);
  CREATE INDEX IF NOT EXISTS idx_savings_port_agent     ON clearance_savings(previous_agent, port, import_export);
  CREATE INDEX IF NOT EXISTS idx_savings_org            ON clearance_savings(org_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user          ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires       ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_memberships_user       ON memberships(user_id);
  CREATE INDEX IF NOT EXISTS idx_memberships_org        ON memberships(org_id);
  CREATE INDEX IF NOT EXISTS idx_expense_types_org      ON expense_types(org_id);
`);

db.seedExpenseTypesForOrg = seedExpenseTypesForOrg;
module.exports = db;
