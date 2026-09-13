// ═══════════════════════════════════════════════════════════════════════════
//  Express app — built and EXPORTED, never listened on here.
//
//  · api/index.js wraps this as the Vercel serverless handler.
//  · server/dev.js calls .listen(3001) for local development.
//
//  Nothing in this module may: call process.exit, register SIGTERM handlers,
//  start timers/crons, or touch the filesystem for persistence. A serverless
//  invocation is frozen between requests and replaced without warning.
// ═══════════════════════════════════════════════════════════════════════════

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');

// ── Env validation (lazy) ─────────────────────────────────────────────────────
// The old server exited the process when a variable was missing. In a serverless
// handler that kills the function on cold start with an unreadable platform
// error, so instead every request to a route that needs a variable gets a clean
// 500 naming it. DATABASE_URL is checked in server/db/index.js and
// ANTHROPIC_API_KEY in server/utils/parser.js, both on first use.
const REQUIRED_ENV = ['DATABASE_URL', 'ANTHROPIC_API_KEY', 'BLOB_READ_WRITE_TOKEN'];
function missingEnv() {
  return REQUIRED_ENV.filter((k) => !process.env[k]);
}

process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
});

const recordsRouter      = require('./routes/records');
const uploadRouter       = require('./routes/upload');
const exportRouter       = require('./routes/export');
const settingsRouter     = require('./routes/settings');
const savingsRouter      = require('./routes/savings');
const authRouter         = require('./routes/auth');
const membersRouter      = require('./routes/members');
const expenseTypesRouter = require('./routes/expense-types');
const platformRouter     = require('./routes/platform');

const app = express();

// Vercel terminates TLS and proxies to the function — trust one hop so
// req.ip / req.protocol / secure cookies behave.
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));

// ── Cookie parser ─────────────────────────────────────────────────────────────
app.use(cookieParser());

// ── Body limits ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Rate limiting: REMOVED ────────────────────────────────────────────────────
// `express-rate-limit` with its default in-memory store is useless on Vercel —
// every invocation is a fresh isolate with its own empty counter map, so the
// limit is neither shared nor durable and gives a false sense of protection.
// Rate limiting belongs on the platform edge instead: Vercel → Project →
// Firewall → Rate Limiting (or a Redis/Upstash-backed store if it must live in
// the app).

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRouter);
app.use('/api/members',       membersRouter);
app.use('/api/expense-types', expenseTypesRouter);
app.use('/api/platform',      platformRouter);
app.use('/api/records',       recordsRouter);
app.use('/api/upload',        uploadRouter);
app.use('/api/export',        exportRouter);
app.use('/api/settings',      settingsRouter);
app.use('/api/savings',       savingsRouter);

app.get('/api/health', (req, res) => {
  const missing = missingEnv();
  res.json({
    status: missing.length ? 'degraded' : 'ok',
    version: '2.0.0',
    time: new Date().toISOString(),
    ...(missing.length ? { missingEnv: missing } : {}),
  });
});

// ── Serve the built React frontend (local dev only) ───────────────────────────
// On Vercel the static build in client/dist is served by the CDN and never
// reaches this function; the existsSync guard makes this a no-op there.
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Error]', err.message, err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
