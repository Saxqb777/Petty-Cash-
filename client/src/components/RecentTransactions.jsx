import { useNavigate } from 'react-router-dom';
import { Fuel, Car, FileText, Package, UtensilsCrossed, Printer, Briefcase, Plane, Heart, MoreHorizontal } from 'lucide-react';

const CATEGORY_ICONS = {
  'Fuel & Transport': Fuel, 'Parking': Car, 'Customs & Clearance': FileText,
  'Materials & Supplies': Package, 'Food & Beverages': UtensilsCrossed,
  'Printing & Photocopy': Printer, 'Office Supplies': Briefcase,
  'Accommodation & Travel': Plane, 'Medical': Heart, 'Miscellaneous': MoreHorizontal
};

const fmtDate = (d) => {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AE', { day: '2-digit', month: 'short' });
};

export default function RecentTransactions({ transactions = [] }) {
  const navigate = useNavigate();

  if (!transactions.length) {
    return (
      <div className="border border-paper-400 py-8 px-4 text-center">
        <p className="text-sm text-ink-500 mb-3">No transactions yet.</p>
        <button onClick={() => navigate('/upload')} className="btn-ghost btn-sm">
          Add one
        </button>
      </div>
    );
  }

  return (
    <div className="border-2 border-ink-900 bg-white">
      {transactions.map((tx, i) => {
        const Icon   = CATEGORY_ICONS[tx.category] || MoreHorizontal;
        const amount = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(tx.amount_aed || tx.amount);
        return (
          <div
            key={tx.id}
            onClick={() => navigate('/records')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/records'); } }}
            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-[120ms] hover:bg-blue-50
              ${i > 0 ? 'border-t border-paper-300' : ''} ${i % 2 === 1 ? 'bg-paper-50' : 'bg-white'}`}
          >
            <div className="w-7 h-7 border border-blue-600 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink-900 truncate leading-tight">{tx.vendor_name || 'Unknown'}</p>
              <p className="text-xs text-ink-400 truncate mt-0.5">
                {tx.purpose || tx.category}
                {tx.business_unit ? <span className="ml-1.5 font-mono uppercase text-blue-600">{tx.business_unit}</span> : null}
              </p>
            </div>

            <div className="flex-shrink-0 text-right">
              <p className="amount text-sm text-ink-900">AED {amount}</p>
              <p className="meta mt-0.5">{fmtDate(tx.date)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
