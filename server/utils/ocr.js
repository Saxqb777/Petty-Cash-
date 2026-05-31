const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  // PDFs: use pdf-parse (text extraction, no OCR needed)
  if (ext === '.pdf') {
    try {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (err) {
      console.warn('[PDF] Could not extract text:', err.message);
      return '';
    }
  }

  // Images: use Tesseract OCR with a fresh worker each time
  try {
    const Tesseract = require('tesseract.js');
    const worker = await Tesseract.createWorker('eng');
    const { data: { text } } = await worker.recognize(filePath);
    await worker.terminate();
    return text || '';
  } catch (err) {
    console.warn('[OCR] Tesseract failed:', err.message);
    return '';
  }
}

module.exports = { extractTextFromImage: extractTextFromFile, extractTextFromFile };
