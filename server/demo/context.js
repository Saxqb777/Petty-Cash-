// ═══════════════════════════════════════════════════════════════════════════
//  Demo mode
//
//  demo.docledger.site is served by the same deployment as the real app. A
//  request that arrives on a demo host runs inside an AsyncLocalStorage scope
//  marked { demo: true }, and server/db/index.js then connects to
//  DEMO_DATABASE_URL instead of DATABASE_URL. The demo database is a separate
//  Neon project that only ever holds sample companies, so a visitor can never
//  reach a real customer's rows, even through a bug in a route.
//
//  There is no fallback: a demo request with DEMO_DATABASE_URL unset fails with
//  a 500 rather than touching the real database.
// ═══════════════════════════════════════════════════════════════════════════

const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

const DEFAULT_DEMO_HOSTS = ['demo.docledger.site', 'demo-preview.docledger.site'];

function demoHosts() {
  const raw = process.env.DEMO_HOSTS || DEFAULT_DEMO_HOSTS.join(',');
  return raw.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
}

function isDemoHost(host) {
  if (process.env.DEMO_FORCE === '1') return true;
  const h = String(host || '').toLowerCase().split(':')[0];
  return demoHosts().includes(h);
}

/** True inside a request that arrived on a demo host. */
function isDemo() {
  return als.getStore()?.demo === true;
}

/** Express middleware: marks the rest of the request as demo or real. */
function demoScope(req, res, next) {
  const demo = isDemoHost(req.hostname);
  req.isDemo = demo;
  als.run({ demo }, next);
}

module.exports = { isDemo, isDemoHost, demoScope };
