import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  PlusCircle,
  History,
  AlertTriangle,
  FileText,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Building2,
  LogOut,
  Sliders,
  FlaskConical
} from 'lucide-react';
import { clsx } from 'clsx';
import { NetworkStatusBadge } from '../components/common/NetworkStatusBadge';
import { useAuth } from '../context/AuthContext';
import { useScreening } from '../context/ScreeningContext';
import { KioskControls } from '../components/screening/KioskControls';
import { ExitConfirmModal } from '../components/screening/ExitConfirmModal';

export const OfficerLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { state: authState, logout } = useAuth();
  const { state: screeningState, isLocked, cancelExit, confirmExit } = useScreening();

  const navigationItems = [
    { name: 'Dashboard', path: '/officer/dashboard', icon: LayoutDashboard },
    { name: 'New Screening', path: '/officer/screening/new', icon: PlusCircle, highlight: true },
    { name: 'Screening History', path: '/officer/screenings', icon: History },
    { name: 'Alerts', path: '/officer/alerts', icon: AlertTriangle },
    { name: 'Documents', path: '/officer/documents', icon: FileText },
    { name: 'Analytics', path: '/officer/analytics', icon: BarChart3 },
    { name: 'Demo Lab', path: '/officer/demo', icon: FlaskConical },
    { name: 'Settings', path: '/officer/settings', icon: Settings },
  ];

  const officer = authState.officer;
  const isKioskModeActive = isLocked;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Exit Confirmation Modal */}
      <ExitConfirmModal
        isOpen={screeningState.showExitConfirm}
        isProcessing={screeningState.phase === 'SCREENING_PROCESSING'}
        caseId={screeningState.active?.caseId}
        onKeep={cancelExit}
        onConfirm={() => confirmExit(() => navigate('/officer/dashboard'))}
      />

      {/* Top Navigation Bar */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between z-20 sticky top-0 shadow-xs">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 tracking-tight">
                  IDentix
                </span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {isKioskModeActive ? 'Active Screening Kiosk' : 'Officer Operations'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium tracking-wide">
                Identity & Document Screening
              </p>
            </div>
          </div>

          <div className="hidden lg:block h-6 w-px bg-slate-200" />

          {/* Station / Booth Indicator */}
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 bg-slate-100/70 px-2.5 py-1 rounded-md border border-slate-200">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Station: <strong className="text-slate-800 font-semibold">T2-CP-04B</strong> (Checkpoint Alpha)</span>
          </div>
        </div>

        {/* Right Header Items */}
        <div className="flex items-center gap-3">
          {/* When screening is active, show Kiosk Controls */}
          {isKioskModeActive ? (
            <KioskControls />
          ) : (
            <>
              {/* Admin Console shortcut for authorized roles */}
              {(officer?.role === 'ADMIN' || officer?.role === 'SUPERVISOR') && (
                <button
                  type="button"
                  onClick={() => navigate('/admin/overview')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Switch to Administration Console"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-600" />
                  <span>Admin Console</span>
                </button>
              )}

              <NetworkStatusBadge />

              <div className="h-6 w-px bg-slate-200 hidden sm:block" />

              {/* Active Officer Identity Badge */}
              <div className="flex items-center gap-2 pl-1">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-semibold">
                  {officer?.badgeId?.substring(0, 2) || 'OF'}
                </div>
                <div className="hidden xl:block text-left">
                  <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                    <span>{officer?.fullName || 'Authenticated Officer'}</span>
                    <UserCheck className="w-3 h-3 text-emerald-600" />
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">Badge #{officer?.badgeId || '—'}</p>
                </div>
              </div>

              {/* Explicit Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors ml-1"
                title="Log Out (End Authenticated Session)"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Body with Collapsible Sidebar (HIDDEN during active screening!) */}
      <div className="flex-1 flex">
        {!isKioskModeActive && (
          <aside
            className={clsx(
              'bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-200 z-10 select-none',
              collapsed ? 'w-16' : 'w-60'
            )}
          >
            {/* Navigation Links */}
            <div className="p-3 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || (item.path === '/officer/dashboard' && location.pathname === '/officer');

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative',
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : item.highlight
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100/70 border border-blue-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <Icon
                      className={clsx(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive
                          ? 'text-white'
                          : item.highlight
                          ? 'text-blue-700'
                          : 'text-slate-500 group-hover:text-slate-800'
                      )}
                    />
                    {!collapsed && (
                      <span className="truncate">{item.name}</span>
                    )}
                    {item.highlight && !collapsed && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </NavLink>
                );
              })}
            </div>

            {/* Sidebar Footer / Collapse Button */}
            <div className="p-3 border-t border-slate-100 flex items-center justify-between">
              {!collapsed && (
                <div className="text-[11px] text-slate-500 px-1 font-mono">
                  v1.0.0-PROD
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
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
