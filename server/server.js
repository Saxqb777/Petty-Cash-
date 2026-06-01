require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

// Prevent Tesseract worker crashes from killing the whole server
process.on('uncaughtException', (err) => {
  if (err.message && err.message.includes('Error attempting to read image')) {
    console.warn('[OCR] Could not read image — skipping OCR for this file');
  } else {
    console.error('[Uncaught]', err.message);
  }
});

const recordsRouter = require('./routes/records');
const uploadRouter = require('./routes/upload');
const exportRouter = require('./routes/export');
const settingsRouter = require('./routes/settings');
const savingsRouter = require('./routes/savings');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/records', recordsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/export', exportRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/savings', savingsRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`Agthia Petty Cash server running on http://localhost:${PORT}`);
});
