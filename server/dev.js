// Local development entry point. Production on Vercel goes through api/index.js,
// which imports the same app without ever calling .listen().
require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3001;

const missing = ['DATABASE_URL', 'ANTHROPIC_API_KEY', 'BLOB_READ_WRITE_TOKEN']
  .filter((k) => !process.env[k]);
if (missing.length) {
  console.warn(`[dev] Missing env vars: ${missing.join(', ')} — the matching routes will return 500.`);
  console.warn('[dev] Copy .env.example to .env and fill it in.');
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Doc Ledger API listening on http://localhost:${PORT}`);
});

const shutdown = (signal) => {
  console.log(`[${signal}] shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
