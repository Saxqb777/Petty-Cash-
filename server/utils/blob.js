// ═══════════════════════════════════════════════════════════════════════════
//  Vercel Blob: private receipts
//
//  Receipts are uploaded to a PRIVATE store, so a blob URL is not fetchable on
//  its own. Reading one requires a short-lived signed URL, which is only ever
//  issued through GET /api/records/:id/receipt, behind requireAuth and scoped
//  to the caller's organisation. A receipt link is therefore useless to anyone
//  without a session in the org that owns the expense.
//
//  Cleanup has to happen inline at the point of deletion: the nightly sweep
//  that used to collect orphaned files cannot exist on serverless, and without
//  a replacement a deleted expense would leave its receipt billable forever.
// ═══════════════════════════════════════════════════════════════════════════

const { del, issueSignedToken, presignUrl } = require('@vercel/blob');

/** How long a receipt link stays valid. Long enough to open, short enough that
 *  a copied URL is not a lasting credential. */
const LINK_TTL_MS = 5 * 60 * 1000;

const isUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);

/**
 * Store pathname for a stored receipt reference.
 *
 * `expenses.image_path` holds the blob pathname (e.g. `org-2/abc.jpg`). Rows
 * written while the store was public hold a full URL instead, so both are
 * accepted and normalised to the pathname the Blob API expects.
 */
function toPathname(ref) {
  if (typeof ref !== 'string' || !ref.trim()) return null;
  if (!isUrl(ref)) return ref.replace(/^\/+/, '');
  try {
    return decodeURIComponent(new URL(ref).pathname).replace(/^\/+/, '');
  } catch (_) {
    return null;
  }
}

/**
 * A signed, expiring URL that will actually load the receipt, or null when
 * there is nothing to sign. Callers must have already established that the
 * requester is allowed to see this expense.
 */
async function presignReceipt(ref, ttlMs = LINK_TTL_MS) {
  const pathname = toPathname(ref);
  if (!pathname) return null;

  const validUntil = Date.now() + ttlMs;
  const token = await issueSignedToken({
    pathname,
    operations: ['get'],
    validUntil,
  });
  const { presignedUrl } = await presignUrl(token, {
    operation: 'get',
    pathname,
    access: 'private',
    validUntil,
  });
  return presignedUrl;
}

/**
 * Delete one or more receipts from the store.
 *
 * Best effort by design: the database row is already gone by the time this
 * runs and the caller asked for a deletion, so failing the request because a
 * storage cleanup failed would report an error for an operation that actually
 * succeeded. Failures are logged so orphans stay traceable rather than silent.
 *
 * @param {string|string[]} refs pathnames or URLs
 */
async function dropReceipts(refs) {
  const list = (Array.isArray(refs) ? refs : [refs])
    .map(toPathname)
    .filter(Boolean);
  if (list.length === 0) return { deleted: 0 };

  try {
    // `del` takes an array, so a whole org's receipts go in one call rather
    // than one round trip per file.
    await del(list);
    return { deleted: list.length };
  } catch (err) {
    console.warn(`[blob] failed to delete ${list.length} receipt(s):`, err.message);
    return { deleted: 0, error: err.message };
  }
}

module.exports = { dropReceipts, presignReceipt, toPathname, LINK_TTL_MS };
