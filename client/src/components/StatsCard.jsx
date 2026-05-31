export default function StatsCard({ title, value, sub, icon: Icon, trend, trendLabel, accent = false }) {
  const isPositive = parseFloat(trend) > 0;
  const isNegative = parseFloat(trend) < 0;

  return (
    <div className={`card p-5 hover:shadow-card-hover transition-shadow duration-200 ${accent ? 'border-brand-200 bg-gradient-to-br from-brand-600 to-brand-700' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <p className={`text-xs font-semibold uppercase tracking-wider ${accent ? 'text-brand-200' : 'text-gray-500'}`}>
          {title}
        </p>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? 'bg-brand-500/40' : 'bg-brand-50'}`}>
            <Icon className={`w-4 h-4 ${accent ? 'text-brand-200' : 'text-brand-600'}`} />
          </div>
        )}
      </div>

      <p className={`text-2xl font-bold tracking-tight ${accent ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </p>

      {sub && (
        <p className={`text-xs mt-1 ${accent ? 'text-brand-200' : 'text-gray-500'}`}>{sub}</p>
      )}

      {trend !== undefined && trend !== null && (
        <div className="mt-2 flex items-center gap-1">
          <span className={`text-xs font-medium ${
            isPositive ? 'text-red-500' : isNegative ? 'text-green-500' : 'text-gray-400'
          }`}>
            {isPositive ? '↑' : isNegative ? '↓' : '→'} {Math.abs(parseFloat(trend))}%
          </span>
          {trendLabel && (
            <span className={`text-xs ${accent ? 'text-brand-300' : 'text-gray-400'}`}>{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
