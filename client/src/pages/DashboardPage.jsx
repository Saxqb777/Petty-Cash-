import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DollarSign, Calendar, BarChart2, Plus, RefreshCw, ArrowRight, AlertTriangle } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import CategoryDonutChart from '../components/CategoryDonutChart';
import MonthlyBarChart from '../components/MonthlyBarChart';
import RecentTransactions from '../components/RecentTransactions';
import SpendHeatmap from '../components/SpendHeatmap';
import { api } from '../utils/api';

const fmt = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

// 120ms, ease-out, opacity + 4px. No spring, no bounce, no scale.
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } }
};
const item = {
  hidden: { opacity: 0, y: 4 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.12, ease: 'easeOut' } }
};

/* A plate with an ink rule under its title bar. The one container shape on
   this page — everything else is flat type on paper. */
function Panel({ title, note, action, children, className = '' }) {
  return (
    <section className={`plate ${className}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b-2 border-ink-900">
        <div className="min-w-0">
          <h2 className="text-base w-wide text-ink-900 truncate">{title}</h2>
          {note && <p className="meta mt-0.5 truncate">{note}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setStats(await api.getDashboard()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const now = new Date();
  const monthName = now.toLocaleDateString('en-AE', { month: 'long', year: 'numeric' });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6 pb-4 border-b-2 border-ink-900"
      >
        <div>
          <h1 className="display text-3xl text-ink-900">Dashboard</h1>
          <p className="meta mt-1.5 uppercase">{monthName}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost btn-sm">
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} /> Refresh
          </button>
          <button onClick={() => navigate('/upload')} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Add Expense
          </button>
        </div>
      </motion.div>

      {error && (
        <div className="mb-5 px-4 py-3 bg-flare-50 border-2 border-flare-700 text-sm text-flare-700">{error}</div>
      )}

      {/* KPI row — one object, three fills, one size */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          <motion.div variants={item}>
            <StatsCard
              title="Total Petty Cash Spent"
              value={`AED ${fmt(stats?.totalSpent)}`}
              sub={`${stats?.totalCount || 0} transactions across all time`}
              icon={DollarSign}
              variant="default"
              monoValue
            />
          </motion.div>
          <motion.div variants={item}>
            <StatsCard
              title="This Month"
              value={`AED ${fmt(stats?.thisMonthTotal)}`}
              sub={`vs AED ${fmt(stats?.lastMonthTotal)} last month`}
              icon={Calendar}
              trend={stats?.monthChange}
              trendLabel="vs last month"
              variant="blue"
              monoValue
            />
          </motion.div>
          <motion.div variants={item}>
            <StatsCard
              title="Avg Transaction"
              value={`AED ${fmt(stats?.avgTransaction)}`}
              sub="Per expense entry"
              icon={BarChart2}
              variant="default"
              monoValue
            />
          </motion.div>
        </motion.div>
      )}

      {/* Needs-review alert — second plate, ink text on flare */}
      {!loading && stats?.needsReviewCount > 0 && (
        <button
          onClick={() => navigate('/records')}
          className="w-full mb-5 flex items-center gap-3 px-4 py-3 bg-flare-500 border-2 border-ink-900 text-ink-900 text-left transition-colors duration-[120ms] hover:bg-flare-600"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} />
          <p className="text-sm font-bold">
            {stats.needsReviewCount} expense{stats.needsReviewCount > 1 ? 's' : ''} need review: low confidence AI extraction
          </p>
          <ArrowRight className="w-4 h-4 ml-auto flex-shrink-0" strokeWidth={2.5} />
        </button>
      )}

      {/* Charts */}
      <motion.div
        variants={container} initial="hidden" animate="show"
        className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5"
      >
        <motion.div variants={item} className="lg:col-span-3">
          <Panel title="Monthly Spend" note="Last 6 months">
            {loading ? <Skeleton className="h-56" /> : <MonthlyBarChart data={stats?.monthlyTrend || []} />}
          </Panel>
        </motion.div>

        <motion.div variants={item} className="lg:col-span-2">
          <Panel title="By Category" note="Spend distribution">
            {loading ? <Skeleton className="h-56" /> : <CategoryDonutChart data={stats?.categoryBreakdown || []} />}
          </Panel>
        </motion.div>
      </motion.div>

      {/* Savings band — two panels of one rule, green carries the net figure */}
      {!loading && stats && stats.savingsGross > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className="mb-5 border-2 border-ink-900 grid grid-cols-1 sm:grid-cols-2"
        >
          <div className="bg-white px-5 py-4">
            <p className="label">Gross clearance savings</p>
            <p className="font-mono tabular-nums text-2xl leading-none text-ink-900">AED {fmt(stats.savingsGross)}</p>
            <p className="meta mt-1.5">Agent fees avoided</p>
          </div>
          <div className={`px-5 py-4 border-t-2 sm:border-t-0 sm:border-l-2 border-ink-900 ${stats.savingsNet >= 0 ? 'bg-green-500' : 'bg-flare-500'}`}>
            <p className="block text-2xs font-bold uppercase text-ink-900/70 mb-2">Net savings</p>
            <p className="font-mono tabular-nums text-2xl leading-none text-ink-900">
              {stats.savingsNet < 0 ? '-' : ''}AED {fmt(Math.abs(stats.savingsNet))}
            </p>
            <p className="text-xs text-ink-900/70 mt-1.5 font-mono">Gross minus fuel cost</p>
          </div>
        </motion.div>
      )}

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        className="mb-5"
      >
        <Panel
          title="Recent Transactions"
          note="Latest expense activity"
          action={
            <button
              onClick={() => navigate('/records')}
              className="flex items-center gap-1 text-xs font-bold uppercase text-blue-600 hover:text-blue-800 transition-colors duration-[120ms] flex-shrink-0"
            >
              View all <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          }
        >
          {loading
            ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            : <RecentTransactions transactions={stats?.recentTransactions || []} />
          }
        </Panel>
      </motion.div>

      {/* Spend Heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
      >
        <Panel title="Spend Activity" note="Daily expense heatmap, last 12 months">
          {loading ? <Skeleton className="h-24" /> : <SpendHeatmap data={stats?.dailySpend || []} />}
        </Panel>
      </motion.div>
    </div>
  );
}
