import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Upload, FileText, TrendingUp, Wallet } from 'lucide-react';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload', icon: Upload, label: 'Add Expense' },
  { to: '/records', icon: FileText, label: 'Records' },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-brand-900 min-h-screen flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-brand-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center shadow-sm">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight tracking-tight">Agthia</p>
            <p className="text-brand-400 text-xs font-medium tracking-wide">Petty Cash</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-0.5">
        <p className="text-brand-600 text-xs font-semibold uppercase tracking-widest px-3 mb-3">Menu</p>
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'text-brand-300 hover:bg-brand-800 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-brand-300' : ''}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-brand-800">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-brand-500" />
          <p className="text-brand-500 text-xs">© 2026 Agthia Group</p>
        </div>
      </div>
    </aside>
  );
}
