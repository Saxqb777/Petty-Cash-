const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS = ['','M','','W','','F',''];

// Blue ramp, blue-50 → blue-600. Empty days stay neutral paper so absence of
// ink reads as absence of spend.
const EMPTY = '#E5E3DD';                 // paper-200
const RAMP = [
  { upTo: 0.10, color: '#EFF2FA' },      // blue-50
  { upTo: 0.25, color: '#DDE3F3' },      // blue-100
  { upTo: 0.45, color: '#B9C4E4' },      // blue-200
  { upTo: 0.70, color: '#8B9AC6' },      // blue-300
  { upTo: 0.90, color: '#4A5FA5' },      // blue-400
  { upTo: 1.01, color: '#22356F' },      // blue-600
];

// White on blue-400 and blue-600; ink everywhere lighter. Measured, not guessed.
const INVERTED = new Set(['#4A5FA5', '#22356F']);
const labelInkFor = (color) => (INVERTED.has(color) ? '#FFFFFF' : '#14141A');

function getColor(amount, max) {
  if (!amount || amount <= 0) return EMPTY;
  const ratio = max > 0 ? amount / max : 0;
  const step = RAMP.find(s => ratio < s.upTo);
  return (step || RAMP[RAMP.length - 1]).color;
}

const compact = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`;
  if (n >= 1000)    return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
};
const full = (n) => (n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SpendHeatmap({ data = [] }) {
  const byDate = {};
  data.forEach(d => { byDate[d.date] = d.total; });

  const amounts = data.filter(d => d.total > 0).map(d => d.total);
  const max = amounts.length > 0 ? Math.max(...amounts) : 1;

  // Build grid: 53 weeks x 7 days, ending today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the Sunday on or before 52 weeks ago
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // align to Sunday

  const weeks = [];
  const current = new Date(startDate);
  const monthPositions = [];
  let prevMonth = -1;

  while (current <= today) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const iso = current.toISOString().split('T')[0];
      const isFuture = current > today;
      week.push({ date: iso, amount: isFuture ? null : (byDate[iso] || 0), isFuture });

      // Track month label position (first day of month that falls on Sunday = new week)
      if (d === 0) {
        const m = current.getMonth();
        if (m !== prevMonth) {
          monthPositions.push({ month: m, weekIndex: weeks.length });
          prevMonth = m;
        }
      }

      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  const totalSpend = amounts.reduce((s, v) => s + v, 0);
  const activeDays = amounts.length;

  // Legend steps carry the AED value each band tops out at, so every label on
  // the scale names a number the data actually reaches.
  const legend = [
    { color: EMPTY, label: '0' },
    ...RAMP.map(s => ({ color: s.color, label: compact(Math.min(s.upTo, 1) * max) })),
  ];

  return (
    <div>
      <div className="flex items-start gap-2">
        {/* Day labels */}
        <div className="flex flex-col gap-[2px] mt-[20px]">
          {DAY_LABELS.map((l, i) => (
            <div key={i} className="h-[11px] w-3 font-mono text-[10px] text-ink-400 flex items-center">{l}</div>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto pb-1">
          <div style={{ minWidth: `${weeks.length * 13}px` }}>
            {/* Month labels */}
            <div className="flex mb-1 relative h-4">
              {monthPositions.map(({ month, weekIndex }) => (
                <div key={`${month}-${weekIndex}`}
                  className="absolute font-mono text-[10px] uppercase text-ink-400"
                  style={{ left: `${weekIndex * 13}px` }}>
                  {MONTH_LABELS[month]}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-[2px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[2px]">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      title={day.isFuture ? '' : day.amount > 0
                        ? `${day.date}  AED ${full(day.amount)}`
                        : day.date}
                      className="w-[11px] h-[11px] cursor-default border border-paper-300"
                      style={{
                        backgroundColor: day.isFuture ? 'transparent' : getColor(day.amount, max),
                        borderColor: day.isFuture ? 'transparent' : undefined,
                        opacity: day.isFuture ? 0 : 1,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scale + summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-paper-300">
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-mono text-2xs uppercase text-ink-400 mr-1">AED</span>
          {legend.map(({ color, label }) => (
            <span
              key={color}
              className="h-[18px] min-w-[42px] px-1 border border-paper-400 flex items-center justify-center font-mono text-[10px] tabular-nums"
              style={{ backgroundColor: color, color: labelInkFor(color) }}
            >
              {label}
            </span>
          ))}
        </div>
        <p className="font-mono text-2xs uppercase text-ink-400">
          {activeDays} active days · AED {full(totalSpend)}
        </p>
      </div>
    </div>
  );
}
