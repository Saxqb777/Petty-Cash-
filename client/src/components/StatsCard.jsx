import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../lib/utils';

function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useState('0');
  const frameRef = useRef(null);

  useEffect(() => {
    const num = parseFloat(String(target).replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num === 0) { setDisplay(target); return; }
    const prefix  = String(target).match(/^[^0-9]*/)?.[0] || '';
    const suffix  = String(target).match(/[^0-9.]*$/)?.[0] || '';
    const isFloat = String(target).includes('.');
    const decimals = isFloat ? (String(target).split('.')[1]?.length || 2) : 0;

    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const pct = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - pct, 3);
      const cur  = num * ease;
      const fmt  = new Intl.NumberFormat('en-AE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(cur);
      setDisplay(`${prefix}${fmt}${suffix}`);
      if (pct < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}

const VARIANTS = {
  green: {
    wrap:   'bg-brand-600 border-none',
    label:  'text-brand-200',
    val:    'text-white',
    sub:    'text-brand-200',
    icon:   'bg-white/15 text-white',
  },
  blue: {
    wrap:   'border-l-[3px] border-l-blue-400',
    label:  'text-blue-600',
    val:    'text-ink-900',
    sub:    'text-ink-400',
    icon:   'bg-blue-50 text-blue-500',
  },
  amber: {
    wrap:   'border-l-[3px] border-l-amber-400',
    label:  'text-amber-600',
    val:    'text-ink-900',
    sub:    'text-ink-400',
    icon:   'bg-amber-50 text-amber-500',
  },
  violet: {
    wrap:   'border-l-[3px] border-l-violet-400',
    label:  'text-violet-600',
    val:    'text-ink-900',
    sub:    'text-ink-400',
    icon:   'bg-violet-50 text-violet-500',
  },
};

export default function StatsCard({ title, value, sub, icon: Icon, trend, trendLabel, variant = 'blue', monoValue = false }) {
  const v = VARIANTS[variant] || VARIANTS.blue;
  const animatedValue = useCountUp(value);
  const isPos = parseFloat(trend) > 0;
  const isNeg = parseFloat(trend) < 0;

  return (
    <div className={cn('card p-5 hover:shadow-card-hover transition-all duration-300', v.wrap)}>
      <div className="flex items-start justify-between mb-3">
        <p className={cn('text-[11px] font-semibold uppercase tracking-widest', v.label)}>{title}</p>
        {Icon && (
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', v.icon)}>
            <Icon className="w-[17px] h-[17px]" />
          </div>
        )}
      </div>

      <p className={cn(
        'text-[1.55rem] font-bold tracking-tight leading-none mb-1.5',
        monoValue ? 'font-mono tabular-nums' : 'font-heading',
        v.val
      )}>
        {animatedValue}
      </p>

      {sub && <p className={cn('text-xs', v.sub)}>{sub}</p>}

      {trend !== undefined && trend !== null && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className={cn(
            'stat-pill',
            isPos ? 'bg-red-100 text-red-600' : isNeg ? 'bg-emerald-100 text-emerald-700' : 'bg-paper-300 text-ink-500'
          )}>
            {isPos ? <TrendingUp className="w-3 h-3" /> : isNeg ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(parseFloat(trend))}%
          </span>
          {trendLabel && <span className={cn('text-xs', v.sub)}>{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
