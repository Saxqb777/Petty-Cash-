require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// ── Validate required env vars at startup ─────────────────────────────────────
const REQUIRED_ENV = ['ANTHROPIC_API_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`[STARTUP] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[STARTUP] Create a .env file at the project root with these variables.');
  process.exit(1);
}

// ── Prevent Tesseract crashes from killing the server ─────────────────────────
process.on('uncaughtException', (err) => {
  if (err.message && err.message.includes('Error attempting to read image')) {
    console.warn('[OCR] Could not read image — skipping');
  } else {
    console.error('[Uncaught]', err.message, err.stack);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
});

const recordsRouter  = require('./routes/records');
const uploadRouter   = require('./routes/upload');
const exportRouter   = require('./routes/export');
const settingsRouter = require('./routes/settings');
const savingsRouter  = require('./routes/savings');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // React app needs inline scripts
  crossOriginEmbedderPolicy: false,
}));

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors());

// ── Body limits ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

app.use('/api', apiLimiter);

// ── Static files ──────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/records',  recordsRouter);
app.use('/api/upload',   uploadRouter);
app.use('/api/export',   exportRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/savings',  savingsRouter);

app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  version: '1.4.0',
  time: new Date().toISOString(),
  uptime: Math.floor(process.uptime()) + 's',
}));

// ── Serve built React frontend ────────────────────────────────────────────────
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message, err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Agthia Petty Cash v1.4.0 running on http://localhost:${PORT}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = (signal) => {
  console.log(`[${signal}] Shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  setTimeout(() => { console.error('Forced shutdown.'); process.exit(1); }, 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
