import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';

// OVERPRINT chart inks. Ordinary spend is blue; the current (last) month is the
// second plate. Nothing else gets a hue.
const INK_BLUE  = '#22356F'; // blue-600
const INK_FLARE = '#FF4A17'; // flare-500
const TICK      = '#6B6B75'; // ink-400
const RULE      = '#D8D5CD'; // paper-300

const fmtAxis = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`;
  if (n >= 1000)    return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
};
const fmtFull = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(n || 0);

const MONTHS = { '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun',
  '07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-900 text-paper-100 px-3 py-2 border-2 border-ink-900">
      <p className="font-mono text-2xs uppercase text-paper-400">{label}</p>
      <p className="font-mono text-sm tabular-nums text-white mt-0.5">AED {fmtFull(payload[0].value)}</p>
      <p className="font-mono text-2xs text-paper-400 mt-0.5">{payload[0].payload.count} TXN</p>
    </div>
  );
};

export default function MonthlyBarChart({ data = [] }) {
  const formatted = data.map((d, i) => {
    const [year, month] = String(d.month || '').split('-');
    return {
      ...d,
      label: `${MONTHS[month] || month || '?'} '${(year || '').slice(2)}`,
      isLast: i === data.length - 1,
    };
  });

  if (!formatted.length) {
    return (
      <div className="flex flex-col items-center justify-center h-52 gap-2 border-2 border-dashed border-paper-400">
        <p className="font-mono text-2xs uppercase text-ink-400">No data yet</p>
      </div>
    );
  }

  const values = formatted.map(d => Number(d.total) || 0);
  const max    = Math.max(...values, 0);
  const avg    = values.reduce((s, v) => s + v, 0) / values.length;

  // Every tick names a value the chart genuinely reaches: the top tick IS the
  // tallest bar, the rest are exact fractions of it.
  const ticks = max > 0 ? [0, max * 0.25, max * 0.5, max * 0.75, max] : [0, 1];

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={236}>
        <BarChart
          data={formatted}
          barSize={34}
          margin={{ top: 14, right: 10, bottom: 4, left: 0 }}
        >
          <CartesianGrid stroke={RULE} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={{ stroke: '#14141A', strokeWidth: 2 }}
            tickLine={false}
            tick={{ fontSize: 10, fill: TICK, fontFamily: 'Fragment Mono, monospace' }}
            dy={6}
            interval={0}
            height={26}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: TICK, fontFamily: 'Fragment Mono, monospace' }}
            tickFormatter={fmtAxis}
            ticks={ticks}
            domain={[0, max > 0 ? max : 1]}
            width={46}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#DDE3F3' }} />
          <Bar dataKey="total" isAnimationActive={false} className="overprint">
            {formatted.map((entry, i) => (
              <Cell key={i} fill={entry.isLast ? INK_FLARE : INK_BLUE} />
            ))}
          </Bar>
          {/* The second plate laid over the first: where the average rule crosses a
              bar the two inks multiply. */}
          {max > 0 && (
            <ReferenceLine
              y={avg}
              stroke={INK_FLARE}
              strokeWidth={2}
              className="overprint"
              ifOverflow="extendDomain"
              label={{
                value: `AVG ${fmtAxis(avg)}`,
                position: 'insideTopRight',
                fill: '#C4340D',
                fontSize: 10,
                fontFamily: 'Fragment Mono, monospace',
                dy: -4,
              }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
