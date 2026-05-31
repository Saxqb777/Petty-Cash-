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
  "purpose": "brief description of what this expense was for",
  "submitted_by": "person name if visible, else null",
  "line_items": [],
  "notes": "any other useful info from the receipt, or null"
}`;
}

function cleanJson(raw) {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  return JSON.parse(text);
}

async function parseReceiptFile(filePath, originalName = '') {
  const client = getClient();
  const today = new Date().toISOString().split('T')[0];
  const prompt = buildPrompt(today);
  const ext = path.extname(filePath).toLowerCase();
  const fileData = fs.readFileSync(filePath).toString('base64');

  let contentBlocks;

  if (ext === '.pdf') {
    // Send PDF directly to Claude — it reads scanned PDFs natively
    contentBlocks = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: fileData }
      },
      { type: 'text', text: prompt }
    ];
  } else {
    // Send image directly to Claude Vision
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
    max_tokens: 1024,
    messages: [{ role: 'user', content: contentBlocks }]
  });

  return cleanJson(response.content[0].text);
}

module.exports = { parseReceiptFile };
