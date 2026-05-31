const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
  }

  // For images: use Tesseract OCR
  const { data: { text } } = await Tesseract.recognize(filePath, 'eng+ara', {
    logger: () => {}
  });
  return text || '';
}

// Keep old export name for compatibility
module.exports = { extractTextFromImage: extractTextFromFile, extractTextFromFile };
