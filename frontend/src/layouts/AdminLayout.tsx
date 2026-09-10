import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Sliders,
  Users,
  Database,
  FileCheck2,
  Cpu,
  RefreshCw,
  ScrollText,
  Activity,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  LogOut,
  ArrowLeft
} from 'lucide-react';
import { clsx } from 'clsx';
import { NetworkStatusBadge } from '../components/common/NetworkStatusBadge';
import { useAuth } from '../context/AuthContext';

export const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { state: authState, logout } = useAuth();

  const adminNavItems = [
    { name: 'Overview', path: '/admin/overview', icon: Sliders },
    { name: 'Users & Roles', path: '/admin/users', icon: Users },
    { name: 'Watchlist Management', path: '/admin/watchlist', icon: Database },
    { name: 'Document Rules', path: '/admin/rules', icon: FileCheck2 },
    { name: 'AI Settings', path: '/admin/ai-settings', icon: Cpu },
    { name: 'Offline Sync', path: '/admin/sync', icon: RefreshCw },
    { name: 'Audit Logs', path: '/admin/audit', icon: ScrollText },
    { name: 'System Health', path: '/admin/health', icon: Activity },
  ];

  const officer = authState.officer;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between z-20 sticky top-0 shadow-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-950 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 tracking-tight">
                  IDentix
                </span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  Administration
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium tracking-wide">
                Identity & Document Screening
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/officer/dashboard')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Officer Operations</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <NetworkStatusBadge />

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2 pl-1">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
              {officer?.badgeId?.substring(0, 2) || 'AD'}
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                <span>{officer?.fullName || 'Administrator'}</span>
                <ShieldCheck className="w-3 h-3 text-amber-600" />
              </div>
              <p className="text-[10px] text-slate-500 font-mono">Role: {officer?.role || 'ADMIN'}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Admin Content */}
      <div className="flex-1 flex">
        <aside
          className={clsx(
            'bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-200 z-10 select-none',
            collapsed ? 'w-16' : 'w-64'
          )}
        >
          <div className="p-3 space-y-1">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path === '/admin/overview' && location.pathname === '/admin');

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative',
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon
                    className={clsx(
                      'w-4 h-4 shrink-0 transition-colors',
                      isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-800'
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </NavLink>
              );
            })}
          </div>

          <div className="p-3 border-t border-slate-100 flex items-center justify-between">
            {!collapsed && (
              <div className="text-[11px] text-slate-500 px-1 font-mono">
                Admin Console
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer ml-auto"
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
