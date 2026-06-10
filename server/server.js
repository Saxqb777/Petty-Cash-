require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { UPLOADS_DIR, DATA_DIR } = require('./config/paths');

// ── Validate required env vars at startup ─────────────────────────────────────
const REQUIRED_ENV = ['ANTHROPIC_API_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`[STARTUP] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[STARTUP] Create a .env file at the project root with these variables.');
  process.exit(1);
}

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

const recordsRouter = require('./routes/records');
const uploadRouter  = require('./routes/upload');
const exportRouter  = require('./routes/export');
const settingsRouter = require('./routes/settings');
const savingsRouter = require('./routes/savings');
const authRouter         = require('./routes/auth');
const membersRouter      = require('./routes/members');
const expenseTypesRouter = require('./routes/expense-types');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Trust Railway's proxy so rate-limit sees real client IPs ──────────────────
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

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
app.use('/api', apiLimiter);

// ── Static files ──────────────────────────────────────────────────────────────
app.use('/uploads', express.static(UPLOADS_DIR));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRouter);
app.use('/api/members',       membersRouter);
app.use('/api/expense-types', expenseTypesRouter);
app.use('/api/records',  recordsRouter);
app.use('/api/upload',   uploadRouter);
app.use('/api/export',   exportRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/savings',  savingsRouter);

app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  version: '1.8.0',
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

// ── Seed owner account from env vars ─────────────────────────────────────────
async function seedOwner() {
  const email = process.env.SEED_OWNER_EMAIL;
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!email || !password) return;

  const db = require('./db/database');
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return; // already seeded

  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash(password, 12);
  const userResult = db.prepare(
    'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)'
  ).run(email.toLowerCase(), hash, 'Owner');

  db.prepare(
    'INSERT OR IGNORE INTO memberships (user_id, org_id, role, status) VALUES (?, 1, ?, ?)'
  ).run(userResult.lastInsertRowid, 'owner', 'active');

  console.log(`[seed] Owner account created: ${email}`);
}

// ── Nightly SQLite backup (keep last 14) ─────────────────────────────────────
function runBackup() {
  try {
    const backupDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().split('T')[0];
    const dest  = path.join(backupDir, `agthia-${stamp}.db`);
    const db = require('./db/database');
    db.backup(dest).then(() => {
      console.log(`[backup] snapshot saved → ${dest}`);
      const backups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('agthia-') && f.endsWith('.db'))
        .sort().reverse();
      backups.slice(14).forEach(old => { try { fs.unlinkSync(path.join(backupDir, old)); } catch (_) {} });
    }).catch(e => console.error('[backup] failed:', e.message));
  } catch (e) {
    console.error('[backup] setup error:', e.message);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Agthia Petty Cash v2.0.0 running on http://localhost:${PORT}`);
  await seedOwner();
  setTimeout(() => { runBackup(); setInterval(runBackup, 24 * 60 * 60 * 1000); }, 60 * 1000);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = (signal) => {
  console.log(`[${signal}] Shutting down gracefully...`);
  server.close(() => { console.log('Server closed.'); process.exit(0); });
  setTimeout(() => { console.error('Forced shutdown.'); process.exit(1); }, 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
