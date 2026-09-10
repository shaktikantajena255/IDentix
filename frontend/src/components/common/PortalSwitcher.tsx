import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Settings, Smartphone } from 'lucide-react';
import { clsx } from 'clsx';

export const PortalSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isOfficer = location.pathname.startsWith('/officer') || location.pathname === '/';
  const isAdmin = location.pathname.startsWith('/admin');
  const isVault = location.pathname.startsWith('/vault');

  return (
    <div className="flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200">
      <button
        onClick={() => navigate('/officer')}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer',
          isOfficer
            ? 'bg-white text-slate-900 shadow-xs font-semibold'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
        )}
      >
        <Shield className="w-3.5 h-3.5 text-blue-700" />
        <span>Officer Portal</span>
      </button>

      <button
        onClick={() => navigate('/admin')}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer',
          isAdmin
            ? 'bg-white text-slate-900 shadow-xs font-semibold'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
        )}
      >
        <Settings className="w-3.5 h-3.5 text-slate-700" />
        <span>Admin Portal</span>
      </button>

      <button
        onClick={() => navigate('/vault')}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer',
          isVault
            ? 'bg-white text-slate-900 shadow-xs font-semibold'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
        )}
      >
        <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
        <span>Traveller Vault</span>
      </button>
    </div>
  );
};
