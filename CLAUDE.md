# Agthia Petty Cash — Project Brief

## What This Is

A production web app for **Agthia Group (UAE)** to record, track, and manage petty cash expenses. It replaces manual Excel/paper systems. Employees upload a photo or PDF of a receipt → Claude AI auto-fills all fields → the record is saved. Finance can then export polished Excel reports and track freight cost savings.

**Live on Railway** at `helpful-freedom` project, Singapore region, with a persistent volume at `/data` (mount path) so the SQLite database and uploaded files survive redeployments.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + Tailwind CSS + Framer Motion + Recharts |
| Backend | Node.js + Express |
| Database | SQLite via better-sqlite3 (WAL mode) |
| AI | Claude API (`claude-sonnet-4-6`) — vision for images, document API for PDFs |
| Export | ExcelJS (4-sheet branded workbooks) |
| Hosting | Railway (auto-deploys from `claude/stoic-bell-sZZ57` branch) |

---

## Project Structure

```
Petty-Cash-/
├── CLAUDE.md                        ← you are here
├── .env                             ← ANTHROPIC_API_KEY (not committed)
├── railway.json
├── package.json                     ← root scripts (dev, build, start)
├── data/
│   ├── agthia.db                    ← SQLite database (persistent volume on Railway)
│   └── uploads/                     ← uploaded receipt images
├── server/
│   ├── server.js                    ← Express entry point
│   ├── config/paths.js              ← resolves DATA_DIR / DB_PATH / UPLOADS_DIR
│   ├── db/database.js               ← schema, migrations, indexes
│   └── routes/
│       ├── records.js               ← CRUD + dashboard stats
│       ├── upload.js                ← file upload + AI parsing trigger
│       ├── export.js                ← Excel report generation
│       ├── settings.js              ← exchange rates config
│       └── savings.js               ← freight savings tracker
│   └── utils/
│       └── parser.js                ← Claude API integration (core extraction logic)
└── client/
    ├── tailwind.config.js           ← Agthia sage-green brand palette
    └── src/
        ├── App.jsx                  ← router, ErrorBoundary, ToastProvider
        ├── components/
        │   ├── Sidebar.jsx          ← nav (Dashboard, Add Expense, Records, Savings, Settings)
        │   ├── Toast.jsx            ← global toast context (success/error/info)
        │   ├── ErrorBoundary.jsx    ← crash fallback
        │   └── ConfirmDialog.jsx    ← replaces native confirm()
        └── pages/
            ├── DashboardPage.jsx    ← KPIs, charts, recent transactions
            ├── UploadPage.jsx       ← upload + AI extraction + review form
            ├── RecordsPage.jsx      ← sortable/filterable expense table
            ├── SavingsPage.jsx      ← freight savings dashboard
            └── SettingsPage.jsx     ← exchange rate config
```

---

## Core Concepts

### Three Expense Types

| Type | Fields | Use case |
|------|--------|----------|
| `general` | Standard petty cash fields | Office supplies, meals, misc |
| `adnoc` | + fuel type, litres, odometer, plate | ADNOC/ENOC fuel receipts |
| `shipping` | + BL numbers, container numbers, port, line items, clearance savings | Freight & customs bills |

### Multi-Currency
All amounts stored as-is in `amount` + `currency`. A computed `amount_aed` column stores the AED equivalent using exchange rates from the `settings` table. Exchange rates are user-configurable in Settings.

### Clearance Savings
When a shipping expense is saved, the system can auto-create a `clearance_savings` record tracking:
- `old_fee` (previous clearing agent cost)
- `new_fee` (current cost)
- `savings` = old − new

This is surfaced on the Savings page and in the Excel export Sheet 4.

---

## Database Schema

### `expenses`
```
id, invoice_number, vendor_name, amount, currency, amount_aed, exchange_rate,
date, category, business_unit, payment_method, purpose, submitted_by,
expense_type, line_items (JSON), notes, image_path,
bl_number, bl_numbers (JSON), container_number, container_numbers (JSON),
port, shipment_type, created_at
```

### `clearance_savings`
```
id, expense_id (FK), date, month, business_unit, port, reference_number,
import_export, previous_agent, current_agent, old_fee, new_fee, savings,
project_name, description, created_at
```

### `settings`
```
key, value   ← stores JSON blob for exchange_rates
```

---

## AI Extraction (parser.js)

- Model: `claude-sonnet-4-6`, `temperature: 0`, `max_tokens: 8192`
- SDK retry: `maxRetries: 4, timeout: 90_000`
- Prompt caching: static system prompt sent with `cache_control: { type: 'ephemeral' }`
- Images → base64 encoded as `image` media type
- PDFs → base64 encoded as `document` media type (Claude document API)
- Three separate prompt builders: `buildGeneralPrompt`, `buildShippingPrompt`, `buildAdnocPrompt`
- Falls back to a safe defaults object if extraction fails — never crashes the upload

---

## Design System

- **Brand colour:** Agthia sage-green `#62833A` (Tailwind alias `brand-600`)
- **Font:** DM Sans (headings), Inter (body)
- **Logo:** Circular leaf badge + lowercase "agthia" wordmark + "Petty Cash" subtitle
- **Dark theme:** Background `#0d1117`, cards `slate-800/900`, borders `white/[0.06]`
- **Version:** v1.8.0 (shown in sidebar footer)

---

## Data Persistence (Railway)

`server/config/paths.js` resolves storage location in this order:
1. `DATA_DIR` env var
2. `RAILWAY_VOLUME_MOUNT_PATH` (set automatically when a Railway Volume is attached)
3. Fallback: `./data/` inside the repo (ephemeral — data lost on redeploy)

**Volume is attached** at `/data`, Singapore region — database and uploads are persistent.

Boot log confirms: `[storage] data dir: /data  (persistent volume: YES)`

---

## Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `ANTHROPIC_API_KEY` | Yes | Server exits on startup if missing |
| `PORT` | No | Defaults to 3001 |
| `RAILWAY_VOLUME_MOUNT_PATH` | No | Set automatically by Railway when volume is attached |
| `DATA_DIR` | No | Override storage path manually |

---

## Dev Commands

```bash
npm run dev        # runs server (nodemon :3001) + client (vite :5173) concurrently
npm run build      # builds React into client/dist
npm start          # production: serves built client + API from :3001
```

---

## Railway Deployment

- Branch `claude/stoic-bell-sZZ57` → auto-deploys to production on push
- Volume: `petty-cash--volume` mounted at `/data`, Southeast Asia (Singapore)
- Volume size: 500 MB (actual usage will be <10 MB for years)
- On each deploy: container is replaced, but `/data` volume persists

---

## Key Business Rules

- **Duplicate detection:** Same invoice number + vendor + date + amount → rejected
- **Cascade delete:** Deleting an expense also removes its linked `clearance_savings` row
- **7-day upload cleanup:** Files in `/data/uploads` older than 7 days are auto-deleted
- **Rate limit:** 500 requests per 15 minutes per IP (no separate upload limit)
- **File size limit:** 15 MB per upload
- **Accepted file types:** JPG, PNG, WebP, PDF

---

## Excel Export (export.js)

Four sheets, Agthia sage-green palette, frozen headers, auto-filter:

1. **Summary** — KPIs (total spend, count, avg), breakdowns by category / type / business unit
2. **All Expenses** — one row per expense, 19 columns including exchange rate and port info
3. **Shipping Details** — line-item charge breakdown grouped per bill
4. **Savings Report** — monthly freight savings with net-savings box (gross savings − fuel cost)

---

## What's Been Built (history)

- Production hardening: Helmet, compression, rate limiting, graceful shutdown, env validation
- Global Toast system, ErrorBoundary, ConfirmDialog (replaces native `confirm()`)
- Sortable columns on Records table
- Agthia brand design: sage-green palette, circular leaf logo, dark theme
- Railway persistent volume fix (the critical data-loss fix)
- Excel export full rewrite with 4 sheets and brand styling
- Claude extraction improvements: temperature=0, prompt caching, SDK retry, PDF support

## Pending / Discussed (not yet built)

- Bulk upload (Excel template import + PDF dropzone) — design discussed, not started
