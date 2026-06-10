const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS = ['','M','','W','','F',''];

function getColor(amount, max) {
  if (!amount || amount === 0) return '#EEE9E0';
  const ratio = amount / max;
  if (ratio < 0.15) return '#d2e3b6';
  if (ratio < 0.35) return '#b5cf8a';
  if (ratio < 0.60) return '#7ba046';
  if (ratio < 0.85) return '#62833A';
  return '#354626';
}

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

  return (
    <div>
      <div className="flex items-start gap-2">
        {/* Day labels */}
        <div className="flex flex-col gap-[1px] mt-[19px]">
          {DAY_LABELS.map((l, i) => (
            <div key={i} className="h-[10px] w-3 text-[8px] text-slate-400 flex items-center">{l}</div>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto">
          {/* Month labels */}
          <div className="flex mb-1 relative h-4">
            {monthPositions.map(({ month, weekIndex }) => (
              <div key={`${month}-${weekIndex}`}
                className="absolute text-[9px] text-slate-400 font-medium"
                style={{ left: `${weekIndex * 11}px` }}>
                {MONTH_LABELS[month]}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-[1px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[1px]">
                {week.map((day, di) => (
                  <div
                    key={di}
                    title={day.isFuture ? '' : day.amount > 0
                      ? `${day.date}  AED ${day.amount.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : day.date}
                    className="w-[10px] h-[10px] rounded-[2px] cursor-default"
                    style={{
                      backgroundColor: day.isFuture ? 'transparent' : getColor(day.amount, max),
                      opacity: day.isFuture ? 0 : 1,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend + summary */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span>Less</span>
          {['#EEE9E0','#d2e3b6','#b5cf8a','#7ba046','#354626'].map(c => (
            <div key={c} className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: c }} />
          ))}
          <span>More</span>
        </div>
        <p className="text-[10px] text-slate-400">
          {activeDays} days with expenses · AED {totalSpend.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
        </p>
      </div>
    </div>
  );
}
