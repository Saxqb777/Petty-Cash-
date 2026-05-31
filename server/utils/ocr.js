const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const PDF_EXTS = new Set(['.pdf']);

async function extractPdfText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text || '';
}

function isPdf(filePath) {
  return PDF_EXTS.has(path.extname(filePath).toLowerCase());
}

module.exports = { extractPdfText, isPdf };
