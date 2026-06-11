import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DollarSign, Calendar, BarChart2, Plus, RefreshCw, ArrowRight, PiggyBank, TrendingUp, AlertTriangle } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import CategoryDonutChart from '../components/CategoryDonutChart';
import MonthlyBarChart from '../components/MonthlyBarChart';
import RecentTransactions from '../components/RecentTransactions';
import SpendHeatmap from '../components/SpendHeatmap';
import { api } from '../utils/api';

const fmt = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const NUM = 'font-mono tabular-nums';

function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } }
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } }
};

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
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-center justify-between mb-7"
      >
        <div>
          <h1 className="text-2xl font-heading font-bold text-ink-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-ink-400 mt-0.5 font-medium">{monthName}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={() => navigate('/upload')} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </motion.div>

      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>
      )}

      {/* Stats row */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4 mb-5">
          <Skeleton className="col-span-2 h-36" />
          {[0, 1].map(i => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-4 gap-4 mb-5">
          <motion.div variants={item} className="col-span-2">
            <StatsCard
              title="Total Petty Cash Spent"
              value={`AED ${fmt(stats?.totalSpent)}`}
              sub={`${stats?.totalCount || 0} transactions across all time`}
              icon={DollarSign}
              variant="green"
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
              variant="violet"
              monoValue
            />
          </motion.div>
        </motion.div>
      )}

      {/* Charts row */}
      <motion.div
        variants={container} initial="hidden" animate="show"
        className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5"
      >
        <motion.div variants={item} className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-heading font-bold text-ink-800">Monthly Spend</h2>
              <p className="text-xs text-ink-400 mt-0.5">Last 6 months</p>
            </div>
          </div>
          {loading ? <Skeleton className="h-52" /> : <MonthlyBarChart data={stats?.monthlyTrend || []} />}
        </motion.div>

        <motion.div variants={item} className="card p-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-[15px] font-heading font-bold text-ink-800">By Category</h2>
            <p className="text-xs text-ink-400 mt-0.5">Spend distribution</p>
          </div>
          {loading ? <Skeleton className="h-52" /> : <CategoryDonutChart data={stats?.categoryBreakdown || []} />}
        </motion.div>
      </motion.div>

      {/* Needs-review alert */}
      {!loading && stats?.needsReviewCount > 0 && (
        <motion.div variants={item}
          className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => navigate('/records')}>
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {stats.needsReviewCount} expense{stats.needsReviewCount > 1 ? 's' : ''} need review — low-confidence AI extraction
          </p>
          <ArrowRight className="w-4 h-4 text-amber-500 ml-auto" />
        </motion.div>
      )}

      {/* Savings strip */}
      {!loading && stats && stats.savingsGross > 0 && (
        <motion.div variants={item} className="grid grid-cols-2 gap-4 mb-5">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <PiggyBank className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-ink-400 font-medium">Gross Clearance Savings</p>
              <p className={`text-base font-bold text-ink-900 ${NUM}`}>AED {fmt(stats.savingsGross)}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3 border-l-[3px] border-l-brand-500">
            <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-ink-400 font-medium">Net Savings</p>
              <p className={`text-base font-bold ${stats.savingsNet >= 0 ? 'text-brand-700' : 'text-red-600'} ${NUM}`}>AED {fmt(stats.savingsNet)}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recent Transactions */}
      <motion.div
        variants={item} initial="hidden" animate="show"
        className="card p-5 mb-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-heading font-bold text-ink-800">Recent Transactions</h2>
            <p className="text-xs text-ink-400 mt-0.5">Latest expense activity</p>
          </div>
          <button
            onClick={() => navigate('/records')}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-semibold transition-colors"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {loading
          ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          : <RecentTransactions transactions={stats?.recentTransactions || []} />
        }
      </motion.div>

      {/* Spend Heatmap */}
      <motion.div variants={item} initial="hidden" animate="show" className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-heading font-bold text-ink-800">Spend Activity</h2>
            <p className="text-xs text-ink-400 mt-0.5">Daily expense heatmap — last 12 months</p>
          </div>
        </div>
        {loading
          ? <Skeleton className="h-20" />
          : <SpendHeatmap data={stats?.dailySpend || []} />
        }
      </motion.div>
    </div>
  );
}
