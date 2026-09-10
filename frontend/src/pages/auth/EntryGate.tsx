import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Monitor } from 'lucide-react';

/**
 * IDentix Entry Gate — Root landing page.
 * Shows two separated paths: Authorized Officer and Public Kiosk.
 * Does NOT mix officer and traveller controls on the same screen.
 */
export const EntryGate: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      {/* Brand */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">IDentix</span>
        </div>
        <p className="text-slate-400 text-sm">Identity & Document Screening</p>
      </div>

      {/* Two entry paths */}
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Officer path */}
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="group flex flex-col items-center justify-center gap-4 p-8 bg-white rounded-2xl border-2 border-transparent hover:border-blue-500 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer text-left"
        >
          <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
            <Shield className="w-7 h-7 text-blue-400 group-hover:text-white transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-900 mb-1">Authorized Officer</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Checkpoint officer and administration login. Requires Badge ID, password, and biometric verification.
            </p>
          </div>
          <div className="text-xs font-semibold text-blue-600 group-hover:underline">
            Officer Login →
          </div>
        </button>

        {/* Kiosk path */}
        <button
          type="button"
          onClick={() => navigate('/kiosk')}
          className="group flex flex-col items-center justify-center gap-4 p-8 bg-emerald-900/30 border-2 border-emerald-700/40 rounded-2xl hover:border-emerald-400 hover:bg-emerald-900/50 transition-all duration-200 cursor-pointer"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-800 flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
            <Monitor className="w-7 h-7 text-emerald-300" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white mb-1">Traveller Kiosk</p>
            <p className="text-xs text-emerald-300 leading-relaxed">
              Self-service document screening for travellers. No account or login required.
            </p>
          </div>
          <div className="text-xs font-semibold text-emerald-400 group-hover:underline">
            Start →
          </div>
        </button>
      </div>

      <p className="text-slate-600 text-xs mt-10 text-center max-w-sm">
        IDentix is an offline-capable checkpoint screening platform. All processing is performed locally.
      </p>
    </div>
  );
};
