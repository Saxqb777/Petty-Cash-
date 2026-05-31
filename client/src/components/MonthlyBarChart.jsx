import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0);
const fmtFull = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(n);

const monthNames = { '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May',
  '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-brand-600 font-bold">AED {fmtFull(payload[0].value)}</p>
      <p className="text-gray-400 text-xs">{payload[0].payload.count} transactions</p>
    </div>
  );
};

export default function MonthlyBarChart({ data = [] }) {
  const formatted = data.map(d => {
    const [year, month] = d.month.split('-');
    return { ...d, label: `${monthNames[month]} ${year.slice(2)}` };
  });

  if (!formatted.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={formatted} barSize={32} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'DM Sans' }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'DM Sans' }}
          tickFormatter={fmt}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f0fdf4' }} />
        <Bar dataKey="total" fill="#16a34a" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
