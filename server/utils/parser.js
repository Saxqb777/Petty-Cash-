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

const BUSINESS_UNITS = ['AAFB', 'Al Foah', 'GMFF', 'BMB', 'Other'];

function getClient() {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key) throw new Error('ANTHROPIC_API_KEY is missing from your .env file');
  return new Anthropic({ apiKey: key });
}

function buildPrompt(today) {
  return `You are an expert UAE petty cash accountant for Agthia Group.

Context:
- UAE food & logistics company. Business units: AAFB, Al Foah, GMFF, BMB
- Common expenses: ADNOC fuel (100–200 AED), parking (10–60 AED), photocopy/printing (10–100 AED)
- Currency is almost always AED. Receipts may contain Arabic text.
- Dates appear as DD/MM/YYYY or DD.MM.YYYY — convert all dates to YYYY-MM-DD format
- Today: ${today}

Extract all fields you can read from this receipt/document. Return ONLY a valid JSON object, no markdown, no explanation:
{
  "invoice_number": "receipt/invoice number visible on the bill, or null",
  "vendor_name": "name of vendor/shop/station (e.g. ADNOC, Carrefour, Dubai Municipality Parking)",
  "amount": 0.00,
  "currency": "AED",
  "date": "YYYY-MM-DD",
  "category": "one of: ${CATEGORIES.join(' | ')}",
  "business_unit": "one of: ${BUSINESS_UNITS.join(' | ')} or null if not clear",
  "payment_method": "Cash or Card",
  "purpose": "3-5 words max, e.g. 'Vehicle fuel' or 'Parking fee'",
  "submitted_by": "person name if visible on receipt, else null",
  "line_items": [],
  "notes": null
}`;
}

function buildShippingPrompt(today) {
  return `You are an expert UAE logistics accountant for Agthia Group.

Context:
- This is a shipping line bill or freight invoice (e.g. from MSC, Maersk, CMA CGM, Hapag-Lloyd, or a local freight agent)
- UAE food & logistics company. Dates appear as DD/MM/YYYY or DD.MM.YYYY — convert to YYYY-MM-DD
- Amounts are typically AED. If USD, convert at 3.67 AED/USD and return AED values
- Today: ${today}

Carefully read every charge listed on this bill. Return ONLY a valid JSON object, no markdown:
{
  "vendor_name": "shipping line or agent name (e.g. Mediterranean Shipping Company, Maersk, Al Gharbeya)",
  "invoice_number": "invoice or reference number on the bill, or null",
  "bl_number": "Bill of Lading number (look for BL No., B/L No., Bill of Lading field), or null",
  "container_number": "container number if shown (e.g. MSCU1234567), or null",
  "port": "port of discharge or loading (e.g. Abu Dhabi, Jebel Ali, AUH, DXB), or null",
  "shipment_type": "Import or Export based on context",
  "date": "YYYY-MM-DD (use invoice date or bill date)",
  "submitted_by": "person name if visible on bill, else null",
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

IMPORTANT for line_items:
- Match each charge on the bill to the closest standard name in the list above and set its amount
- If a charge on the bill does not match any standard name, ADD it as an extra object: { "name": "exact name from bill", "amount": 123.45 }
- Leave amount as 0 for charges not present on this bill
- All amounts must be numbers (not strings), in AED`;
}

function cleanJson(raw) {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  return JSON.parse(text);
}

async function parseReceiptFile(filePath, originalName = '', expenseType = 'general') {
  const client = getClient();
  const today = new Date().toISOString().split('T')[0];
  const prompt = expenseType === 'shipping' ? buildShippingPrompt(today) : buildPrompt(today);
  const ext = path.extname(filePath).toLowerCase();
  const fileData = fs.readFileSync(filePath).toString('base64');

  let contentBlocks;

  if (ext === '.pdf') {
    contentBlocks = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: fileData }
      },
      { type: 'text', text: prompt }
    ];
  } else {
    const mediaType = IMAGE_MIME[ext] || 'image/jpeg';
    contentBlocks = [
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: fileData }
      },
      { type: 'text', text: prompt }
    ];
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: contentBlocks }]
  });

  return cleanJson(response.content[0].text);
}

module.exports = { parseReceiptFile };
