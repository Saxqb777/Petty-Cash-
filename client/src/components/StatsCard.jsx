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
    wrap:  'bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 text-white border-0',
    label: 'text-brand-200',
    val:   'text-white',
    sub:   'text-brand-200/80',
    icon:  'bg-white/15 text-white',
    pat:   true,
  },
  blue: {
    wrap:  'bg-white',
    label: 'text-blue-500',
    val:   'text-slate-900',
    sub:   'text-slate-400',
    icon:  'bg-blue-50 text-blue-500',
    accent: 'border-t-2 border-t-blue-400',
  },
  amber: {
    wrap:  'bg-white',
    label: 'text-amber-500',
    val:   'text-slate-900',
    sub:   'text-slate-400',
    icon:  'bg-amber-50 text-amber-500',
    accent: 'border-t-2 border-t-amber-400',
  },
  violet: {
    wrap:  'bg-white',
    label: 'text-violet-500',
    val:   'text-slate-900',
    sub:   'text-slate-400',
    icon:  'bg-violet-50 text-violet-500',
    accent: 'border-t-2 border-t-violet-400',
  },
};

export default function StatsCard({ title, value, sub, icon: Icon, trend, trendLabel, variant = 'blue', monoValue = false }) {
  const v = VARIANTS[variant] || VARIANTS.blue;
  const animatedValue = useCountUp(value);
  const isPos = parseFloat(trend) > 0;
  const isNeg = parseFloat(trend) < 0;

  return (
    <div className={cn(
      'card p-5 hover:shadow-card-hover transition-all duration-300 relative overflow-hidden',
      v.wrap, v.accent
    )}>
      {v.pat && (
        <div className="absolute inset-0 bg-dots-pattern opacity-100 pointer-events-none" />
      )}
      {variant === 'green' && (
        <>
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full pointer-events-none" />
          <div className="absolute -bottom-10 -right-4 w-24 h-24 bg-white/5 rounded-full pointer-events-none" />
        </>
      )}

      <div className="relative flex items-start justify-between mb-3">
        <p className={cn('text-xs font-semibold uppercase tracking-widest', v.label)}>{title}</p>
        {Icon && (
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', v.icon)}>
            <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
          </div>
        )}
      </div>

      <p className={cn('text-[1.6rem] font-bold tracking-tight leading-none mb-1.5 relative', monoValue ? 'font-mono tabular-nums' : 'font-heading', v.val)}>
        {animatedValue}
      </p>

      {sub && <p className={cn('text-xs relative', v.sub)}>{sub}</p>}

      {trend !== undefined && trend !== null && (
        <div className="mt-2.5 flex items-center gap-1.5 relative">
          <span className={cn(
            'stat-pill',
            isPos ? 'bg-red-100 text-red-600' : isNeg ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
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
