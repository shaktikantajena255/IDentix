import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, ArrowRight, ShieldCheck, QrCode, FileText, Sparkles, Volume2 } from 'lucide-react';
import { Badge } from '../../components/common/Badge';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'fr', label: 'Français', native: 'Français' },
  { code: 'es', label: 'Español', native: 'Español' },
  { code: 'de', label: 'Deutsch', native: 'Deutsch' },
  { code: 'ar', label: 'العربية', native: 'العربية', dir: 'rtl' },
  { code: 'zh', label: '中文', native: '简体中文' },
];

export const KioskWelcome: React.FC = () => {
  const navigate = useNavigate();
  const [selectedLang, setSelectedLang] = useState('en');

  const handleStart = () => {
    navigate('/kiosk/screening', { state: { language: selectedLang } });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden select-none">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[120px] pointer-events-none rounded-full" />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              IDentix <span className="text-xs px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 font-mono">KIOSK</span>
            </h1>
            <p className="text-xs text-slate-400">Self-Service Border & Document Screening Station</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="clear" dot>Terminal Ready</Badge>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded"
            title="Return to System Portal Gate"
          >
            System Gate
          </button>
        </div>
      </header>

      {/* Main Kiosk Center */}
      <main className="relative z-10 max-w-4xl mx-auto w-full my-auto py-8 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-blue-400 mb-6 shadow-inner">
          <Volume2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Automated Voice & Visual Guidance Enabled</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4 leading-tight">
          Welcome to Automated Screening
        </h2>
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Please select your preferred language and proceed. You will be guided step-by-step through document scan and automated verification.
        </p>

        {/* Language Selection Grid */}
        <div className="w-full max-w-2xl mb-10">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" /> Select Language / Choisissez la langue
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {LANGUAGES.map((lang) => {
              const active = selectedLang === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setSelectedLang(lang.code)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    active
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-900/40 ring-1 ring-blue-500'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <p className="text-base font-bold">{lang.native}</p>
                  <p className="text-xs text-slate-400">{lang.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md">
          <button
            type="button"
            onClick={handleStart}
            className="w-full py-5 px-8 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-lg shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-0.5"
          >
            <span>Touch to Begin</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Secondary Options: Vault Transfer */}
        <div className="mt-8 flex items-center gap-6 text-xs text-slate-400">
          <button
            onClick={() => navigate('/vault')}
            className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>Traveller Mobile Vault Transfer</span>
          </button>
        </div>
      </main>

      {/* Footer / Privacy & Regulation Notice */}
      <footer className="relative z-10 border-t border-slate-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-400" />
          <span>No account or login required. All evidence processed securely on this terminal.</span>
        </div>
        <div className="text-slate-600 font-mono">Station: T2-CP-04B | Kiosk ID: KSK-01</div>
      </footer>
    </div>
  );
};
