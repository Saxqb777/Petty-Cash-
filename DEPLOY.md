# Deploying Doc Ledger

First-time setup on Vercel + Neon + Vercel Blob. Roughly 15 minutes.

The app was previously on Railway with SQLite on a persistent volume. None of that carries over: Vercel has no persistent disk, so the database is Neon and the receipts are Vercel Blob. **The database starts empty by design.**

---

## 1. Create the Neon database

Either through Vercel (Storage → Create → Neon, which links it and sets `DATABASE_URL` for you) or directly at neon.tech and paste the string in later.

**Take the pooled connection string** — the host contains `-pooler`:

```
postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

The direct (non-pooled) string will exhaust connections once more than a handful of function invocations run at once. This matters here because `withTransaction` opens a real connection.

## 2. Create the Blob store, then connect it

Vercel → Storage → Create → Blob.

**Creating the store is not enough.** It has to be connected to the project as a separate action, and only that connection injects `BLOB_READ_WRITE_TOKEN`:

Project → **Storage** → **Connect Store** → pick the Blob store → Connect.

**Then redeploy.** Environment variables are injected at build time, so a deployment that already exists never picks up a variable added after it was built. Connecting the store to a live project changes nothing until the next build.

The symptom when either step is missed is identical and misleading: `/api/health` reports `BLOB_READ_WRITE_TOKEN` missing while the Vercel dashboard shows the store sitting there, apparently fine.

## 3. Import the repo into Vercel

New Project → import `Saxqb777/Petty-Cash-` → branch `claude/stoic-bell-sZZ57`.

Leave the build settings alone. `vercel.json` already declares the build command, the output directory (`client/dist`), the API rewrite and the SPA fallback. Overriding them in the dashboard will break routing.

## 4. Set environment variables

Vercel → Project → Settings → Environment Variables. All three are required; set them for Production **and** Preview or preview deploys will 500.

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (step 1) |
| `BLOB_READ_WRITE_TOKEN` | Blob store (step 2) |
| `ANTHROPIC_API_KEY` | console.anthropic.com |

Optional, and only read during seeding:

| Variable | Effect |
|---|---|
| `SEED_OWNER_EMAIL` | Creates one owner account for org 1 |
| `SEED_OWNER_PASSWORD` | Its password. Use something long. |

If you skip the seed owner, sign up through the UI instead and the first account becomes the owner of the org it creates.

## 5. Create the schema — do not skip this

Nothing creates tables automatically. DDL on every cold start is exactly the kind of thing that misbehaves on serverless, so it is a deliberate one-off:

```bash
git clone https://github.com/Saxqb777/Petty-Cash- && cd Petty-Cash-
git checkout claude/stoic-bell-sZZ57
npm install
echo 'DATABASE_URL=<your pooled neon string>' > .env
npm run db:migrate
```

Expected output:

```
[migrate] schema applied.
[seed] done — org 1, exchange rates, built-in expense types.
```

Re-running it is safe. Every statement is `CREATE ... IF NOT EXISTS` and the seed is `ON CONFLICT DO NOTHING`.

Run this again after any change to `server/db/schema.sql`.

## 6. Deploy and check health

Push or hit Redeploy, then:

```
https://<your-app>.vercel.app/api/health
```

`{"status":"ok"}` means all three variables are present. `{"status":"degraded","missingEnv":[...]}` names exactly what is missing — the app reports this rather than crashing, because a cold-start crash on Vercel produces an unreadable platform error.

---

## Verify it actually works

Health only proves the variables exist. Walk these in order; each depends on the one before.

1. **Sign up** at `/signup`, create an organisation. You should land on the dashboard, not back at the login page.
2. **Settings** — the exchange rates should already be populated. That confirms the seed ran and per-org settings resolve.
3. **Add Expense** — pick a type, upload a real receipt photo. Confirms Blob writes and the Claude extraction round trip. This is the slowest path; the function is allowed 60 seconds.
4. **Save it**, then check Records. Confirms the write path and AED conversion.
5. **Upload the same file again.** It should be rejected as a duplicate. This is the check that was silently broken before — `file_hash` was never sent from the client, so tier-1 detection could never fire.
6. **Export** from Records. Confirms ExcelJS runs inside the function without hitting the response size limit.
7. **Delete an expense**, then open its old receipt URL. It should now 404. Confirms blob cleanup.
8. **Members** — invite or approve. Confirms the membership flow.
9. **Platform** (only visible to the superadmin account) — confirms cross-tenant queries.

---

## Known gaps to close after first deploy

**No rate limiting.** `express-rate-limit` was removed because an in-memory counter on a per-invocation isolate protects nothing. Configure it at Vercel → Project → Firewall → Rate Limiting.

**No committed lockfile.** The old `package-lock.json` pinned `better-sqlite3` and `tesseract.js` and would have failed `npm ci` against the new `package.json`, so it was removed rather than left to rot. Builds currently resolve fresh. To restore reproducibility:

```bash
npm install
git add package-lock.json && git commit -m "Restore lockfile"
```

**Receipts are world-readable by URL.** Uploads use `access: 'public'`, so anyone with a receipt's URL can open it without logging in. The URLs are unguessable and this matches the old Railway behaviour, where `/uploads` was served by `express.static` with no auth either. If that is not acceptable for your paperwork, switch to private blobs with signed URLs.

---

## Rolling back

Railway still has the old app and its data. Keep it running until every check above passes. Nothing in this migration touches it.

Once you are satisfied, tear Railway down — the volume is the only copy of the old expense data, so export anything you want to keep first. You have said you do not need it, so this is a note for the record rather than a step.
