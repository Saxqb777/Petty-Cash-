// ═══════════════════════════════════════════════════════════════════════════
//  Seeding
//
//  Everything here used to run at boot inside server.js / db/database.js. On
//  serverless that is wrong — it would run on every cold start. It now runs
//  once, explicitly, via `npm run db:seed` (which `npm run db:migrate` also
//  calls at the end).
//
//  `seedExpenseTypesForOrg` and `seedOrgDefaults` are also exported so that
//  auth.js can seed a brand-new org during signup, inside the same transaction.
// ═══════════════════════════════════════════════════════════════════════════

require('dotenv').config();

const { query, withTransaction } = require('./index');

const DEFAULT_EXCHANGE_RATES =
  '{"USD":3.6725,"EUR":4.02,"GBP":4.68,"SAR":0.98,"QAR":1.01,"KWD":11.96,"OMR":9.53,"INR":0.044}';

// The platform owner. Promoted idempotently; a no-op until the account exists.
const PLATFORM_OWNER_EMAIL = 'saaqibkhan58@gmail.com';

const DEFAULT_EXPENSE_TYPES = [
  {
    name: 'Petrol & Fuel', slug: 'adnoc', icon: 'fuel', color: '#f97316',
    description: 'Fuel station receipts and vehicle fuel expenses',
    fields_schema: JSON.stringify([
      { key: 'invoice_number', label: 'Receipt No.', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'currency', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'fuel_type', label: 'Fuel Type', type: 'select', options: ['Special 95', 'Super 98', 'Diesel', 'E-Plus 91'], custom: true },
      { key: 'litres', label: 'Litres', type: 'number', custom: true },
      { key: 'odometer', label: 'Odometer', type: 'text', custom: true },
      { key: 'vehicle_plate', label: 'Vehicle Plate', type: 'text', custom: true },
      { key: 'business_unit', label: 'Business Unit', type: 'select', options: ['AAFB', 'Al Foah', 'GMFF', 'BMB', 'Other'] },
      { key: 'payment_method', label: 'Payment Method', type: 'select', options: ['Card', 'Cash'] },
      { key: 'purpose', label: 'Trip / Route', type: 'text' },
      { key: 'submitted_by', label: 'Submitted By', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ]),
    ai_hints: 'ADNOC, ENOC, EPPCO, or other UAE fuel station receipt. Extract fuel type, litres, odometer reading, vehicle plate if visible.',
    is_builtin: true, sort_order: 0,
  },
  {
    name: 'Shipping Line Bill', slug: 'shipping', icon: 'ship', color: '#3b82f6',
    description: 'Freight invoices, THC, demurrage, customs clearance bills',
    fields_schema: JSON.stringify([
      { key: 'vendor_name', label: 'Shipping Line / Agent', type: 'text', required: true },
      { key: 'invoice_number', label: 'Invoice / Reference No.', type: 'text' },
      { key: 'bl_numbers', label: 'BL Numbers', type: 'chips' },
      { key: 'container_numbers', label: 'Container Numbers', type: 'chips' },
      { key: 'port', label: 'Port', type: 'select', options: ['AUH', 'DXB', 'AJM', 'SHJ'] },
      { key: 'shipment_type', label: 'Import / Export', type: 'select', options: ['Import', 'Export'] },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'business_unit', label: 'Business Unit', type: 'select', options: ['AAFB', 'Al Foah', 'GMFF', 'BMB', 'Other'] },
      { key: 'line_items', label: 'Charges Breakdown', type: 'charges' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ]),
    ai_hints: 'Shipping line bill, freight invoice, or clearance statement. Extract all BL numbers, container numbers, port, and every charge line item.',
    is_builtin: true, sort_order: 1,
  },
  {
    name: 'General Expense', slug: 'general', icon: 'grid', color: '#62833A',
    description: 'Parking, printing, office supplies, materials, food, and any other expense',
    fields_schema: JSON.stringify([
      { key: 'vendor_name', label: 'Vendor / Shop Name', type: 'text', required: true },
      { key: 'invoice_number', label: 'Invoice Number', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'currency', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'category', label: 'Category', type: 'select', required: true, options: ['Fuel & Transport', 'Parking', 'Customs & Clearance', 'Printing & Photocopy', 'Materials & Supplies', 'Food & Beverages', 'Office Supplies', 'Accommodation & Travel', 'Medical', 'Miscellaneous'] },
      { key: 'business_unit', label: 'Business Unit', type: 'select', options: ['AAFB', 'Al Foah', 'GMFF', 'BMB', 'Other'] },
      { key: 'payment_method', label: 'Payment Method', type: 'select', options: ['Cash', 'Card'] },
      { key: 'purpose', label: 'Purpose', type: 'text' },
      { key: 'submitted_by', label: 'Submitted By', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ]),
    ai_hints: 'General petty cash receipt: parking, printing, photocopy, office supplies, food, stationery, accommodation, or miscellaneous expense.',
    is_builtin: true, sort_order: 2,
  },
];

// `exec` is either the module-level http driver or a transaction handle — both
// expose the same query(text, params) → rows signature.
const defaultExec = { query };

/** Insert the three built-in expense types for an org. Idempotent. */
async function seedExpenseTypesForOrg(orgId, exec = defaultExec) {
  for (const t of DEFAULT_EXPENSE_TYPES) {
    await exec.query(
      `INSERT INTO expense_types
         (org_id, name, slug, icon, color, description, fields_schema, ai_hints, is_builtin, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (org_id, slug) DO NOTHING`,
      [orgId, t.name, t.slug, t.icon, t.color, t.description, t.fields_schema, t.ai_hints, t.is_builtin, t.sort_order]
    );
  }
}

/** Default exchange rates + built-in expense types for a freshly created org. */
async function seedOrgDefaults(orgId, exec = defaultExec) {
  await exec.query(
    `INSERT INTO settings (key, value, org_id) VALUES ('exchange_rates', $1, $2)
     ON CONFLICT (key, org_id) DO NOTHING`,
    [DEFAULT_EXCHANGE_RATES, orgId]
  );
  await seedExpenseTypesForOrg(orgId, exec);
}

/** Create the SEED_OWNER_EMAIL account (owner of org 1) if it does not exist. */
async function seedOwner(exec = defaultExec) {
  const email = (process.env.SEED_OWNER_EMAIL || '').trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!email || !password) return null;

  const existing = (await exec.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]))[0];
  if (existing) return null;

  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash(password, 12);

  const user = (await exec.query(
    'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id',
    [email, hash, 'Owner']
  ))[0];

  await exec.query(
    `INSERT INTO memberships (user_id, org_id, role, status) VALUES ($1, 1, 'owner', 'active')
     ON CONFLICT (user_id, org_id) DO NOTHING`,
    [user.id]
  );

  return email;
}

/** Full one-shot seed. Safe to re-run. */
async function runSeed() {
  await withTransaction(async (tx) => {
    // Default org (id = 1). Explicit id, so the BIGSERIAL sequence has to be
    // pushed past it afterwards or the next org insert collides on id = 1.
    await tx.query(
      `INSERT INTO organizations (id, name, slug, accent_color)
       VALUES (1, 'Agthia Group', 'agthia', '#62833A')
       ON CONFLICT (id) DO NOTHING`
    );
    await tx.query(
      `SELECT setval(pg_get_serial_sequence('organizations', 'id'),
                     GREATEST((SELECT COALESCE(MAX(id), 1) FROM organizations), 1))`
    );

    await seedOrgDefaults(1, tx);

    // Promote the platform owner (no-op until that account signs up).
    await tx.query('UPDATE users SET is_superadmin = TRUE WHERE LOWER(email) = $1', [PLATFORM_OWNER_EMAIL]);

    const owner = await seedOwner(tx);
    if (owner) console.log(`[seed] owner account created: ${owner}`);
  });
  console.log('[seed] done — org 1, exchange rates, built-in expense types.');
}

module.exports = {
  DEFAULT_EXPENSE_TYPES,
  DEFAULT_EXCHANGE_RATES,
  seedExpenseTypesForOrg,
  seedOrgDefaults,
  seedOwner,
  runSeed,
};

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => { console.error('[seed] failed:', err.message); process.exit(1); });
}
