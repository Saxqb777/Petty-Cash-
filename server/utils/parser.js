const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { extractPdfText, isPdf } = require('./ocr');

const MIME_MAP = {
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
- Common expenses: ADNOC fuel (100–200 AED), parking (10–60 AED), photocopy (10–100 AED)
- Currency is almost always AED. Receipts may contain Arabic text.
- Dates appear as DD/MM/YYYY or DD.MM.YYYY — convert to YYYY-MM-DD
- Today: ${today}

Return ONLY a valid JSON object, no markdown, no explanation:
{
  "invoice_number": "receipt number or null",
  "vendor_name": "vendor name (e.g. ADNOC, Carrefour, Dubai Parking)",
  "amount": 0.00,
  "currency": "AED",
  "date": "YYYY-MM-DD",
  "category": "one of: ${CATEGORIES.join(' | ')}",
  "business_unit": "one of: ${BUSINESS_UNITS.join(' | ')} or null",
  "payment_method": "Cash or Card",
  "purpose": "brief description of what this expense was for",
  "submitted_by": "person name if visible or null",
  "line_items": [],
  "notes": "any other useful info or null"
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

  let response;

  if (isPdf(filePath)) {
    // PDF: extract text first, then ask Claude to parse it
    let pdfText = '';
    try { pdfText = await extractPdfText(filePath); } catch (e) { /* silent */ }

    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `${prompt}\n\nText extracted from the PDF receipt:\n"""\n${pdfText || '[No text could be extracted]'}\n"""\n\nFilename: ${originalName}`
      }]
    });
  } else {
    // Image: send directly to Claude Vision — much more accurate than OCR
    const ext = path.extname(filePath).toLowerCase();
    const mediaType = MIME_MAP[ext] || 'image/jpeg';
    const imageData = fs.readFileSync(filePath).toString('base64');

    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageData }
          },
          { type: 'text', text: prompt }
        ]
      }]
    });
  }

  return cleanJson(response.content[0].text);
}

module.exports = { parseReceiptFile };
