import { useNavigate } from 'react-router-dom';
import { Fuel, Car, FileText, Package, UtensilsCrossed, Printer, Briefcase, Plane, Heart, MoreHorizontal } from 'lucide-react';

const CATEGORY_ICONS = {
  'Fuel & Transport': Fuel, 'Parking': Car, 'Customs & Clearance': FileText,
  'Materials & Supplies': Package, 'Food & Beverages': UtensilsCrossed,
  'Printing & Photocopy': Printer, 'Office Supplies': Briefcase,
  'Accommodation & Travel': Plane, 'Medical': Heart, 'Miscellaneous': MoreHorizontal
};

const CATEGORY_COLORS = {
  'Fuel & Transport':      'bg-orange-100 text-orange-500',
  'Parking':               'bg-blue-100 text-blue-500',
  'Customs & Clearance':   'bg-purple-100 text-purple-500',
  'Materials & Supplies':  'bg-yellow-100 text-yellow-600',
  'Food & Beverages':      'bg-pink-100 text-pink-500',
  'Printing & Photocopy':  'bg-cyan-100 text-cyan-600',
  'Office Supplies':       'bg-indigo-100 text-indigo-500',
  'Accommodation & Travel':'bg-sky-100 text-sky-500',
  'Medical':               'bg-red-100 text-red-500',
  'Miscellaneous':         'bg-paper-300 text-ink-500'
};

const fmtDate = (d) => {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AE', { day: '2-digit', month: 'short' });
};

export default function RecentTransactions({ transactions = [] }) {
  const navigate = useNavigate();

  if (!transactions.length) {
    return (
      <div className="text-center py-8 text-ink-400 text-sm">
        No transactions yet.{' '}
        <button onClick={() => navigate('/upload')} className="text-brand-600 hover:text-brand-700 font-semibold">
          Add one →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {transactions.map((tx, i) => {
        const Icon       = CATEGORY_ICONS[tx.category] || MoreHorizontal;
        const colorClass = CATEGORY_COLORS[tx.category] || 'bg-paper-300 text-ink-500';
        const amount     = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(tx.amount_aed || tx.amount);
        return (
          <div
            key={tx.id}
            onClick={() => navigate('/records')}
            style={{ animationDelay: `${i * 40}ms` }}
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-lg hover:bg-paper-100 cursor-pointer transition-all duration-150 group fade-in"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-ink-800 truncate leading-tight">{tx.vendor_name || 'Unknown'}</p>
              <p className="text-xs text-ink-400 truncate mt-0.5">
                {tx.purpose || tx.category}
                {tx.business_unit ? <span className="ml-1.5 text-brand-600 font-medium">{tx.business_unit}</span> : null}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[13px] font-bold text-ink-800 font-mono tabular-nums">AED {amount}</p>
              <p className="text-xs text-ink-400 mt-0.5">{fmtDate(tx.date)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
