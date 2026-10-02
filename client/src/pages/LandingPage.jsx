import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BOOKING_URL, CONTACT_EMAIL, DEMO_URL, TOWER_URL } from '../lib/site';

// A recording link becomes an embed: YouTube (watch, youtu.be, shorts) or Loom. Anything else is a plain link.
function embedFor(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'loom.com') return url.replace('/share/', '/embed/');
  } catch (_) {
    return null;
  }
  return null;
}

// Proof (D081): what a real customer said and one minute of the product, both pasted by the founder in The Tower.
function Proof() {
  const [proof, setProof] = useState(null);
  useEffect(() => {
    fetch(`${TOWER_URL}/api/public/proof`, { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? r.json() : null))
      .then(setProof)
      .catch(() => {});
  }, []);
  if (!proof || (!proof.quote && !proof.video)) return null;
  const embed = proof.video ? embedFor(proof.video) : null;
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-20 grid lg:grid-cols-12 gap-10 items-center">
      {proof.quote ? (
        <div className={proof.video ? 'lg:col-span-5' : 'lg:col-span-8'}>
          <p className="label">From a finance team that uses it</p>
          <blockquote className="mt-4">
            <p className="display text-2xl sm:text-3xl text-ink-900 leading-snug">“{proof.quote.text}”</p>
            {proof.quote.by ? <footer className="meta mt-4">{proof.quote.by}</footer> : null}
          </blockquote>
        </div>
      ) : null}
      {proof.video ? (
        <div className={proof.quote ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <p className="label mb-3">One minute, one real bill</p>
          {embed ? (
            <div className="relative border-2 border-ink-900 bg-ink-900" style={{ aspectRatio: '16 / 9' }}>
              <iframe title="Doc Ledger in one minute" src={embed} className="absolute inset-0 w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
            </div>
          ) : (
            <a href={proof.video} className="btn-ghost" target="_blank" rel="noreferrer">Watch the recording</a>
          )}
        </div>
      ) : null}
    </section>
  );
}

// docledger.site for anyone signed out. Built from the app's own Overprint
// plates and real screens of the product, so the page looks like the thing it
// sells. Copy rules: plain words, no dashes, nothing the product cannot do.

const KNOWN = [
  {
    name: 'Shipping line bill',
    note: 'Debit notes, freight invoices, clearance statements',
    rows: [
      ['B/L', 'GCCL2409118735'],
      ['Containers', 'GCLU4418203, GCLU4418219'],
      ['Port', 'DXB, import'],
      ['THC', '1,120.00'],
      ['Delivery order', '450.00'],
      ['Documentation', '250.00'],
      ['Customs clearance', '350.00'],
    ],
  },
  {
    name: 'Fuel receipt',
    note: 'Any station, card or cash',
    rows: [
      ['Fuel', 'Diesel'],
      ['Litres', '81.40'],
      ['Odometer', '148,220'],
      ['Plate', 'DUBAI N 48213'],
      ['Amount', 'AED 262.80'],
    ],
  },
  {
    name: 'Petty cash',
    note: 'Parking, printing, stationery, food, travel',
    rows: [
      ['Vendor', 'Blue Pen Stationery'],
      ['Amount', 'AED 212.50'],
      ['Category', 'Office supplies'],
      ['Paid', 'Cash'],
      ['Currency', 'Any, at the day’s rate'],
    ],
  },
];

const STEPS = [
  ['01', 'Snap', 'Staff photograph the bill on their phone, or drop in the PDF the agent emailed.'],
  ['02', 'Check', 'Doc Ledger fills in every field. A person checks them against the photo and saves. Anything it was unsure of is flagged.'],
  ['03', 'Close', 'Finance filters the month, looks at anything flagged and exports the workbook. Nobody retypes a thing.'],
];

const QUESTIONS = [
  ['How long does setup take?', 'Usually one call. We set up your document types with you, and your team starts photographing the same day.'],
  ['What does it cost?', 'The first month is free. After that the price depends on how many documents you run through it, and we agree it with you before the month ends.'],
  ['Our paperwork looks nothing like this.', 'That is what document types are for. Tell us what lands on your desk and Doc Ledger is shaped to it. If something is missing, we build it for you.'],
  ['Does it read Arabic?', 'Yes. Receipts in Arabic and English are read in both.'],
  ['Can we get our data out?', 'Any time. Filter the records and export the Excel workbook, or keep using it alongside your accounting system.'],
  ['Who can see our receipts?', 'Only the people you approve into your workspace. Receipts are stored privately and opened through links that expire in minutes.'],
];

function Shot({ src, alt, className = '' }) {
  return (
    <div className={`plate overflow-hidden ${className}`}>
      <img src={src} alt={alt} loading="lazy" className="block w-full h-auto" />
    </div>
  );
}

function Mark() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 bg-flare-500 flex items-center justify-center flex-shrink-0">
        <span className="text-ink-900 text-base font-extrabold w-wide">DL</span>
      </div>
      <p className="text-ink-900 font-extrabold text-xl w-wide leading-none">Doc Ledger</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper-100 text-ink-900">
      {/* ── Top rule ─────────────────────────────────────────────────────── */}
      <header className="border-b-2 border-ink-900 bg-paper-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
          <Mark />
          <nav className="hidden md:flex items-center gap-5 text-sm font-bold text-ink-600 ml-4">
            <a href="#how" className="hover:text-ink-900">How it works</a>
            <a href="#documents" className="hover:text-ink-900">Your documents</a>
            <a href="#questions" className="hover:text-ink-900">Questions</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/login" className="btn-quiet btn-sm">Sign in</Link>
            <a href={DEMO_URL} className="btn-primary btn-sm">Try the demo</a>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-14 lg:pt-16 lg:pb-20 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-5">
          <p className="label">For finance teams that key bills by hand</p>
          <h1 className="display w-wider text-4xl sm:text-5xl text-ink-900">
            Photograph the bill. The ledger fills itself.
          </h1>
          <p className="text-lg text-ink-600 mt-5 max-w-md">
            Doc Ledger reads shipping line bills, fuel receipts and petty cash the way your team would: every charge line,
            every BL and container number, foreign currency at the rate of the day. A person checks it against the photo and
            saves. Month end becomes an export.
          </p>
          <div className="flex flex-wrap gap-2 mt-7">
            <a href={DEMO_URL} className="btn-primary">Try the demo</a>
            <Link to="/signup" className="btn-ghost">Start your free month</Link>
          </div>
          <p className="meta mt-3">The demo needs no signup. The first month is free, no card to start.</p>
        </div>
        <div className="lg:col-span-7">
          <div className="relative mr-3 mb-3 sm:mr-5 sm:mb-5">
            <div className="overprint absolute -right-3 -bottom-3 sm:-right-5 sm:-bottom-5 w-2/3 h-2/3 bg-flare-500" aria-hidden="true" />
            <Shot src="/landing/review.jpg" alt="A shipping line bill beside the fields Doc Ledger read from it" className="relative" />
          </div>
          <p className="meta mt-3">A Jebel Ali debit note after reading: BL, containers, port and every charge, ready to check.</p>
        </div>
      </section>

      {/* ── Three facts on the ink band ──────────────────────────────────── */}
      <section className="bg-ink-900 text-paper-100 border-y-2 border-ink-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 grid sm:grid-cols-3 gap-4">
          {['Every charge line itemised', 'Foreign currency fixed at the day’s rate', 'Duplicates stopped before they reach the books'].map((t) => (
            <p key={t} className="font-mono text-sm">{t}</p>
          ))}
        </div>
      </section>

      {/* ── What it already reads ────────────────────────────────────────── */}
      <section id="documents" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-20">
        <p className="label">Your documents</p>
        <h2 className="text-3xl w-wider max-w-2xl">Three documents it already knows by heart</h2>
        <div className="grid md:grid-cols-3 gap-4 mt-8">
          {KNOWN.map((d) => (
            <div key={d.name} className="plate">
              <div className="px-4 pt-4 pb-3 border-b-2 border-ink-900">
                <p className="text-lg font-bold w-wide">{d.name}</p>
                <p className="text-sm text-ink-500">{d.note}</p>
              </div>
              <dl className="px-4 py-3 space-y-1.5">
                {d.rows.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 border-b border-paper-300 pb-1.5 last:border-0">
                    <dt className="text-2xs font-bold uppercase text-ink-500">{k}</dt>
                    <dd className="font-mono text-sm text-ink-900 text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-12 gap-10 items-center mt-16">
          <div className="lg:col-span-5">
            <h3 className="text-2xl w-wider">And the ones only your company has</h3>
            <p className="text-base text-ink-600 mt-3">
              Hotel folios with check in dates. Contractor invoices with PO numbers. Lab orders with batch codes. Name the
              document, list the fields you want, describe it in a sentence, and Doc Ledger reads for those instead of ours.
            </p>
            <p className="text-base text-ink-600 mt-3">
              Most expense tools give you fixed fields and a category list. This one is shaped to your paperwork, and if you
              need something it does not do yet, we build it for you.
            </p>
          </div>
          <div className="lg:col-span-7">
            <Shot src="/landing/types.jpg" alt="The document type builder: name, fields and reading hints" />
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how" className="border-y-2 border-ink-900 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-20">
          <p className="label">How it works</p>
          <div className="grid md:grid-cols-3 gap-8 mt-4">
            {STEPS.map(([n, title, text]) => (
              <div key={n}>
                <p className="font-mono text-5xl text-blue-600 leading-none">{n}</p>
                <p className="text-xl font-bold w-wide mt-4">{title}</p>
                <p className="text-base text-ink-600 mt-2">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Proof />

      {/* ── Month end ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-20 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 order-2 lg:order-1">
          <Shot src="/landing/records.jpg" alt="The records ledger with filters and totals" />
        </div>
        <div className="lg:col-span-5 order-1 lg:order-2">
          <p className="label">Month end</p>
          <h2 className="text-3xl w-wider">The envelope of receipts becomes a ledger</h2>
          <ul className="mt-5 space-y-4">
            {[
              ['Every record keeps its photo', 'Open the original bill from any row, so the auditor never waits.'],
              ['A four sheet Excel workbook', 'Filter by month, type or business unit and export what finance needs.'],
              ['Clearing agent savings', 'Changed agents? Doc Ledger tracks the old fee against the new one, bill by bill.'],
            ].map(([t, d]) => (
              <li key={t} className="border-l-2 border-flare-500 pl-3">
                <p className="font-bold">{t}</p>
                <p className="text-sm text-ink-500">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Your workspace ───────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14 lg:pb-20">
        <div className="plate-blue px-5 py-6 sm:px-8 sm:py-8 grid md:grid-cols-2 gap-6">
          <div>
            <p className="label-inv">Your company, your workspace</p>
            <p className="text-2xl w-wider font-bold">Your people, your categories, your rates</p>
          </div>
          <p className="text-base text-white/90">
            Each company runs in a workspace of its own with its own people and roles, categories, business units, currencies
            and exchange rates. Historical records keep the rate they were saved with, so last quarter never changes behind your back.
          </p>
        </div>
      </section>

      {/* ── Questions ────────────────────────────────────────────────────── */}
      <section id="questions" className="max-w-6xl mx-auto px-4 sm:px-6 pb-14 lg:pb-20">
        <p className="label">Questions</p>
        <div className="grid md:grid-cols-2 gap-x-10 border-t-2 border-ink-900">
          {QUESTIONS.map(([q, a]) => (
            <div key={q} className="py-5 border-b border-paper-400">
              <p className="font-bold text-lg w-wide">{q}</p>
              <p className="text-base text-ink-600 mt-1">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Last call ────────────────────────────────────────────────────── */}
      <section className="border-t-2 border-ink-900 bg-flare-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <h2 className="display w-wider text-3xl sm:text-4xl text-ink-900">Try it on a bill before you talk to anyone.</h2>
            <p className="text-base text-ink-900 mt-2">
              Or write to <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold underline underline-offset-2">{CONTACT_EMAIL}</a>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={DEMO_URL} className="btn bg-ink-900 border-ink-900 text-paper-100 hover:bg-ink-700">Try the demo</a>
            <a href={BOOKING_URL} className="btn bg-white border-ink-900 text-ink-900 hover:bg-paper-100">Book 15 minutes</a>
          </div>
        </div>
      </section>

      <footer className="border-t-2 border-ink-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center gap-4">
          <Mark />
          <p className="meta ml-auto">docledger.site · {CONTACT_EMAIL}</p>
          <Link to="/login" className="text-sm font-bold text-blue-600 underline underline-offset-2">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
