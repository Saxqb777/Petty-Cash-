const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { parseReceiptFile } = require('../utils/parser');
const { UPLOADS_DIR } = require('../config/paths');
const db = require('../db/database');

const router = express.Router();

// SHA-256 of a file on disk — used for content-based duplicate detection
function hashFile(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

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

// Clean up ONLY orphaned uploads (no expense references them) older than 7 days.
// Receipts linked to an expense via image_path are kept FOREVER — for a finance
// app the receipt is the audit trail and must never be auto-deleted.
function cleanOldUploads() {
  let removed = 0;
  try {
    // Build the set of filenames still referenced by any expense.image_path
    const referenced = new Set();
    db.prepare("SELECT image_path FROM expenses WHERE image_path IS NOT NULL AND image_path != ''")
      .all()
      .forEach(r => referenced.add(path.basename(r.image_path)));

    const files = fs.readdirSync(UPLOADS_DIR);
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    files.forEach(f => {
      if (f === '.gitkeep') return;
      if (referenced.has(f)) return;            // linked to a record — never delete
      const fp = path.join(UPLOADS_DIR, f);
      const stat = fs.statSync(fp);
      if (stat.mtimeMs < cutoff) { fs.unlinkSync(fp); removed++; }
    });
  } catch (e) {
    console.warn('[uploads] cleanup error:', e.message);
  }
  return removed;
}

// Run cleanup at startup (log the result) and once a day thereafter
const cleanedAtBoot = cleanOldUploads();
console.log(`[uploads] orphan cleanup at boot: ${cleanedAtBoot} file(s) removed (linked receipts are kept forever)`);
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

    // Content hash for duplicate detection (same bytes = same receipt)
    const file_hash = hashFile(req.file.path);
    const existingByHash = db.prepare(
      'SELECT id, vendor_name, amount, date FROM expenses WHERE file_hash = ?'
    ).get(file_hash);

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
      file_hash,
      duplicate: existingByHash
        ? { type: 'exact', existingId: existingByHash.id, vendor: existingByHash.vendor_name, amount: existingByHash.amount, date: existingByHash.date }
        : null,
      parsed,
      parseError
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
