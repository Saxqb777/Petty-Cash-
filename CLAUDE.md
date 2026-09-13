# Doc Ledger — Project Brief

## What This Is

A multi-tenant web app for recording and reporting petty cash expenses. Staff upload a photo or PDF of a receipt, Claude extracts the fields, a person reviews and saves. Finance then exports branded Excel reports and tracks freight clearance savings.

Every organisation is an isolated tenant. All data is scoped by `org_id`; a single platform owner (`users.is_superadmin`) can see and manage across tenants.

**Deployed on Vercel.** Postgres on Neon, receipts in Vercel Blob. Branch `claude/stoic-bell-sZZ57` auto-deploys.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + Tailwind + Framer Motion + Recharts |
| Backend | Express, exported as a Vercel serverless function |
| Database | Neon Postgres via `@neondatabase/serverless` |
| File storage | Vercel Blob |
| AI | Claude API (`claude-sonnet-4-6`) — vision for images, document API for PDFs |
| Export | ExcelJS (4-sheet workbooks) |

---

## Serverless constraints — read before touching the server

The app runs as a function invocation, not a long-lived process. `server/app.js` builds and **exports** the Express app; it never calls `.listen()`. Consequences that have already bitten this codebase once:

- **No `process.exit`.** Missing env vars are surfaced as a clean 500 at first use, not a fatal at startup, because exiting on cold start produces an unreadable platform error.
- **No crons or timers.** The nightly backup and the 7-day upload sweep are gone. Neon has point-in-time recovery; blob cleanup must happen inline on delete.
- **No SIGTERM handlers**, no graceful shutdown.
- **No local filesystem for persistence.** Uploads go straight to Blob from memory.
- **No in-memory state between requests.** This is why `express-rate-limit` was removed: every invocation is a fresh isolate with its own empty counter map, so the limit was neither shared nor durable. Rate limiting belongs on Vercel → Firewall.
- **No DDL at request time.** Schema is applied by `npm run db:migrate`, explicitly, never on cold start.

`server/dev.js` wraps the same app in a real listener for local work.

---

## Project Structure

```
Petty-Cash-/
├── CLAUDE.md
├── vercel.json                  ← build, function config, SPA rewrites
├── api/index.js                 ← Vercel entry; exports the Express app
├── server/
│   ├── app.js                   ← builds + exports the app (never listens)
│   ├── dev.js                   ← local listener
│   ├── db/
│   │   ├── index.js             ← Neon client, transactions, type parsers
│   │   ├── schema.sql           ← idempotent Postgres DDL
│   │   ├── migrate.js           ← npm run db:migrate
│   │   └── seed.js              ← org 1, built-in expense types, owner
│   ├── middleware/auth.js       ← cookie sessions, requireAuth, requireSuperadmin
│   ├── routes/                  ← records, upload, export, settings, savings,
│   │                              auth, members, expense-types, platform
│   └── utils/
│       ├── parser.js            ← Claude extraction
│       └── money.js             ← integer-fils arithmetic
└── client/
    ├── tailwind.config.js       ← Overprint tokens
    └── src/
        ├── index.css            ← component layer + contrast table
        ├── components/
        └── pages/
```

---

## Postgres conventions

These are deliberate. Changing them will break things in non-obvious ways.

- **`date` columns stay `TEXT`** in `YYYY-MM-DD` form. They are compared and grouped as text and handed to the client verbatim. Making them `DATE` returns JS `Date` objects and introduces timezone drift in reports.
- **JSON blobs stay `TEXT`** with explicit `JSON.parse`/`stringify` (`line_items`, `bl_numbers`, `container_numbers`, `custom_fields`, `fields_schema`). `JSONB` looks tempting but node-postgres serializes JS arrays to Postgres *array literals* rather than JSON, and `settings.value` stores bare strings too.
- **Money is `DOUBLE PRECISION`.** `NUMERIC` is more correct but node-postgres returns it as a *string*, which breaks every consumer. Arithmetic is done in integer fils in `utils/money.js`.
- **`int8` and `numeric` are parsed back to JS numbers** once, globally, in `db/index.js`. Without that, every `BIGSERIAL` id and `COUNT(*)` reaches the client quoted.
- **Email uniqueness is a functional index on `LOWER(email)`.** SQLite's `COLLATE NOCASE` has no Postgres equivalent without CITEXT, so every read and write lowercases first. Unique violations are `err.code === '23505'`, not a string match.
- **Route params go through `toId()`.** Postgres raises on `id = 'abc'` where SQLite silently matched nothing, so junk ids must 404 rather than 500.

---

## Core Concepts

**Expense types** — three built in (`general`, `adnoc` fuel, `shipping` freight), plus per-org custom types with a user-defined field schema and AI extraction hints.

**Multi-currency** — amounts stored as entered, with `amount_aed` computed at save time from the org's configured rates. Historical records do **not** re-convert when rates change. This is intentional for accounting correctness.

**Clearance savings** — a shipping expense can auto-create a `clearance_savings` row tracking `old_fee` minus `new_fee`. Surfaced on the Savings page and Excel sheet 4.

**Duplicate detection, three tiers** — (1) exact file SHA-256 → hard reject; (2) invoice + vendor + date + amount → hard reject; (3) no invoice, same vendor + date + amount → soft warning with a 201.

---

## Design System: Overprint

Two-ink risograph logic. Flat spot colours that multiply where they cross, hard rectangles, no shadow anywhere.

- **Inks:** paper `#EDECE8`, federal blue `#22356F` (primary), flare orange `#FF4A17` (attention, destructive), riso green `#00A95C` (resolved, saved, used sparingly). "Waiting" is deliberately **uncoloured** — an ink outline on paper.
- **Type:** Archivo (width axis; `.w-wide` / `.w-wider` utilities) and Fragment Mono for all numbers, dates and IDs. Fragment Mono is single-weight — never bold it.
- **Geometry:** `borderRadius` and `boxShadow` are *overridden* in the Tailwind config, not extended, so a stray `rounded-lg` or `shadow-md` cannot reintroduce the old look. Structural borders are `border-2 border-ink-900`; row dividers are `border-paper-300`.
- **Motion:** 120ms ease-out, opacity and 4px translate. No spring, no bounce, no scale on press.

### Contrast rules — measured, and the obvious choices fail

The full table lives at the top of `client/src/index.css`. The two that catch people:

- **White on `flare-500` is 3.4:1 and fails.** Text on flare and green fills is `ink-900`.
- **Flare and green as *text* on paper must use the `-700` steps** (`flare-500` on paper is only 2.7:1).

`ink-500` is the floor for secondary text, `ink-400` for meta, `ink-300` is placeholders and large text only, `ink-200` is never text. Minimum readable size is 13px; 10-11px is reserved for tracked uppercase labels.

---

## Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Neon pooled connection string |
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob store |
| `ANTHROPIC_API_KEY` | Yes | Receipt extraction |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` | No | Creates one owner for org 1 on seed |

---

## Commands

```bash
npm run install:all
npm run dev            # server :3001 + client :5173
npm run db:migrate     # apply schema.sql, then seed. Run once against Neon.
npm run db:seed        # seed only
npm run build          # build the client
```

---

## Known gaps

- **Blobs are never deleted.** `put` is used; `del` is not. Deleting an expense or wiping an org leaves the receipts in storage indefinitely. Receipts are uploaded `access: 'public'`, so anyone with the URL can read one. This matches the old Railway behaviour (`express.static` on `/uploads`, also unauthenticated) but the missing cleanup makes retention worse.
- **No rate limiting** until it is configured at Vercel → Firewall.
- **`package-lock.json` is not committed.** Run `npm install` and commit the result to restore reproducible builds.
- **Records header and Savings footer totals** sum only the loaded page, not the full result set, while displaying the full server count beside them.
- **Soft duplicate warnings** (tier 3) are returned by the API but not surfaced anywhere in the upload UI.
- Neon's own transport, Vercel Blob `put()`, and the full frontend integration have not been exercised against real infrastructure yet. The Postgres conversion was verified against PGlite, which is real Postgres but not Neon.
