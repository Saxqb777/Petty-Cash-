const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { addMoney } = require('./money');

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
  // The SDK retries 429 / 500 / 529 automatically with exponential backoff.
  // timeout is per-attempt; a slow multi-page PDF gets up to 90s before a retry.
  return new Anthropic({ apiKey: key, maxRetries: 4, timeout: 90_000 });
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
  "notes": null,
  "confidence": {
    "amount": "high",
    "date": "high",
    "vendor_name": "high"
  }
}
For any field you are guessing or uncertain about, set its confidence to "low". Only include fields you are uncertain about in the confidence object.`;
}

function buildShippingPrompt(today) {
  return `You are an expert UAE freight & customs accountant for Agthia Group. Read every word, number, and table cell in this shipping document.

DOCUMENT TYPE: Shipping line bill, freight invoice, clearance statement, or debit/credit note from carriers like MSC, Maersk, CMA CGM, Hapag-Lloyd, Emirates Shipping, COSCO, Evergreen, or UAE agents (Al Gharbeya, Gulftainer, etc.)

TODAY: ${today}

━━━ STEP 1 — SCAN FOR CONTAINER NUMBERS ━━━
Container numbers follow this EXACT pattern: 4 uppercase letters + 7 digits (e.g. MSCU1234567, TRIU8617408, CAIU9876543, HLXU1234560, MRKU0000001).
- They appear in tables, lists, or inline — scan EVERY row, EVERY column, EVERY page
- A bill for 5 containers has 5 container numbers — find ALL of them
- Common prefixes: MSCU, TRIU, TCKU, CAIU, HLXU, MRKU, CRXU, FSCU, GESU, NYKU, TLLU, UACU
- Put EVERY container number you find into "container_numbers" array — missing even one is an error

━━━ STEP 2 — SCAN FOR BL NUMBERS ━━━
BL / Bill of Lading numbers appear near labels like "B/L No.", "BL No.", "Bill of Lading", "House BL".
- Extract ALL BL numbers into "bl_numbers" array

━━━ STEP 3 — PORT (normalize to code) ━━━
- Abu Dhabi / Khalifa Port / KIZAD / Musaffah / Mina Zayed / ADCP → "AUH"
- Jebel Ali / DP World / JAFZA / Dubai → "DXB"
- Sharjah / Khorfakkan → "SHJ"
- Ajman → "AJM"
- Use port of DISCHARGE (destination), not loading

━━━ STEP 4 — BUSINESS UNIT ━━━
If consignee/notify party contains "Al Foah", "AAFB", "GMFF", "BMB", or "Agthia" → set business_unit

━━━ STEP 5 — CHARGES ━━━
Read EVERY charge line on the bill. Amounts in AED (convert USD × 3.6725 if needed).

Now output ONLY this JSON object (no explanation, no markdown — start with { and end with }):
{
  "vendor_name": "shipping line or agent full name",
  "invoice_number": "invoice/debit note/reference number",
  "bl_numbers": ["all", "bl", "numbers"],
  "bl_number": "first bl number or null",
  "container_numbers": ["ALL", "container", "numbers", "found"],
  "container_number": "first container number or null",
  "port": "AUH or DXB or SHJ or AJM or port name",
  "shipment_type": "Import or Export",
  "date": "YYYY-MM-DD",
  "business_unit": "AAFB or Al Foah or GMFF or BMB or null",
  "submitted_by": "person name or null",
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
CHARGE RULES: match every line on the bill to a standard name above; add any extra charge as { "name": "exact name on bill", "amount": 123 }; use 0 only when a charge is genuinely absent; all amounts as plain AED numbers (no currency symbols or commas).
Also include a "confidence" object — for any field you are guessing, set its key to "low": { "amount": "high", "vendor_name": "high" }.`;
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
  "notes": null,
  "confidence": { "amount": "high", "date": "high" }
}
For any field you are guessing, set its confidence to "low".`;
}

function cleanJson(raw) {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/s);
  if (fence) text = fence[1].trim();
  // Always slice to first { ... last } to strip any surrounding prose
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) text = text.slice(firstBrace, lastBrace + 1);
  return JSON.parse(text);
}

const SUPPORTED_CURRENCIES = ['AED','USD','EUR','GBP','SAR','QAR','KWD','OMR','INR'];
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

function validateExtraction(parsed, expenseType) {
  const issues = [];
  let needs_review = false;

  // (a) amount must be positive
  const amount = parseFloat(parsed.amount);
  if (!amount || amount <= 0) {
    issues.push('Amount is missing or zero');
    needs_review = true;
  }

  // (b) date must parse, not future, not older than 2 years
  const dateVal = parsed.date ? new Date(parsed.date) : null;
  const now = Date.now();
  if (!dateVal || isNaN(dateVal.getTime())) {
    issues.push('Date could not be parsed');
    needs_review = true;
  } else if (dateVal.getTime() > now + 24 * 60 * 60 * 1000) {
    issues.push(`Date is in the future (${parsed.date})`);
    needs_review = true;
  } else if (now - dateVal.getTime() > TWO_YEARS_MS) {
    issues.push(`Date is more than 2 years ago (${parsed.date}) — verify it is correct`);
    needs_review = true;
  }

  // (c) currency must be supported, else default AED
  if (parsed.currency && !SUPPORTED_CURRENCIES.includes(parsed.currency.toUpperCase())) {
    issues.push(`Unrecognised currency "${parsed.currency}" — defaulted to AED`);
    parsed.currency = 'AED';
    needs_review = true;
  }

  // (d) line_items sum check for shipping
  if (expenseType === 'shipping' && Array.isArray(parsed.line_items) && parsed.line_items.length > 0) {
    const lineSum = addMoney(...parsed.line_items.map(li => parseFloat(li.amount) || 0));
    const nonZeroItems = parsed.line_items.filter(li => (parseFloat(li.amount) || 0) > 0);
    if (nonZeroItems.length > 0 && Math.abs(lineSum - amount) > 0.5) {
      issues.push(`Line items sum (${lineSum.toFixed(2)}) differs from total (${amount.toFixed(2)}) by more than 0.50`);
      needs_review = true;
    }
  }

  // (e) promote low-confidence fields to needs_review
  const lowConfidence = Object.entries(parsed.confidence || {})
    .filter(([, v]) => v === 'low')
    .map(([k]) => k);
  if (lowConfidence.length > 0) {
    issues.push(`Low confidence fields: ${lowConfidence.join(', ')}`);
    needs_review = true;
  }

  return { needs_review, review_notes: issues.length ? issues.join('; ') : null, low_confidence_fields: lowConfidence };
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

function buildCustomPrompt(today, fieldsSchema, aiHints) {
  const lines = [];
  fieldsSchema.forEach(f => {
    if (f.type === 'currency') {
      lines.push(`  "amount": 0.00`, `  "currency": "AED"`);
    } else if (f.type === 'chips') {
      lines.push(`  "${f.key}": []`);
    } else if (f.type === 'select' && f.options?.length) {
      lines.push(`  "${f.key}": "one of: ${f.options.join(' | ')}"`);
    } else if (f.type === 'number') {
      lines.push(`  "${f.key}": 0`);
    } else if (f.type === 'date') {
      lines.push(`  "${f.key}": "YYYY-MM-DD"`);
    } else if (f.key && f.type !== 'charges') {
      lines.push(`  "${f.key}": "..."`);
    }
  });
  lines.push(`  "confidence": {}`);

  return `You are extracting expense data from a UAE business receipt or invoice for Agthia Group.
Today: ${today}

${aiHints ? `CONTEXT:\n${aiHints}\n\n` : ''}DATE PARSING: Handle any format → output YYYY-MM-DD.
BUSINESS UNIT: If the receipt mentions "Al Foah", "AAFB", "GMFF", "BMB" → set business_unit.

Return ONLY valid JSON (no markdown):
{
${lines.join(',\n')}
}

For any field you are uncertain about, add its key to the confidence object with value "low".`;
}

async function parseReceiptFile(filePath, originalName = '', expenseType = 'general', customSchema = null, aiHints = null) {
  const client = getClient();
  const today = new Date().toISOString().split('T')[0];
  const ext = path.extname(filePath).toLowerCase();
  const fileData = fs.readFileSync(filePath).toString('base64');

  let prompt;
  if (customSchema) prompt = buildCustomPrompt(today, customSchema, aiHints);
  else if (expenseType === 'shipping') prompt = buildShippingPrompt(today);
  else if (expenseType === 'adnoc') prompt = buildAdnocPrompt(today);
  else prompt = buildPrompt(today);

  // Put the bill (volatile, changes every request) in the user turn, and the
  // large static instructions in the system prompt so they form a cacheable
  // prefix. cache_control is harmless if the prefix is below the model's
  // minimum cacheable size — it just won't cache.
  const media = ext === '.pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } }
    : { type: 'image', source: { type: 'base64', media_type: IMAGE_MIME[ext] || 'image/jpeg', data: fileData } };

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    temperature: 0, // deterministic extraction — same bill yields the same fields
    system: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: [
        media,
        { type: 'text', text: 'Extract the data from this document and respond with the JSON object only — no prose, no markdown fences.' }
      ]
    }]
  });

  const rawText = response.content.find(b => b.type === 'text')?.text || '';
  const parsed = cleanJson(rawText);

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
    // Regex-scan raw response for any container numbers missed in the array
    const containerPattern = /\b([A-Z]{4}\d{7})\b/g;
    const foundInText = [...rawText.matchAll(containerPattern)].map(m => m[1]);
    parsed.container_numbers = [...new Set([...parsed.container_numbers, ...foundInText].filter(Boolean))];

    // Deduplicate
    parsed.bl_numbers = [...new Set(parsed.bl_numbers.filter(Boolean))];
    parsed.container_numbers = [...new Set(parsed.container_numbers.filter(Boolean))];
    // Backfill singles
    if (!parsed.bl_number && parsed.bl_numbers.length) parsed.bl_number = parsed.bl_numbers[0];
    if (!parsed.container_number && parsed.container_numbers.length) parsed.container_number = parsed.container_numbers[0];
  }

  const validation = validateExtraction(parsed, expenseType);
  parsed.needs_review = validation.needs_review;
  parsed.review_notes = validation.review_notes;
  parsed.low_confidence_fields = validation.low_confidence_fields;

  return parsed;
}

module.exports = { parseReceiptFile };
