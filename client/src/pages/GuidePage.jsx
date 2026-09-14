import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, UserPlus, ShieldCheck, Camera, Layers, Coins,
  CopyCheck, Table2, PiggyBank, Settings, Users, Wrench, LifeBuoy,
} from 'lucide-react';

/* The operating procedure, in the app rather than in a file someone has to go
   and find. Kept as a page rather than a linked PDF so it stays readable on a
   phone, searchable with the browser's own find, and impossible to end up
   holding an out of date copy of. */

const SECTIONS = [
  { id: 'what',      n: '01', icon: BookOpen,    title: 'What this replaces' },
  { id: 'access',    n: '02', icon: UserPlus,    title: 'Getting access' },
  { id: 'roles',     n: '03', icon: ShieldCheck, title: 'Roles and permissions' },
  { id: 'record',    n: '04', icon: Camera,      title: 'Recording an expense' },
  { id: 'types',     n: '05', icon: Layers,      title: 'The expense types' },
  { id: 'money',     n: '06', icon: Coins,       title: 'Currency and AED' },
  { id: 'duplicate', n: '07', icon: CopyCheck,   title: 'Duplicates and flags' },
  { id: 'records',   n: '08', icon: Table2,      title: 'Records and export' },
  { id: 'savings',   n: '09', icon: PiggyBank,   title: 'Clearance savings' },
  { id: 'settings',  n: '10', icon: Settings,    title: 'Settings' },
  { id: 'people',    n: '11', icon: Users,       title: 'Managing people' },
  { id: 'custom',    n: '12', icon: Wrench,      title: 'Custom expense types' },
  { id: 'trouble',   n: '13', icon: LifeBuoy,    title: 'When something breaks' },
];

function Section({ id, n, icon: Icon, title, children }) {
  return (
    <section id={id} className="scroll-mt-6 pt-2">
      <div className="flex items-center gap-3 border-b-2 border-ink-900 pb-2 mb-4">
        <span className="font-mono text-sm text-flare-700">{n}</span>
        <div className="w-8 h-8 border-2 border-ink-900 bg-white flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-ink-900" strokeWidth={2} />
        </div>
        <h2 className="text-xl w-wide text-ink-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const P = ({ children }) => <p className="text-base text-ink-700 mb-3 max-w-[68ch]">{children}</p>;

function Steps({ items }) {
  return (
    <ol className="border-t border-paper-300 mb-4">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3 border-b border-paper-300 py-2.5">
          <span className="font-mono text-xs text-flare-700 pt-0.5 flex-shrink-0">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className="text-sm text-ink-700">{t}</span>
        </li>
      ))}
    </ol>
  );
}

function Rows({ rows, head }) {
  return (
    <div className="overflow-x-auto mb-4">
      <table className="ledger min-w-[34rem]">
        {head && (
          <thead>
            <tr>{head.map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
        )}
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? 'font-bold text-ink-900 align-top' : 'text-ink-700 align-top'}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ children, kind = 'note' }) {
  const style = {
    note:  'bg-blue-50 border-blue-600',
    warn:  'bg-flare-50 border-flare-700',
    good:  'bg-green-50 border-green-700',
  }[kind];
  return (
    <div className={`border-l-[3px] border border-paper-400 ${style} px-4 py-3 mb-4 max-w-[68ch]`}>
      <p className="text-sm text-ink-800">{children}</p>
    </div>
  );
}

export default function GuidePage() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const ticking = useRef(false);

  // Highlight whichever section the reader is currently in.
  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        let current = SECTIONS[0].id;
        for (const s of SECTIONS) {
          const el = document.getElementById(s.id);
          if (el && el.getBoundingClientRect().top <= 90) current = s.id;
        }
        setActive(current);
        ticking.current = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.12, ease: 'easeOut' }} className="mb-7">
        <p className="label">Standard operating procedure</p>
        <h1 className="text-3xl w-wider text-ink-900">How to use Doc Ledger</h1>
        <p className="text-base text-ink-500 mt-1 max-w-[68ch]">
          Everything from your first sign in to closing the month. Read it once, then use the
          contents to jump back to whatever you need.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-7">
        {/* Contents */}
        <nav className="lg:col-span-1 lg:sticky lg:top-5 lg:self-start" aria-label="Contents">
          <p className="label border-b-2 border-ink-900 pb-2">Contents</p>
          <ul className="mt-1">
            {SECTIONS.map(s => (
              <li key={s.id}>
                <a href={`#${s.id}`}
                  className={`flex gap-2.5 py-1.5 text-sm border-l-[3px] pl-2.5 transition-colors duration-[120ms] ${
                    active === s.id
                      ? 'border-l-flare-500 text-ink-900 font-bold'
                      : 'border-l-transparent text-ink-500 hover:text-ink-900'
                  }`}>
                  <span className="font-mono text-xs text-ink-400 pt-0.5">{s.n}</span>
                  <span>{s.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Body */}
        <div className="lg:col-span-3 space-y-9">

          <Section {...SECTIONS[0]}>
            <P>
              Doc Ledger records petty cash spending from the receipt itself. Someone photographs
              a receipt, the system reads it and fills in the fields, a person checks the result
              and saves it. Finance then reports on it without retyping anything.
            </P>
            <P>It replaces the paper voucher book, the spreadsheet that was retyped from those
              receipts at month end, and the separate tracker for clearing agent fees.</P>
            <Note>
              Every organisation is separate. You see your own organisation&apos;s expenses and
              nobody else&apos;s, and nobody outside it can see yours.
            </Note>
          </Section>

          <Section {...SECTIONS[1]}>
            <Steps items={[
              'Open the Doc Ledger address and choose Create one under the sign in box.',
              'Enter your full name, work email and a password of at least eight characters.',
              'Choose whether you are creating a new organisation or joining an existing one.',
            ]} />
            <Rows head={['Choice', 'What happens']} rows={[
              ['Create new', 'You name the organisation and become its owner immediately, with a fresh empty set of records. Only use this if your company is not already on the system.'],
              ['Join existing', 'You pick your organisation and your request goes to its administrators. You cannot see anything until one of them approves you. This is the right choice for almost everyone.'],
            ]} />
            <Note kind="note">
              Waiting for approval shows a holding screen that checks itself every twelve seconds.
              Leave it open. Nothing is wrong. Chase an administrator if it is still waiting the
              next day.
            </Note>
          </Section>

          <Section {...SECTIONS[2]}>
            <P>Four roles. Each includes everything the ones above it can do.</P>
            <Rows head={['Role', 'Can do', 'Typically']} rows={[
              ['Member',  'Record an expense, upload receipts, view and edit records, see the dashboard and savings.', 'Anyone who spends petty cash'],
              ['Finance', 'All of the above, plus delete records, export to Excel, change settings and exchange rates, and record clearance savings.', 'Accounts team'],
              ['Admin',   'All of the above, plus approve or reject people, change their roles, remove them, and build custom expense types.', 'Department head'],
              ['Owner',   'Everything. The person who created the organisation.', 'Business owner'],
            ]} />
            <Note kind="warn">
              Any member can edit any expense in the organisation, not only their own. Deleting is
              restricted to finance and above, editing is not. Keep most people as members.
            </Note>
          </Section>

          <Section {...SECTIONS[3]}>
            <P>This is the procedure everyone follows, every time. Under a minute once the
              receipt is in front of you.</P>
            <Steps items={[
              'Open Add Expense.',
              'Pick the expense type that matches the document in your hand. This changes which fields you get and how well the reading works.',
              'Drop the photograph or PDF onto the panel, or click to browse. With no document at all, choose Type it in.',
              'Wait while it is read. A few seconds normally, up to a minute for a dense shipping bill. Do not refresh.',
              'Check every field against the document, which stays on screen beside the form. Fields marked in orange are the ones the system was unsure about, so start there.',
              'Correct anything wrong, then press Save expense.',
            ]} />
            <Note kind="warn">
              You are responsible for what you save. Once saved, the figures are the record. Check
              the amount and the date against the document every time, even when nothing is marked
              in orange.
            </Note>
            <Rows rows={[
              ['Accepted', 'JPG, PNG, WEBP and PDF, up to 15 MB'],
              ['Best results', 'Flat, well lit, whole receipt, right way up, total not cut off'],
              ['Poor results', 'Crumpled thermal paper, an angle, a shadow over the total, or a photo of a screen'],
            ]} />
          </Section>

          <Section {...SECTIONS[4]}>
            <P>Three come built in. Choosing correctly matters, because each asks the reader to
              look for different things.</P>
            <Rows head={['Type', 'Use it for']} rows={[
              ['General expense', 'Parking, printing, office supplies, materials, food, medical, travel. You pick a category, which is what the dashboard breakdown is built from.'],
              ['Petrol and fuel', 'Fuel station receipts. Also captures fuel grade, litres, odometer and vehicle plate. Use this rather than general, or you lose the vehicle record.'],
              ['Shipping line bill', 'Freight, terminal handling, demurrage and customs clearance. Captures every charge line separately, all BL and container numbers, the port, and import or export.'],
            ]} />
            <Note>
              On a shipping bill the total is calculated from the charge lines you enter, not typed
              directly. If it does not match the invoice, a charge line is missing or wrong. That is
              the point of entering them separately.
            </Note>
          </Section>

          <Section {...SECTIONS[5]}>
            <P>Expenses are stored in the currency they were paid in. Alongside that sits the AED
              equivalent, and every report is built from the AED figure.</P>
            <Rows head={['Rule', 'What it means for you']} rows={[
              ['Rate is taken at save time', 'The conversion uses the rate at the instant you save, and that figure is then fixed.'],
              ['Old records never re-convert', 'Changing a rate next month leaves last month alone. Deliberate: accounts that silently restate themselves are not accounts.'],
              ['AED is always one', 'An expense paid in dirhams is never converted.'],
            ]} />
            <Note kind="warn">
              Save foreign currency expenses promptly. An invoice entered six weeks late converts
              at today&apos;s rate, not the rate on the day it was incurred.
            </Note>
          </Section>

          <Section {...SECTIONS[6]}>
            <P>The same receipt cannot be claimed twice. Three checks run, in order.</P>
            <Rows head={['Check', 'Triggered by', 'Result']} rows={[
              ['Same file', 'The identical image or PDF, even renamed', 'Refused'],
              ['Same invoice', 'Same invoice number, vendor, date and amount', 'Refused'],
              ['Looks similar', 'No invoice number, same vendor, date and amount', 'Warning, saving allowed'],
            ]} />
            <P>If a refusal is wrong, for instance two separate taxi fares for the same amount on
              the same day, add the receipt number to tell them apart.</P>
            <P>Fields turn orange when the reader was not confident or the figures do not add up:
              an unreadable amount, a date in the future or more than two years old, an unsupported
              currency, or shipping charge lines that do not sum to the stated total.</P>
          </Section>

          <Section {...SECTIONS[7]}>
            <P>Everything saved appears under Records. Search by vendor or invoice number, filter
              by type, category, business unit or date, and sort any column by clicking its
              heading. Click a row to expand the full detail and the receipt.</P>
            <Rows rows={[
              ['Edit', 'Any member. Open the row, change what is wrong, save.'],
              ['Delete', 'Finance and above. Cannot be undone, and the receipt is deleted with it.'],
              ['Export', 'Finance and above. Any filters you have applied carry into the export.'],
            ]} />
            <P>The workbook has four sheets: a summary with breakdowns, every expense one per row,
              the shipping charge lines grouped per bill, and clearance savings by month.</P>
          </Section>

          <Section {...SECTIONS[8]}>
            <P>This tracks money saved by changing customs clearing agent. It answers one question:
              what would this shipment have cost with the old agent, and what did it actually cost.</P>
            <Rows rows={[
              ['Old fee', 'What the previous agent would have charged'],
              ['New fee', 'What was actually paid, taken from the expense'],
              ['Saving', 'Old fee minus new fee, calculated for you'],
            ]} />
            <Note kind="warn">
              The figure reported is gross savings: the difference in agent fees and nothing else.
              It does not net off fuel, staff time or any other cost. Present it as what it is.
            </Note>
          </Section>

          <Section {...SECTIONS[9]}>
            <P>Finance and above. Changes apply to the whole organisation.</P>
            <Rows rows={[
              ['Exchange rates', 'Used to convert into AED. Review monthly. Affects future entries only.'],
              ['Categories', 'The list offered on a general expense. Drives the dashboard breakdown, so keep it short.'],
              ['Business units', 'The divisions expenses are attributed to.'],
              ['Approval threshold', 'Expenses above this amount are flagged for attention.'],
            ]} />
          </Section>

          <Section {...SECTIONS[10]}>
            <P>Administrators and owners, under Members.</P>
            <Steps items={[
              'Pending requests appear at the top. Approve or reject each one. Until approved they see nothing.',
              'Set the right role at approval. Most people should be members. Only give finance to people who should be able to delete records and change rates.',
              'Remove people who leave, promptly. Their expenses stay intact.',
            ]} />
            <Note kind="warn">
              Anyone can request to join your organisation by picking it from the sign up list.
              Approval is the only thing between a stranger and your expense records. If you do not
              recognise the name, do not approve it.
            </Note>
          </Section>

          <Section {...SECTIONS[11]}>
            <P>Administrators can add types beyond the three built in ones, under Expense Types.
              Use this when a recurring document has fields the standard form does not capture.</P>
            <Steps items={[
              'Give it a name, and optionally a description, icon and colour.',
              'Write the extraction hints: a sentence or two saying what the document is and what to look for. This affects accuracy more than anything else on the page.',
              'Add your fields, choosing the right type for each, and mark the required ones.',
              'Save. It appears immediately when adding an expense.',
            ]} />
            <P>Vendor, amount and date are always present. Built in types cannot be changed.
              Custom ones can be archived, which hides them from Add Expense while leaving existing
              records untouched.</P>
          </Section>

          <Section {...SECTIONS[12]}>
            <Rows head={['What you see', 'What to do']} rows={[
              ['Stuck on the waiting screen', 'No administrator has approved you yet. Contact one.'],
              ['Sent back to sign in', 'Your session expired. Sign in again. Sessions last thirty days of use.'],
              ['Duplicate when saving', 'Already recorded. Search Records for the vendor and amount. If genuinely different, add the invoice number.'],
              ['Reading came back empty', 'The photograph was probably unreadable. Retake it flat and well lit, or choose Type it in.'],
              ['Upload fails immediately', 'Over 15 MB, or not a JPG, PNG, WEBP or PDF. Photograph it again at lower resolution.'],
              ['Export or delete not offered', 'Both need the finance role. Ask an administrator.'],
              ['A total looks wrong', 'Check whether you are reading a filtered view. Filters apply to what is shown and to the export.'],
            ]} />
          </Section>

          <div className="border-t-2 border-ink-900 pt-4">
            <p className="meta">
              Doc Ledger v2.0. Review this whenever roles, categories or exchange rate policy change.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
