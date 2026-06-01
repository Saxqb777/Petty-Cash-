import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt     = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n | 0);
const fmtFull = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(n);

const MONTHS = { '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun',
  '07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white rounded-xl shadow-xl px-4 py-3 text-sm border border-white/10">
      <p className="text-white/60 text-xs mb-1 font-medium">{label}</p>
      <p className="font-bold text-[15px] text-brand-400">AED {fmtFull(payload[0].value)}</p>
      <p className="text-white/40 text-xs mt-0.5">{payload[0].payload.count} transactions</p>
    </div>
  );
};

export default function MonthlyBarChart({ data = [] }) {
  const formatted = data.map((d, i) => {
    const [year, month] = d.month.split('-');
    return { ...d, label: `${MONTHS[month]} '${year.slice(2)}`, isLast: i === data.length - 1 };
  });

  if (!formatted.length) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-slate-400 text-sm gap-2">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-1">
          <span className="text-2xl">📊</span>
        </div>
        No data yet
      </div>
    );
  }

  return (
    <div className="relative">
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#22c55e" stopOpacity="1" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="barGradActive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4ade80" stopOpacity="1" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.9" />
          </linearGradient>
        </defs>
      </svg>
      <ResponsiveContainer width="100%" height={228}>
        <BarChart data={formatted} barSize={36} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Inter' }}
            dy={6}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Inter' }}
            tickFormatter={fmt}
            width={38}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', radius: 8 }} />
          <Bar dataKey="total" radius={[8, 8, 3, 3]}>
            {formatted.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isLast ? 'url(#barGradActive)' : 'url(#barGrad)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
