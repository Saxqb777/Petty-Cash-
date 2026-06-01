import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = [
  '#16a34a', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ef4444', '#ec4899', '#14b8a6',
  '#f97316', '#6366f1'
];

const fmt     = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const fmtFull = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(n);

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-slate-900 text-white rounded-xl shadow-xl px-3 py-2.5 text-sm border border-white/10">
      <p className="text-white/60 text-xs mb-0.5">{name}</p>
      <p className="font-bold text-brand-400">AED {fmtFull(value)}</p>
    </div>
  );
};

const CenterLabel = ({ viewBox, total }) => {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  const formatted = total >= 1000
    ? `${(total / 1000).toFixed(1)}k`
    : fmt(total);
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" className="fill-slate-800"
        style={{ fontFamily: 'DM Sans', fontWeight: 700, fontSize: 20 }}>
        {formatted}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-slate-400"
        style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        AED Total
      </text>
    </g>
  );
};

export default function CategoryDonutChart({ data = [] }) {
  const total = data.reduce((s, d) => s + d.total, 0);
  const top5  = data.slice(0, 7);

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-slate-400 text-sm gap-2">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-1">
          <span className="text-2xl">🍩</span>
        </div>
        No data yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={top5}
            dataKey="total"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={3}
            strokeWidth={0}
            labelLine={false}
            label={<CenterLabel total={total} />}
          >
            {top5.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="space-y-1.5 px-1">
        {top5.map((d, i) => {
          const pct = total > 0 ? ((d.total / total) * 100).toFixed(1) : 0;
          return (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-xs text-slate-600 flex-1 truncate font-medium">{d.category}</span>
              <span className="text-xs text-slate-400 tabular-nums">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
