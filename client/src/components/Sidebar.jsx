import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Table2, Settings, PiggyBank, Users, LogOut, Layers, Building2, ShieldAlert, Menu, X, BookOpen } from 'lucide-react';
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
  // Everyone, and last: it is reference, not a place you work.
  { to: '/guide',        icon: BookOpen,        label: 'How to use' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const userRole = user?.role || 'member';

  const visibleNav = nav.filter(item =>
    !item.minRole || (ROLE_RANK[userRole] || 0) >= (ROLE_RANK[item.minRole] || 0)
  );

  const isSuperadmin = !!user?.is_superadmin;

  // Close the drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const navItemClass = ({ isActive }) =>
    `relative flex items-center gap-2.5 pl-4 pr-3 py-2.5 text-sm font-bold transition-colors duration-[120ms] ${
      isActive ? 'bg-white text-blue-600' : 'text-blue-200 hover:bg-blue-700 hover:text-white'
    }`;

  const panel = (
    <div className="flex flex-col h-full bg-blue-600">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 border-b-2 border-blue-500">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 bg-flare-500 flex items-center justify-center flex-shrink-0">
            <span className="text-ink-900 text-sm font-extrabold w-wide">DL</span>
          </div>
          <span className="text-white font-extrabold text-lg w-wide tracking-tight">Doc Ledger</span>
        </div>
        {user?.org_name && (
          <div className="flex items-center gap-1.5 px-2 py-1 border border-blue-400 font-mono text-2xs uppercase text-blue-200">
            <Building2 className="w-3 h-3 flex-shrink-0" strokeWidth={2.25} />
            <span className="truncate">{user.org_name}</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {isSuperadmin && (
          <div className="px-3 pb-3">
            <NavLink
              to="/platform"
              className={({ isActive }) =>
                `relative flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold border-2 border-flare-500 transition-colors duration-[120ms] ${
                  isActive
                    ? 'bg-flare-500 text-ink-900'
                    : 'bg-transparent text-white hover:bg-flare-500 hover:text-ink-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" strokeWidth={2.25} />
                  Platform
                  <span className={`ml-auto font-mono text-2xs uppercase ${isActive ? 'text-ink-900' : 'text-flare-300'}`}>
                    Owner
                  </span>
                </>
              )}
            </NavLink>
          </div>
        )}

        {visibleNav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} className={navItemClass}>
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-flare-500" />}
                <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2.25} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      {user && (
        <div className="border-t-2 border-blue-500 px-3 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-white flex items-center justify-center text-blue-600 font-mono text-sm flex-shrink-0">
              {user.full_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold truncate leading-tight">{user.full_name}</p>
              <p className="font-mono text-2xs uppercase text-blue-200 truncate">{user.role}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 text-blue-200 hover:text-ink-900 hover:bg-flare-500 transition-colors duration-[120ms]"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t-2 border-blue-500 px-4 py-2.5">
        <span className="font-mono text-2xs text-blue-200">v2.0.0</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Narrow screens: fixed bar + drawer */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-blue-600 border-b-2 border-ink-900 flex items-center gap-2.5 px-3">
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 flex items-center justify-center text-white hover:bg-blue-700 transition-colors duration-[120ms]"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" strokeWidth={2.25} />
        </button>
        <div className="w-7 h-7 bg-flare-500 flex items-center justify-center flex-shrink-0">
          <span className="text-ink-900 text-xs font-extrabold w-wide">DL</span>
        </div>
        <span className="text-white font-extrabold text-base w-wide tracking-tight">Doc Ledger</span>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-ink-900/30 animate-fade-in" onClick={() => setOpen(false)} />
          <div className="relative w-60 max-w-[85vw] h-full border-r-2 border-ink-900 animate-fade-in">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 z-10 w-7 h-7 flex items-center justify-center text-white hover:bg-flare-500 hover:text-ink-900 transition-colors duration-[120ms]"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" strokeWidth={2.25} />
            </button>
            {panel}
          </div>
        </div>
      )}

      {/* Wide screens: the standing blue field */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 flex-col sticky top-0 h-screen border-r-2 border-ink-900">
        {panel}
      </aside>
    </>
  );
}
