const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const IMAGE_MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp'
};

const CATEGORIES = [
  'Fuel & Transport', 'Parking', 'Customs & Clearance', 'Printing & Photocopy',
  'Materials & Supplies', 'Food & Beverages', 'Office Supplies',
  'Accommodation & Travel', 'Medical', 'Miscellaneous'
];

function getClient() {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key) throw new Error('ANTHROPIC_API_KEY is missing from your .env file');
  return new Anthropic({ apiKey: key });
}

function buildPrompt(today) {
  return `You are an expert UAE petty cash accountant for Agthia Group, a UAE food & beverage company.

CONTEXT:
- Business units: AAFB (Agthia Flour & Bakery), Al Foah (dates/agriculture), GMFF, BMB
- Common receipts: ADNOC/ENOC/EPPCO fuel (100–500 AED), parking (10–100 AED), printing/photocopy (10–200 AED), stationery, food, accommodation
- Currency is almost always AED. Rarely USD/EUR.
- Receipts may contain Arabic text — read both Arabic and English content
- Today: ${today}

DATE PARSING: Handle any format (DD/MM/YYYY, DD.MM.YYYY, Month DD YYYY, DD-MMM-YY) → always output YYYY-MM-DD

BUSINESS UNIT DETECTION: If the receipt mentions "Al Foah", "AAFB", "GMFF", "BMB", or Agthia subsidiary names — set business_unit. Otherwise null.

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "invoice_number": "receipt or invoice number visible on the document, or null",
  "vendor_name": "exact name of vendor, shop, station, or company as shown on the receipt",
  "amount": 0.00,
  "currency": "AED",
  "date": "YYYY-MM-DD",
  "category": "one of: ${CATEGORIES.join(' | ')}",
  "business_unit": "AAFB or Al Foah or GMFF or BMB or null",
  "payment_method": "Cash or Card (look for 'paid by card', POS slip, card last 4 digits)",
  "purpose": "short clear purpose e.g. 'Vehicle fuel top-up' or 'Office parking fee'",
  "submitted_by": "person name if visible on the receipt, else null",
  "line_items": [],
  "notes": null
}`;
}

function buildShippingPrompt(today) {
  return `You are an expert UAE freight & customs accountant for Agthia Group. Extract EVERY detail from this shipping document with maximum accuracy — like a human expert reading it carefully.

DOCUMENT TYPE: Could be a shipping line bill, freight invoice, clearance bill, debit note, or combined charges statement from companies like MSC, Maersk, CMA CGM, Hapag-Lloyd, Emirates Shipping Line, COSCO, Evergreen, or local UAE freight/clearance agents (Al Gharbeya, Gulftainer, ADPC agents, etc.)

CONSIGNEE CONTEXT:
- The importer/consignee is Agthia Group or one of its subsidiaries
- If you see "Al Foah", "AAFB", "GMFF", "BMB", or "Agthia" in the consignee/notify party → set business_unit
- Today: ${today}

PORT NORMALIZATION — read port of loading, port of discharge, place of delivery:
- Abu Dhabi / Khalifa Port / KIZAD / ADCP / Musaffah / Mina Zayed → "AUH"
- Jebel Ali / DP World / JAFZA / Dubai Port / Dubai → "DXB"
- Sharjah / Sharjah Port / Khorfakkan → "SHJ"
- Ajman / Ajman Port → "AJM"
- For any other port use the actual port name

CURRENCY: All amounts in AED. If you see USD values, multiply by 3.6725. Return all amounts as AED numbers.

DATE: Convert any date format to YYYY-MM-DD (handle DD/MM/YYYY, DD.MM.YYYY, DD-MMM-YYYY, etc.)

CRITICAL — EXTRACT ALL BL AND CONTAINER NUMBERS:
- Many bills cover MULTIPLE containers — scan the ENTIRE document for all container numbers
- Container numbers: letters + numbers (e.g. MSCU1234567, TCKU9876543, CAIU1234560, HLXU8765432)
- BL numbers: alphanumeric strings in BL/B.O.L/House BL fields (e.g. MSCUAE123456, HLCUAUH123456789)
- If the bill lists containers in a table, extract every single one
- Put ALL container numbers in container_numbers array, ALL BL numbers in bl_numbers array

Return ONLY a valid JSON object — no markdown, no code fences, no extra text:
{
  "vendor_name": "full name of the shipping line or freight agent as printed on the bill",
  "invoice_number": "invoice number, credit note number, or reference number from the bill",
  "bl_numbers": ["MSCUAE123456", "MSCUAE654321"],
  "bl_number": "first BL number (or null)",
  "container_numbers": ["MSCU1234567", "TCKU9876543", "CAIU0000000"],
  "container_number": "first container number (or null)",
  "port": "AUH or DXB or SHJ or AJM or actual port name",
  "shipment_type": "Import or Export",
  "date": "YYYY-MM-DD",
  "business_unit": "AAFB or Al Foah or GMFF or BMB or null",
  "submitted_by": "person name if shown, else null",
  "line_items": [
    { "name": "Ocean Freight", "amount": 0 },
    { "name": "THC (Terminal Handling)", "amount": 0 },
    { "name": "Demurrage", "amount": 0 },
    { "name": "Detention", "amount": 0 },
    { "name": "Documentation Fee", "amount": 0 },
    { "name": "BOE / Customs Clearance", "amount": 0 },
    { "name": "MOIAT Fee", "amount": 0 },
    { "name": "Agent Fee", "amount": 0 },
    { "name": "Customs Duty", "amount": 0 },
    { "name": "Inspection Fee", "amount": 0 },
    { "name": "Transport / Delivery", "amount": 0 },
    { "name": "Port Charges", "amount": 0 },
    { "name": "Local Charges", "amount": 0 }
  ]
}

RULES FOR line_items:
- Go through EVERY charge row on the bill — miss nothing
- Map each charge to the closest standard name above and set its amount
- Any charge not matching a standard name → ADD as extra: { "name": "exact charge name from bill", "amount": 123.45 }
- Only leave amount as 0 for charges genuinely absent from this bill
- All amounts must be plain numbers (no commas, no currency symbols), in AED`;
}

function buildAdnocPrompt(today) {
  return `You are reading an ADNOC, ENOC, or other UAE fuel station receipt.

Extract all visible data. Today: ${today}

Return ONLY valid JSON (no markdown):
{
  "invoice_number": "receipt number or transaction ID, or null",
  "vendor_name": "fuel station name and location if shown (e.g. 'ADNOC - Al Mussafah', 'ENOC Deira')",
  "amount": 0.00,
  "currency": "AED",
  "date": "YYYY-MM-DD",
  "category": "Fuel & Transport",
  "business_unit": "AAFB or Al Foah or GMFF or BMB or null",
  "payment_method": "Card or Cash",
  "purpose": "Vehicle fuel top-up",
  "submitted_by": "driver name or person name if shown, else null",
  "odometer": "odometer reading if shown, else null",
  "vehicle_plate": "vehicle plate number if visible, else null",
  "litres": 0.00,
  "fuel_type": "Special 95 or Super 98 or Diesel or E-Plus 91 or null",
  "line_items": [],
  "notes": null
}`;
}

function cleanJson(raw) {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/s);
  if (fence) text = fence[1].trim();
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) text = text.slice(firstBrace, lastBrace + 1);
  return JSON.parse(text);
}

function normalizePort(port) {
  if (!port) return null;
  const p = port.toLowerCase();
  if (p.includes('abu dhabi') || p.includes('khalifa') || p.includes('musaffah') || p.includes('mina zayed') || p.includes('kizad') || p === 'auh') return 'AUH';
  if (p.includes('jebel ali') || p.includes('dubai') || p.includes('jafza') || p === 'dxb') return 'DXB';
  if (p.includes('sharjah') || p.includes('khorfakkan') || p === 'shj') return 'SHJ';
  if (p.includes('ajman') || p === 'ajm') return 'AJM';
  return port;
}

async function parseReceiptFile(filePath, originalName = '', expenseType = 'general') {
  const client = getClient();
  const today = new Date().toISOString().split('T')[0];
  const ext = path.extname(filePath).toLowerCase();
  const fileData = fs.readFileSync(filePath).toString('base64');

  let prompt;
  if (expenseType === 'shipping') prompt = buildShippingPrompt(today);
  else if (expenseType === 'adnoc') prompt = buildAdnocPrompt(today);
  else prompt = buildPrompt(today);

  let contentBlocks;
  if (ext === '.pdf') {
    contentBlocks = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } },
      { type: 'text', text: prompt }
    ];
  } else {
    const mediaType = IMAGE_MIME[ext] || 'image/jpeg';
    contentBlocks = [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: fileData } },
      { type: 'text', text: prompt }
    ];
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      { role: 'user', content: contentBlocks },
      { role: 'assistant', content: '{' }
    ]
  });

  const raw = '{' + response.content[0].text;
  const parsed = cleanJson(raw);

  // Normalize port to known codes
  if (parsed.port) parsed.port = normalizePort(parsed.port);

  // Ensure arrays exist
  if (expenseType === 'shipping') {
    if (!Array.isArray(parsed.bl_numbers)) {
      parsed.bl_numbers = parsed.bl_number ? [parsed.bl_number] : [];
    }
    if (!Array.isArray(parsed.container_numbers)) {
      parsed.container_numbers = parsed.container_number ? [parsed.container_number] : [];
    }
    // Deduplicate
    parsed.bl_numbers = [...new Set(parsed.bl_numbers.filter(Boolean))];
    parsed.container_numbers = [...new Set(parsed.container_numbers.filter(Boolean))];
    // Backfill singles
    if (!parsed.bl_number && parsed.bl_numbers.length) parsed.bl_number = parsed.bl_numbers[0];
    if (!parsed.container_number && parsed.container_numbers.length) parsed.container_number = parsed.container_numbers[0];
  }

  return parsed;
}

module.exports = { parseReceiptFile };
