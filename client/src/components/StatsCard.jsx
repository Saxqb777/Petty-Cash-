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

// Four tiles, one per ink plus the paper default.
// On flare-500 and green-500 the text is ink-900 — white on those fills fails.
const VARIANTS = {
  // White field inside a 2px ink rule.
  default: {
    wrap:  'bg-white border-ink-900',
    label: 'text-ink-500',
    val:   'text-ink-900',
    sub:   'text-ink-400',
    icon:  'border-ink-900 text-ink-900',
    up:    'text-flare-700',
    down:  'text-green-700',
    flat:  'text-ink-500',
  },
  blue: {
    wrap:  'bg-blue-600 border-blue-600',
    label: 'text-white/75',
    val:   'text-white',
    sub:   'text-blue-200',
    icon:  'border-white/45 text-white',
    up:    'text-white',
    down:  'text-white',
    flat:  'text-blue-200',
  },
  flare: {
    wrap:  'bg-flare-500 border-flare-500',
    label: 'text-ink-900',
    val:   'text-ink-900',
    sub:   'text-ink-800',
    icon:  'border-ink-900 text-ink-900',
    up:    'text-ink-900',
    down:  'text-ink-900',
    flat:  'text-ink-800',
  },
  green: {
    wrap:  'bg-green-500 border-green-500',
    label: 'text-ink-900',
    val:   'text-ink-900',
    sub:   'text-ink-800',
    icon:  'border-ink-900 text-ink-900',
    up:    'text-ink-900',
    down:  'text-ink-900',
    flat:  'text-ink-800',
  },
};

// Legacy variant names from the previous design system, kept so existing call
// sites keep rendering. `amber`/`violet` had no counterpart ink.
const ALIASES = { amber: 'flare', violet: 'default', white: 'default', plate: 'default' };

export default function StatsCard({ title, value, sub, icon: Icon, trend, trendLabel, variant = 'default', monoValue = false }) {
  const v = VARIANTS[ALIASES[variant] || variant] || VARIANTS.default;
  const animatedValue = useCountUp(value);
  const isPos = parseFloat(trend) > 0;
  const isNeg = parseFloat(trend) < 0;

  return (
    <div className={cn('h-full p-5 border-2', v.wrap)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className={cn('label mb-0', v.label)}>{title}</p>
        {Icon && (
          <div className={cn('w-8 h-8 border-2 flex items-center justify-center flex-shrink-0', v.icon)}>
            <Icon className="w-4 h-4" strokeWidth={2.25} />
          </div>
        )}
      </div>

      <p className={cn(
        'display w-wider text-2xl sm:text-3xl mb-2',
        // Fragment Mono is single weight — never bold it.
        monoValue && 'font-mono font-normal tracking-normal',
        v.val
      )}>
        {animatedValue}
      </p>

      {sub && <p className={cn('text-sm', v.sub)}>{sub}</p>}

      {trend !== undefined && trend !== null && (
        <div className="mt-3 flex items-center gap-1.5 font-mono text-xs">
          <span className={cn('inline-flex items-center gap-1', isPos ? v.up : isNeg ? v.down : v.flat)}>
            {isPos ? <TrendingUp className="w-3.5 h-3.5" strokeWidth={2.25} />
              : isNeg ? <TrendingDown className="w-3.5 h-3.5" strokeWidth={2.25} />
              : <Minus className="w-3.5 h-3.5" strokeWidth={2.25} />}
            {Math.abs(parseFloat(trend))}%
          </span>
          {trendLabel && <span className={v.sub}>{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
