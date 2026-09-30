// A sample company for the demo: three months of the paperwork a freight
// forwarder's finance team keys by hand. Every name, number and plate is made
// up. Dates are relative to today so the dashboard always looks current.

const { addMoney } = require('../utils/money');

const day = (daysAgo) => {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
};

const lines = (...pairs) => pairs.map(([name, amount]) => ({ name, amount }));
const total = (items) => items.reduce((sum, i) => addMoney(sum, i.amount), 0);

const SHIPPING = [
  { ago: 2, vendor: 'Gulf Coast Container Lines', inv: 'DN-24-10871', bl: ['GCCL2409118735'], cont: ['GCLU4418203', 'GCLU4418219'], port: 'DXB', type: 'Import', image: '/samples/shipping-bill.png', items: lines(['THC (Terminal Handling)', 1120], ['Delivery Order Fee', 450], ['Documentation Fee', 250], ['Container Cleaning', 180], ['BOE / Customs Clearance', 350]) },
  { ago: 9, vendor: 'Arabian Sea Shipping Agency', inv: 'INV-77420', bl: ['ASSA5510234'], cont: ['ASAU2201456'], port: 'AUH', type: 'Import', items: lines(['Ocean Freight', 3305.25], ['THC (Terminal Handling)', 560], ['Documentation Fee', 250], ['Agent Fee', 400]) },
  { ago: 20, vendor: 'Northstar Freight Lines', inv: '240917-DN', bl: ['NSFL0098812'], cont: ['NSFU7730021', 'NSFU7730038', 'NSFU7730044'], port: 'DXB', type: 'Import', review: 'Demurrage days are not readable on the photo. Check with the agent before saving.', items: lines(['THC (Terminal Handling)', 1680], ['Delivery Order Fee', 450], ['Demurrage', 1200], ['Documentation Fee', 250]) },
  { ago: 33, vendor: 'Gulf Coast Container Lines', inv: 'DN-24-10402', bl: ['GCCL2408217741'], cont: ['GCLU4410087'], port: 'SHJ', type: 'Export', items: lines(['THC (Terminal Handling)', 560], ['Documentation Fee', 250], ['Seal Charge', 45]) },
  { ago: 41, vendor: 'Mina Clearing and Forwarding', inv: 'MCF-3391', bl: ['ASSA5509871'], cont: ['ASAU2200933'], port: 'AUH', type: 'Import', items: lines(['BOE / Customs Clearance', 350], ['Agent Fee', 600], ['Inspection Fee', 210], ['Transport / Delivery', 750]) },
  { ago: 55, vendor: 'Northstar Freight Lines', inv: '240822-DN', bl: ['NSFL0097120'], cont: ['NSFU7720019', 'NSFU7720026'], port: 'DXB', type: 'Import', items: lines(['THC (Terminal Handling)', 1120], ['Delivery Order Fee', 450], ['Detention', 900]) },
  { ago: 64, vendor: 'Arabian Sea Shipping Agency', inv: 'INV-76911', bl: ['ASSA5507712'], cont: ['ASAU2198810'], port: 'DXB', type: 'Export', items: lines(['THC (Terminal Handling)', 560], ['Documentation Fee', 250]) },
  { ago: 79, vendor: 'Gulf Coast Container Lines', inv: 'DN-24-09544', bl: ['GCCL2407302219'], cont: ['GCLU4402291', 'GCLU4402307'], port: 'DXB', type: 'Import', items: lines(['THC (Terminal Handling)', 1120], ['Delivery Order Fee', 450], ['Documentation Fee', 250], ['MOIAT Fee', 150]) },
];

const FUEL = [
  { ago: 1, vendor: 'Al Noor Fuel Station, Al Quoz', amount: 262.8, fuel: 'Diesel', litres: 81.4, odo: '148,220', plate: 'Dubai N 48213', route: 'Jebel Ali to Al Quoz warehouse', image: '/samples/fuel-receipt.png' },
  { ago: 8, vendor: 'Desert Road Petrol, Jebel Ali', amount: 188.5, fuel: 'Diesel', litres: 58.4, odo: '147,905', plate: 'Dubai N 48213', route: 'Port run, two containers' },
  { ago: 16, vendor: 'City Fuel, Al Qusais', amount: 142.0, fuel: 'Special 95', litres: 50.1, odo: '62,310', plate: 'Dubai K 20977', route: 'Customs office and back' },
  { ago: 26, vendor: 'Al Noor Fuel Station, Al Quoz', amount: 305.25, fuel: 'Diesel', litres: 94.5, odo: '147,512', plate: 'Dubai N 48213', route: 'Abu Dhabi delivery' },
  { ago: 35, vendor: 'Desert Road Petrol, Jebel Ali', amount: 211.0, fuel: 'Diesel', litres: 65.3, odo: '146,980', plate: 'Dubai N 51102', route: 'Port run' },
  { ago: 47, vendor: 'City Fuel, Al Qusais', amount: 128.4, fuel: 'Special 95', litres: 45.3, odo: '61,742', plate: 'Dubai K 20977', route: 'Bank and customs' },
  { ago: 62, vendor: 'Al Noor Fuel Station, Al Quoz', amount: 276.9, fuel: 'Diesel', litres: 85.7, odo: '146,120', plate: 'Dubai N 51102', route: 'Sharjah delivery' },
  { ago: 74, vendor: 'Desert Road Petrol, Jebel Ali', amount: 198.75, fuel: 'Diesel', litres: 61.5, odo: '145,660', plate: 'Dubai N 48213', route: 'Port run' },
];

const GENERAL = [
  { ago: 3, vendor: 'City Parking, Deira', amount: 40, cat: 'Parking', purpose: 'Customs office visit', by: 'Omar' },
  { ago: 6, vendor: 'Copy Corner, Al Karama', amount: 85, cat: 'Printing & Photocopy', purpose: 'Copies of BOE for the auditor', by: 'Priya' },
  { ago: 12, vendor: 'Blue Pen Stationery', amount: 212.5, cat: 'Office Supplies', purpose: 'Files, labels and toner', by: 'Priya', image: '/samples/shop-receipt.png' },
  { ago: 19, vendor: 'Al Reef Cafeteria', amount: 96, cat: 'Food & Beverages', purpose: 'Tea for the warehouse team, stock count', by: 'Rashid' },
  { ago: 24, vendor: 'Swift Courier', amount: 45, currency: 'USD', rate: 3.6725, cat: 'Miscellaneous', purpose: 'Original BL courier to the bank', by: 'Omar' },
  { ago: 31, vendor: 'Gulf Packaging Supplies', amount: 640, cat: 'Materials & Supplies', purpose: 'Pallet wrap and tape', by: 'Rashid' },
  { ago: 39, vendor: 'Harbour View Hotel, Muscat', amount: 48.5, currency: 'OMR', rate: 9.53, cat: 'Accommodation & Travel', purpose: 'Site visit, one night', by: 'Omar' },
  { ago: 46, vendor: 'City Parking, Deira', amount: 30, cat: 'Parking', purpose: 'Bank visit', by: 'Priya' },
  { ago: 53, vendor: 'Copy Corner, Al Karama', amount: 120, cat: 'Printing & Photocopy', purpose: 'Delivery notes', by: 'Priya' },
  { ago: 60, vendor: 'Blue Pen Stationery', amount: 158, cat: 'Office Supplies', purpose: 'Month end folders', by: 'Priya' },
  { ago: 67, vendor: 'Care Pharmacy', amount: 74, cat: 'Medical', purpose: 'First aid kit refill', by: 'Rashid' },
  { ago: 85, vendor: 'Al Reef Cafeteria', amount: 132, cat: 'Food & Beverages', purpose: 'Lunch, vessel delay overtime', by: 'Rashid' },
];

// Clearance agent savings on three of the bills: the old agent's fee against the new one.
const SAVINGS = [
  { shipping: 0, oldFee: 950, newFee: 600 },
  { shipping: 4, oldFee: 900, newFee: 600 },
  { shipping: 7, oldFee: 950, newFee: 600 },
];

async function insertExpense(tx, orgId, e) {
  const row = await tx.one(
    `INSERT INTO expenses
       (org_id, expense_type, expense_type_id, invoice_number, vendor_name, amount, currency, amount_aed,
        exchange_rate, date, category, business_unit, payment_method, purpose, submitted_by, line_items,
        custom_fields, image_path, needs_review, review_notes, bl_number, bl_numbers, container_number,
        container_numbers, port, shipment_type)
     VALUES ($1, $2, (SELECT id FROM expense_types WHERE org_id = $1 AND slug = $2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
             $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
     RETURNING id, date`,
    [orgId, e.type, e.invoice || null, e.vendor, e.amount, e.currency || 'AED', e.amountAed ?? e.amount,
     e.rate || 1, e.date, e.category, e.unit || null, e.payment || 'Cash', e.purpose || null, e.by || null,
     JSON.stringify(e.items || []), JSON.stringify(e.custom || {}), e.image || null, !!e.review, e.review || null,
     e.bl?.[0] || null, JSON.stringify(e.bl || []), e.cont?.[0] || null, JSON.stringify(e.cont || []),
     e.port || null, e.shipmentType || null]
  );
  return row;
}

/** Fill a fresh demo company with three months of sample paperwork. */
async function seedSampleCompany(tx, orgId) {
  const shippingIds = [];
  for (const s of SHIPPING) {
    const amount = total(s.items);
    const row = await insertExpense(tx, orgId, {
      type: 'shipping', invoice: s.inv, vendor: s.vendor, amount, date: day(s.ago), category: 'Customs & Clearance',
      unit: 'Head office', payment: 'Card', purpose: `${s.type} clearance, ${s.cont.length} container${s.cont.length > 1 ? 's' : ''}`,
      by: 'Priya', items: s.items, image: s.image, review: s.review, bl: s.bl, cont: s.cont, port: s.port, shipmentType: s.type,
    });
    shippingIds.push({ id: row.id, date: row.date, s });
  }
  for (const f of FUEL) {
    await insertExpense(tx, orgId, {
      type: 'adnoc', invoice: `TX${String(900000 + f.ago * 137).slice(0, 6)}`, vendor: f.vendor, amount: f.amount, date: day(f.ago),
      category: 'Fuel & Transport', unit: 'Warehouse', payment: 'Card', purpose: f.route, by: 'Rashid',
      custom: { fuel_type: f.fuel, litres: f.litres, odometer: f.odo, vehicle_plate: f.plate }, image: f.image,
    });
  }
  for (const g of GENERAL) {
    const rate = g.rate || 1;
    await insertExpense(tx, orgId, {
      type: 'general', vendor: g.vendor, amount: g.amount, currency: g.currency || 'AED', rate,
      amountAed: Math.round(g.amount * rate * 100) / 100, date: day(g.ago), category: g.cat, unit: 'Head office',
      payment: 'Cash', purpose: g.purpose, by: g.by, image: g.image,
    });
  }
  for (const v of SAVINGS) {
    const ship = shippingIds[v.shipping];
    await tx.query(
      `INSERT INTO clearance_savings
         (org_id, expense_id, date, month, business_unit, port, reference_number, import_export,
          previous_agent, current_agent, old_fee, new_fee, savings, description)
       VALUES ($1, $2, $3, $4, 'Head office', $5, $6, $7, 'Harbour Agents LLC', 'Mina Clearing and Forwarding', $8, $9, $10, 'Agent fee per BOE')`,
      [orgId, ship.id, ship.date, ship.date.slice(0, 7), ship.s.port, ship.s.bl[0], ship.s.type, v.oldFee, v.newFee, v.oldFee - v.newFee]
    );
  }
}

// ── Made for one company ───────────────────────────────────────────────────
// A cold email from Doc Ledger links to the demo with ?for=<code>. The preview
// the sales team wrote for that company (its name and one of its documents)
// becomes a document type of its own in the sample company, with one example.

const cleanValue = (v) => String(v ?? '').replace(/\s*\(example\)\s*$/i, '').trim().slice(0, 120);
// "AED 1,200.00" → 1200; anything without a plain money figure → 0.
const money = (v) => {
  const m = String(v || '').match(/(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/);
  return m ? Number(`${m[1].replace(/,/g, '')}.${m[2] || '0'}`) : 0;
};
const keyOf = (label) => String(label).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'field';

function tailoredType(preview) {
  const fields = (Array.isArray(preview.sampleFields) ? preview.sampleFields : []).slice(0, 8);
  const docName = String(preview.sampleDocument || 'Your document').split(',')[0].trim().slice(0, 60) || 'Your document';
  const seen = new Set(['amount', 'date']);
  const schema = [
    { key: 'vendor_name', label: 'Vendor', type: 'text', required: true },
    { key: 'amount', label: 'Amount', type: 'currency', required: true },
    { key: 'date', label: 'Date', type: 'date', required: true },
  ];
  const custom = {};
  let vendor = null;
  let amount = null;
  for (const f of fields) {
    const label = String(f.field || '').trim().slice(0, 60);
    if (!label) continue;
    const value = cleanValue(f.value);
    if (/vendor|supplier|shipping line|carrier|agent/i.test(label) && !vendor) { vendor = value; continue; }
    if (/date/i.test(label)) continue;
    if (/^(currency|category)$/i.test(label)) continue;
    const n = money(value);
    if (amount === null && /total|amount/i.test(label) && n > 0) amount = n;
    const key = keyOf(label);
    if (seen.has(key)) continue;
    seen.add(key);
    schema.push({ key, label, type: 'text', custom: true });
    custom[key] = value;
  }
  // Only charge lines count toward the example's amount, never reference numbers.
  const priced = fields
    .filter((f) => /charge|fee|amount|total|rate|price|cost|duty|freight/i.test(String(f.field || '')))
    .map((f) => money(cleanValue(f.value)))
    .filter((n) => n > 0 && n < 1e7);
  if (amount === null) amount = priced.length ? priced.reduce((a, b) => a + b, 0) : 0;
  return {
    name: `Your ${docName.charAt(0).toLowerCase()}${docName.slice(1)}`,
    hints: `${docName} as ${preview.company} receives it. Read: ${schema.map((s) => s.label).join(', ')}.`,
    schema,
    record: { vendor: vendor || docName, amount: Math.round(amount * 100) / 100, custom },
  };
}

async function seedTailored(tx, orgId, preview) {
  const t = tailoredType(preview);
  await tx.query(
    `INSERT INTO expense_types (org_id, name, slug, icon, color, description, fields_schema, ai_hints, is_builtin, sort_order)
     VALUES ($1, $2, 'your-document', 'receipt', '#22356F', $3, $4, $5, FALSE, 3)
     ON CONFLICT (org_id, slug) DO NOTHING`,
    [orgId, t.name, `Set up for ${preview.company}`, JSON.stringify(t.schema), t.hints]
  );
  await insertExpense(tx, orgId, {
    type: 'your-document', vendor: t.record.vendor, amount: t.record.amount, date: day(0), category: 'Customs & Clearance',
    unit: 'Head office', payment: 'Card', purpose: `Example ${t.name.toLowerCase()} for ${preview.company}`, by: 'Priya', custom: t.record.custom,
  });
  return t.name;
}

module.exports = { seedSampleCompany, seedTailored, tailoredType };
