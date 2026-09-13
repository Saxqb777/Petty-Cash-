// ═══════════════════════════════════════════════════════════════════════════
//  Vercel Blob cleanup
//
//  Receipts are uploaded with `access: 'public'`, so a blob URL stays readable
//  by anyone holding it until the blob is explicitly removed. Deleting the
//  expense row does NOT remove the file, which means a deleted expense (or a
//  wiped organisation) would otherwise leave its receipts live and billable
//  indefinitely.
//
//  On Railway a nightly sweep collected orphaned files. That job cannot exist
//  on serverless, so cleanup has to happen inline at the point of deletion.
// ═══════════════════════════════════════════════════════════════════════════

const { del } = require('@vercel/blob');

/** Only our own Blob URLs are deletable. Guards against legacy relative paths. */
const isBlobUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u);

/**
 * Delete one or more receipts from Blob storage.
 *
 * Best effort by design: the database row is already gone by the time this
 * runs, and the caller asked for a deletion. Failing the request because a
 * storage cleanup failed would leave the user staring at an error for an
 * operation that actually succeeded. Failures are logged so orphans are
 * traceable rather than silent.
 *
 * @param {string|string[]} urls
 */
async function dropReceipts(urls) {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(isBlobUrl);
  if (list.length === 0) return { deleted: 0 };

  try {
    // `del` accepts an array, so a whole org's receipts go in one call rather
    // than one round trip per file.
    await del(list);
    return { deleted: list.length };
  } catch (err) {
    console.warn(`[blob] failed to delete ${list.length} receipt(s):`, err.message);
    return { deleted: 0, error: err.message };
  }
}

module.exports = { dropReceipts };
