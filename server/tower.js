// The Tower (Doc Ledger's sales floor) hears what happens to a company it brought here: the demo it opened,
// the document it read there, the free month it started, the card it added. Every message is signed with
// DEMO_EVENT_KEY (the same value on both Vercel projects) and never blocks the request that caused it.
const TOWER_URL = (process.env.TOWER_URL || 'https://the-tower-saxqb777s-projects.vercel.app').replace(/\/$/, '');

function towerKey() {
  return process.env.DEMO_EVENT_KEY || '';
}

async function towerNotify(code, payload) {
  const key = towerKey();
  if (!key || !/^[a-z0-9]{4,12}$/.test(String(code || ''))) return false;
  try {
    const r = await fetch(`${TOWER_URL}/api/public/preview/${code}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tower-key': key },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    return r.ok;
  } catch (err) {
    console.warn('[tower notify]', payload && payload.kind, err.message);
    return false;
  }
}

// The Tower asks this app for a company's usage with the same key.
function towerKeyOk(req) {
  const key = towerKey();
  const given = req.get('x-tower-key') || '';
  if (!key || given.length !== key.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= given.charCodeAt(i) ^ key.charCodeAt(i);
  return diff === 0;
}

module.exports = { TOWER_URL, towerNotify, towerKeyOk };
