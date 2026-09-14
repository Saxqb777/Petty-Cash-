const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { put } = require('@vercel/blob');
const { parseReceiptBuffer } = require('../utils/parser');
const { one } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Serverless functions have no writable disk worth using and the file has to be
// in memory anyway (hashing, Claude extraction, blob upload), so multer keeps
// the whole 15 MB in a Buffer.
const ALLOWED_EXT = /\.(jpe?g|png|webp|pdf)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_EXT.test(file.originalname || '')) cb(null, true);
    else cb(new Error('Only images (JPG, PNG, WebP) and PDFs are supported'));
  },
});

const FALLBACK = {
  vendor_name: '', amount: 0, currency: 'AED',
  date: new Date().toISOString().split('T')[0],
  category: 'Miscellaneous', business_unit: null,
  payment_method: 'Cash', purpose: '', submitted_by: null,
  line_items: [], notes: null, invoice_number: null,
};

// NOTE: there is no upload-cleanup job any more. Receipts live in Vercel Blob
// and are the audit trail for a finance app — they are kept for the life of the
// record. (The old 7-day orphan sweep only ever deleted unreferenced files; on
// Blob those are rare enough to prune manually.)

router.post(
  '/',
  (req, res, next) => {
    upload.single('bill')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const buffer = req.file.buffer;
      if (!buffer || buffer.length === 0) return res.status(400).json({ error: 'Uploaded file is empty' });

      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN is not set — receipt storage is unavailable.' });
      }

      const orgId = req.user.org_id;
      const expenseType = req.body.expense_type || 'general';

      // Look up the custom type schema if this is a non-builtin type
      let customSchema = null;
      let customAiHints = null;
      const typeRow = await one(
        'SELECT * FROM expense_types WHERE org_id = $1 AND slug = $2 AND is_archived = FALSE',
        [orgId, expenseType]
      );
      if (typeRow && !typeRow.is_builtin) {
        try {
          customSchema = JSON.parse(typeRow.fields_schema || '[]');
          customAiHints = typeRow.ai_hints;
        } catch (_) { /* fall back to the built-in prompt */ }
      }

      // Content hash for duplicate detection (same bytes = same receipt)
      const file_hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const existingByHash = await one(
        'SELECT id, vendor_name, amount, date FROM expenses WHERE file_hash = $1 AND org_id = $2',
        [file_hash, orgId]
      );

      // Tenant-scoped pathname so orgs can never collide on a filename.
      const ext = (path.extname(req.file.originalname || '') || '.bin').toLowerCase();
      // Private: a receipt URL is not fetchable on its own. Reading one goes
      // through GET /api/records/:id/receipt, which checks the session and the
      // caller's organisation before issuing a short-lived signed link.
      const blob = await put(`org-${orgId}/${crypto.randomUUID()}${ext}`, buffer, {
        access: 'private',
        contentType: req.file.mimetype || undefined,
        addRandomSuffix: false,
      });

      let parsed = { ...FALLBACK };
      let parseError = null;
      try {
        parsed = await parseReceiptBuffer(buffer, req.file.originalname, expenseType, customSchema, customAiHints);
      } catch (err) {
        console.warn('Claude parse failed:', err.message);
        parseError = err.message;
      }

      res.json({
        // The pathname, not the URL: a private blob has to be presigned to be
        // read, and presigning takes a pathname.
        image_path: blob.pathname,
        file_hash,
        duplicate: existingByHash
          ? {
              type: 'exact',
              existingId: existingByHash.id,
              vendor: existingByHash.vendor_name,
              amount: existingByHash.amount,
              date: existingByHash.date,
            }
          : null,
        parsed,
        parseError,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(error.status || 500).json({ error: error.message });
    }
  }
);

module.exports = router;
