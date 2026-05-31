import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Calendar, Tag, BarChart2, Plus, RefreshCw } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import CategoryDonutChart from '../components/CategoryDonutChart';
import MonthlyBarChart from '../components/MonthlyBarChart';
import RecentTransactions from '../components/RecentTransactions';
import { api } from '../utils/api';

const fmt = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

function Skeleton({ className = '' }) {
  return <div className={`bg-gray-100 animate-pulse rounded-lg ${className}`} />;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getDashboard();
      setStats(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const now = new Date();
  const monthName = now.toLocaleDateString('en-AE', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{monthName} · Petty Cash Overview</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button onClick={() => navigate('/upload')} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatsCard
              title="Total Spent"
              value={`AED ${fmt(stats?.totalSpent)}`}
              sub={`${stats?.totalCount || 0} transactions`}
              icon={DollarSign}
              accent
            />
            <StatsCard
              title="This Month"
              value={`AED ${fmt(stats?.thisMonthTotal)}`}
              sub={`vs AED ${fmt(stats?.lastMonthTotal)} last month`}
              icon={Calendar}
              trend={stats?.monthChange}
              trendLabel="vs last month"
            />
            <StatsCard
              title="Top Category"
              value={stats?.topCategory?.category || '—'}
              sub={stats?.topCategory ? `AED ${fmt(stats.topCategory.total)}` : 'No data'}
              icon={Tag}
            />
            <StatsCard
              title="Avg Transaction"
              value={`AED ${fmt(stats?.avgTransaction)}`}
              sub="Per expense entry"
              icon={BarChart2}
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Monthly Trend */}
        <div className="card p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly Spend Trend</h2>
          {loading ? <Skeleton className="h-48" /> : <MonthlyBarChart data={stats?.monthlyTrend || []} />}
        </div>

        {/* Category Breakdown */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">By Category</h2>
          {loading ? <Skeleton className="h-48" /> : <CategoryDonutChart data={stats?.categoryBreakdown || []} />}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Recent Transactions</h2>
          <button onClick={() => navigate('/records')} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
            View all →
          </button>
        </div>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 mb-2" />)
          : <RecentTransactions transactions={stats?.recentTransactions || []} />
        }
      </div>
    </div>
  );
}
