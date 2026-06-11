import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Table2, Settings, PiggyBank, Users, LogOut, Layers, Building2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLE_RANK = { member: 1, finance: 2, admin: 3, owner: 4 };

const nav = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload',       icon: PlusCircle,      label: 'Add Expense' },
  { to: '/records',      icon: Table2,          label: 'Records' },
  { to: '/savings',      icon: PiggyBank,       label: 'Savings' },
  { to: '/settings',     icon: Settings,        label: 'Settings' },
  { to: '/members',      icon: Users,           label: 'Members',      minRole: 'admin' },
  { to: '/type-builder', icon: Layers,          label: 'Expense Types', minRole: 'admin' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const userRole = user?.role || 'member';

  const visibleNav = nav.filter(item =>
    !item.minRole || (ROLE_RANK[userRole] || 0) >= (ROLE_RANK[item.minRole] || 0)
  );

  const isSuperadmin = !!user?.is_superadmin;

  return (
    <aside className="w-60 min-h-screen flex flex-col flex-shrink-0 bg-paper-200 border-r border-paper-400">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 border-b border-paper-400">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[13px] font-bold font-heading tracking-tight">DL</span>
          </div>
          <span className="text-ink-900 font-heading font-bold text-[17px] tracking-tight">Doc Ledger</span>
        </div>
        {user?.org_name && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-paper-300 border border-paper-400 rounded text-[11px] font-medium text-ink-500">
            <Building2 className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{user.org_name}</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {isSuperadmin && (
          <NavLink
            to="/platform"
            className={({ isActive }) =>
              `relative flex items-center gap-2.5 px-3 py-2 mb-1 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-violet-50 border border-violet-200 text-violet-700'
                  : 'bg-paper-300/60 border border-paper-400 text-ink-700 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700'
              }`
            }
          >
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            Platform
            <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-violet-600">Owner</span>
          </NavLink>
        )}
        {visibleNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-white border border-paper-400 shadow-card text-ink-900'
                  : 'text-ink-500 hover:bg-paper-300 hover:text-ink-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-brand-500 rounded-r-full" />
                )}
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-brand-600' : 'text-ink-400'}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-3 pb-3 border-t border-paper-400 pt-3">
        {user && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
              {user.full_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-ink-800 text-xs font-semibold truncate">{user.full_name}</p>
              <p className="text-ink-400 text-[10px] truncate capitalize">{user.role}</p>
            </div>
            <button onClick={logout} className="text-ink-300 hover:text-ink-700 transition-colors p-1 rounded" title="Sign out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-paper-400">
        <span className="text-ink-300 text-[10px] font-mono">v2.0.0</span>
      </div>
    </aside>
  );
}
