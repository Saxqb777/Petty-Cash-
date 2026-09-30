// Join codes. Signing up to an existing organisation used to pick it from a
// public list of every organisation's name, so anyone could read the customer
// list and ask to join any of them. Now an admin shares a code from the
// Members page. The code carries the org id and a signature, so no column or
// migration is needed and a guessed id without the signature is refused.

const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function secret() {
  const s = process.env.JOIN_CODE_SECRET || process.env.DATABASE_URL || '';
  if (!s) throw Object.assign(new Error('JOIN_CODE_SECRET is not set'), { status: 500 });
  return s;
}

function signature(orgId) {
  const mac = crypto.createHmac('sha256', secret()).update(`join:${orgId}`).digest();
  let out = '';
  for (let i = 0; i < 8; i++) out += ALPHABET[mac[i] % ALPHABET.length];
  return out;
}

/** e.g. "12-K7Q2M9XD" */
function joinCodeFor(orgId) {
  return `${Number(orgId)}-${signature(orgId)}`;
}

/** The org id a code opens, or null. */
function orgIdFromJoinCode(code) {
  const m = String(code || '').trim().toUpperCase().match(/^(\d{1,12})-([A-Z2-9]{8})$/);
  if (!m) return null;
  const id = Number(m[1]);
  const expected = signature(id);
  const a = Buffer.from(expected);
  const b = Buffer.from(m[2]);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? id : null;
}

module.exports = { joinCodeFor, orgIdFromJoinCode };
