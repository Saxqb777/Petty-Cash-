const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractTextFromImage } = require('../utils/ocr');
const { parseReceiptText } = require('../utils/parser');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only images and PDFs allowed'));
  }
});

router.post('/', upload.single('bill'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const imagePath = req.file.path;
    const filename = req.file.originalname;

    let ocrText = '';
    try {
      ocrText = await extractTextFromImage(imagePath);
    } catch (err) {
      console.warn('OCR failed:', err.message);
    }

    let parsed = {
      vendor_name: '',
      amount: 0,
      currency: 'AED',
      date: new Date().toISOString().split('T')[0],
      category: 'Miscellaneous',
      business_unit: null,
      payment_method: 'Cash',
      purpose: '',
      submitted_by: null,
      line_items: [],
      notes: null,
      invoice_number: null
    };

    try {
      parsed = await parseReceiptText(ocrText, filename);
    } catch (err) {
      console.warn('Claude parse failed:', err.message);
    }

    res.json({
      image_path: `/uploads/${req.file.filename}`,
      ocr_text: ocrText,
      parsed
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
