const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseReceiptFile } = require('../utils/parser');
const { UPLOADS_DIR } = require('../config/paths');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
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
    const allowed = /jpeg|jpg|png|gif|webp|pdf/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('Only images (JPG, PNG, WebP) and PDFs are supported'));
  }
});

const FALLBACK = {
  vendor_name: '', amount: 0, currency: 'AED',
  date: new Date().toISOString().split('T')[0],
  category: 'Miscellaneous', business_unit: null,
  payment_method: 'Cash', purpose: '', submitted_by: null,
  line_items: [], notes: null, invoice_number: null
};

// Clean up uploaded files older than 7 days
function cleanOldUploads() {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    files.forEach(f => {
      if (f === '.gitkeep') return;
      const fp = path.join(UPLOADS_DIR, f);
      const stat = fs.statSync(fp);
      if (stat.mtimeMs < cutoff) fs.unlinkSync(fp);
    });
  } catch (_) {}
}

// Run cleanup once a day
setInterval(cleanOldUploads, 24 * 60 * 60 * 1000);

router.post('/', (req, res, next) => {
  upload.single('bill')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (req.file.size === 0) return res.status(400).json({ error: 'Uploaded file is empty' });

    const expenseType = req.body.expense_type || 'general';
    let parsed = { ...FALLBACK };
    let parseError = null;
    try {
      parsed = await parseReceiptFile(req.file.path, req.file.originalname, expenseType);
    } catch (err) {
      console.warn('Claude parse failed:', err.message);
      parseError = err.message;
    }

    res.json({
      image_path: `/uploads/${req.file.filename}`,
      parsed,
      parseError
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
