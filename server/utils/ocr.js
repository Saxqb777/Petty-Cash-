const Tesseract = require('tesseract.js');

async function extractTextFromImage(imagePath) {
  const { data: { text } } = await Tesseract.recognize(imagePath, 'eng+ara', {
    logger: () => {}
  });
  return text || '';
}

module.exports = { extractTextFromImage };
