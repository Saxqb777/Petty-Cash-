// Budget guards for the public demo. Every read in the demo is a real model
// call, so each sample company gets a few and the whole demo gets a daily
// ceiling. Counters live in the demo database only (demo_usage, settings).

const { query, one } = require('../db');

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const READS_PER_COMPANY = () => num(process.env.DEMO_READS_PER_COMPANY, 5);
const READS_PER_DAY = () => num(process.env.DEMO_READS_PER_DAY, 30);
const COMPANIES_PER_DAY = () => num(process.env.DEMO_COMPANIES_PER_DAY, 300);

const today = () => new Date().toISOString().slice(0, 10);

async function readsUsed(orgId) {
  const row = await one("SELECT value FROM settings WHERE key = 'demo_reads' AND org_id = $1", [orgId]);
  return Number(row?.value || 0);
}

async function readsLeft(orgId) {
  return Math.max(0, READS_PER_COMPANY() - (await readsUsed(orgId)));
}

/** Null when the read may go ahead, otherwise the sentence to show the visitor. */
async function takeDemoRead(orgId) {
  if ((await readsUsed(orgId)) >= READS_PER_COMPANY()) {
    return `This demo company has used its ${READS_PER_COMPANY()} reads. Start your free month to read your own documents without a limit.`;
  }
  const day = await one(
    `INSERT INTO demo_usage (day, reads) VALUES ($1, 1)
     ON CONFLICT (day) DO UPDATE SET reads = demo_usage.reads + 1
     RETURNING reads`,
    [today()]
  );
  if (day.reads > READS_PER_DAY()) {
    return 'The demo has read as many documents as it can for today. Try again tomorrow, or start your free month.';
  }
  await query(
    `INSERT INTO settings (key, value, org_id) VALUES ('demo_reads', '1', $1)
     ON CONFLICT (key, org_id) DO UPDATE SET value = ((settings.value)::int + 1)::text`,
    [orgId]
  );
  return null;
}

/** False once the day's sample companies are used up. */
async function takeDemoCompany() {
  const day = await one(
    `INSERT INTO demo_usage (day, companies) VALUES ($1, 1)
     ON CONFLICT (day) DO UPDATE SET companies = demo_usage.companies + 1
     RETURNING companies`,
    [today()]
  );
  return day.companies <= COMPANIES_PER_DAY();
}

module.exports = { takeDemoRead, takeDemoCompany, readsLeft, READS_PER_COMPANY };
