import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Table2, Settings, Leaf, PiggyBank, Users, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLE_RANK = { member: 1, finance: 2, admin: 3, owner: 4 };

const nav = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload',  icon: PlusCircle,      label: 'Add Expense' },
  { to: '/records', icon: Table2,          label: 'Records' },
  { to: '/savings', icon: PiggyBank,       label: 'Savings' },
  { to: '/settings',icon: Settings,        label: 'Settings' },
  { to: '/members', icon: Users,           label: 'Members',  minRole: 'admin' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const userRole = user?.role || 'member';

  const visibleNav = nav.filter(item =>
    !item.minRole || (ROLE_RANK[userRole] || 0) >= (ROLE_RANK[item.minRole] || 0)
  );

  return (
    <aside className="w-64 min-h-screen flex flex-col flex-shrink-0 bg-[#0d1117] border-r border-white/[0.06]">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11">
            <div className="absolute inset-0 bg-brand-500 rounded-full opacity-25 blur-md" />
            <div className="relative w-11 h-11 bg-gradient-to-br from-brand-400 to-brand-600 rounded-full flex items-center justify-center shadow-glow-sm ring-1 ring-white/10">
              <Leaf className="w-[22px] h-[22px] text-white" strokeWidth={2.2} />
            </div>
          </div>
          <div className="leading-none">
            <p className="text-white font-bold text-[19px] font-heading tracking-tight lowercase">{user?.org_name?.toLowerCase() || 'agthia'}</p>
            <p className="text-brand-400 text-[10px] font-semibold tracking-[0.2em] uppercase mt-1">Petty Cash</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-0.5">
        <p className="text-white/20 text-[10px] font-bold uppercase tracking-[0.15em] px-3 mb-3">Menu</p>
        {visibleNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/40 hover:bg-white/[0.04] hover:text-white/80'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-400 rounded-r-full" />
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  isActive ? 'bg-brand-500/20' : 'group-hover:bg-white/[0.06]'
                }`}>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : ''}`} />
                </div>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-3 pb-3 border-t border-white/[0.06] pt-3">
        {user && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl">
            <div className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-xs font-bold flex-shrink-0">
              {user.full_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-xs font-medium truncate">{user.full_name}</p>
              <p className="text-white/30 text-[10px] truncate capitalize">{user.role}</p>
            </div>
            <button onClick={logout} className="text-white/20 hover:text-white/60 transition-colors p-1" title="Sign out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/[0.06]">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-brand-500/10 border border-brand-500/20 rounded text-brand-400 text-[10px] font-mono font-medium">
          v1.8.0
        </span>
      </div>
    </aside>
  );
}
