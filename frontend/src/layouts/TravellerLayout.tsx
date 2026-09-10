import React from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Smartphone,
  FolderLock,
  UploadCloud,
  BellRing,
  FileCheck,
  QrCode,
  Lock,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { clsx } from 'clsx';

export const TravellerLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const vaultNav = [
    { name: 'Vault Home', path: '/vault', icon: FolderLock },
    { name: 'My Documents', path: '/vault/documents', icon: FileCheck },
    { name: 'Upload Document', path: '/vault/upload', icon: UploadCloud },
    { name: 'Renewal Reminder', path: '/vault/reminders', icon: BellRing },
    { name: 'Consent & Privacy', path: '/vault/consent', icon: Lock },
    { name: 'Join QR Session', path: '/vault/join', icon: QrCode, highlight: true },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between z-20 sticky top-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-xs">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 tracking-tight">
                IDentix
              </span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Traveller Mobile Vault
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium tracking-wide">
              Secure Document Transfer
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/kiosk')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kiosk Screen</span>
        </button>
      </header>

      {/* Security Disclaimer Banner */}
      <div className="bg-blue-50/70 border-b border-blue-100 px-4 py-2.5 text-xs text-blue-900 flex items-center justify-center gap-2">
        <AlertCircle className="w-4 h-4 text-blue-700 shrink-0" />
        <span>
          <strong>Checkpoint Privacy Notice:</strong> IDentix Vault enables secure document transfer during checkpoint clearance. Live biometric verification is always performed in person by border officers.
        </span>
      </div>

      {/* Body Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-6">
        {/* Navigation Sidebar/Pills */}
        <nav className="w-full md:w-56 shrink-0 space-y-1">
          {vaultNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/vault'}
                className={clsx(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : item.highlight
                    ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100/70 border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                )}
              >
                <Icon
                  className={clsx(
                    'w-4 h-4 shrink-0',
                    isActive ? 'text-white' : item.highlight ? 'text-emerald-700' : 'text-slate-500'
                  )}
                />
                <span>{item.name}</span>
                {item.highlight && !isActive && (
                  <span className="ml-auto text-[10px] uppercase font-bold bg-emerald-200 text-emerald-800 px-1 rounded">
                    Checkpoint
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Content View */}
        <main className="flex-1 bg-white rounded-xl border border-slate-200 p-6 shadow-xs min-h-[500px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
