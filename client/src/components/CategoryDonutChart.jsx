import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

// The categorical palette: three inks plus their darker steps. Nothing else.
const PALETTE = ['#22356F', '#FF4A17', '#00A95C', '#4A5FA5', '#C4340D', '#00753F'];

const fmt     = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const fmtFull = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(n || 0);

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-ink-900 text-paper-100 px-3 py-2 border-2 border-ink-900 max-w-[220px]">
      <p className="font-mono text-2xs uppercase text-paper-400 truncate">{name}</p>
      <p className="font-mono text-sm tabular-nums text-white mt-0.5">AED {fmtFull(value)}</p>
    </div>
  );
};

export default function CategoryDonutChart({ data = [] }) {
  const total = data.reduce((s, d) => s + (d.total || 0), 0);
  const top5  = data.slice(0, 6);

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center h-52 gap-2 border-2 border-dashed border-paper-400">
        <p className="font-mono text-2xs uppercase text-ink-400">No data yet</p>
      </div>
    );
  }

  const centreValue = total >= 1000 ? `${(total / 1000).toFixed(1)}k` : fmt(total);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={top5}
              dataKey="total"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={88}
              paddingAngle={0}
              stroke="none"
              strokeWidth={0}
              isAnimationActive={false}
              className="overprint"
            >
              {top5.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Centre read-out, set in HTML so it keeps the system's type roles. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="font-mono tabular-nums text-2xl text-ink-900 leading-none">{centreValue}</p>
          <p className="font-mono text-2xs uppercase text-ink-400 mt-1">AED total</p>
        </div>
      </div>

      {/* Legend */}
      <ul className="border-t border-paper-300">
        {top5.map((d, i) => {
          const pct = total > 0 ? ((d.total / total) * 100).toFixed(1) : '0.0';
          return (
            <li key={d.category || i} className="flex items-center gap-3 py-1.5 border-b border-paper-300">
              <span
                className="w-3 h-3 flex-shrink-0 overprint"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="text-sm text-ink-700 flex-1 truncate">{d.category || 'Uncategorised'}</span>
              <span className="font-mono text-sm tabular-nums text-ink-500">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
