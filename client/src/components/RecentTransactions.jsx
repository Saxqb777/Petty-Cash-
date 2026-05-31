import { useNavigate } from 'react-router-dom';
import { Fuel, Car, FileText, Package, UtensilsCrossed, Printer, Briefcase, Plane, Heart, MoreHorizontal } from 'lucide-react';

const CATEGORY_ICONS = {
  'Fuel & Transport': Fuel,
  'Parking': Car,
  'Customs & Clearance': FileText,
  'Materials & Supplies': Package,
  'Food & Beverages': UtensilsCrossed,
  'Printing & Photocopy': Printer,
  'Office Supplies': Briefcase,
  'Accommodation & Travel': Plane,
  'Medical': Heart,
  'Miscellaneous': MoreHorizontal
};

const CATEGORY_COLORS = {
  'Fuel & Transport': 'bg-orange-100 text-orange-600',
  'Parking': 'bg-blue-100 text-blue-600',
  'Customs & Clearance': 'bg-purple-100 text-purple-600',
  'Materials & Supplies': 'bg-yellow-100 text-yellow-600',
  'Food & Beverages': 'bg-pink-100 text-pink-600',
  'Printing & Photocopy': 'bg-cyan-100 text-cyan-600',
  'Office Supplies': 'bg-indigo-100 text-indigo-600',
  'Accommodation & Travel': 'bg-sky-100 text-sky-600',
  'Medical': 'bg-red-100 text-red-600',
  'Miscellaneous': 'bg-gray-100 text-gray-600'
};

const fmt = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(n);
const fmtDate = (d) => {
  if (!d) return '-';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function RecentTransactions({ transactions = [] }) {
  const navigate = useNavigate();

  if (!transactions.length) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        No transactions yet. <button onClick={() => navigate('/upload')} className="text-brand-600 hover:underline">Add one →</button>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-50">
      {transactions.map(tx => {
        const Icon = CATEGORY_ICONS[tx.category] || MoreHorizontal;
        const colorClass = CATEGORY_COLORS[tx.category] || 'bg-gray-100 text-gray-600';
        return (
          <div
            key={tx.id}
            onClick={() => navigate('/records')}
            className="flex items-center gap-4 py-3 px-1 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{tx.vendor_name || 'Unknown'}</p>
              <p className="text-xs text-gray-400 truncate">{tx.purpose || tx.category} {tx.business_unit ? `· ${tx.business_unit}` : ''}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-gray-900">AED {fmt(tx.amount)}</p>
              <p className="text-xs text-gray-400">{fmtDate(tx.date)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
