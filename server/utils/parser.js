const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = [
  'Fuel & Transport',
  'Parking',
  'Customs & Clearance',
  'Printing & Photocopy',
  'Materials & Supplies',
  'Food & Beverages',
  'Office Supplies',
  'Accommodation & Travel',
  'Medical',
  'Miscellaneous'
];

const BUSINESS_UNITS = ['AAFB', 'Al Foah', 'GMFF', 'BMB', 'Other'];

async function parseReceiptText(ocrText, filename = '') {
  const today = new Date().toISOString().split('T')[0];

  const prompt = `You are an expert UAE petty cash accountant parsing a receipt or bill image for Agthia Group.

Context about this company:
- UAE-based food & logistics company with business units: AAFB (Al Ain Food & Beverages), Al Foah, GMFF, BMB
- Common petty cash expenses: ADNOC fuel (100–200 AED), parking tickets (10–60 AED), photocopy/printing (10–100 AED), materials, customs fees
- Currency is almost always AED
- Receipts may have Arabic text mixed with English
- Dates may appear as DD/MM/YYYY or DD.MM.YYYY

OCR text extracted from the bill:
"""
${ocrText || '[No text extracted - image may be unclear]'}
"""

Filename hint: ${filename}
Today's date: ${today}

Return ONLY a valid JSON object with NO markdown formatting, NO code blocks, NO explanation. Just pure JSON:
{
  "invoice_number": "receipt/invoice number if visible, else null",
  "vendor_name": "name of the vendor/shop/station (e.g. ADNOC, Carrefour, Dubai Municipality Parking)",
  "amount": 0.00,
  "currency": "AED",
  "date": "YYYY-MM-DD (use today ${today} if not found)",
  "category": "exactly one of: ${CATEGORIES.join(' | ')}",
  "business_unit": "one of: ${BUSINESS_UNITS.join(' | ')} or null if unclear",
  "payment_method": "Cash or Card",
  "purpose": "brief purpose of this expense (e.g. Vehicle fuel for Abu Dhabi airport run)",
  "submitted_by": "person name if visible, else null",
  "line_items": [],
  "notes": "any other relevant extracted info, else null"
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  let text = response.content[0].text.trim();

  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  return JSON.parse(text);
}

module.exports = { parseReceiptText };
