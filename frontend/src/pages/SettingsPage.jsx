import { useState, useEffect } from 'react';
import { Settings, Shield, Wifi, WifiOff, Server, Key, Volume2, VolumeX, RefreshCw, CheckCircle2, XCircle, ChevronRight, Fingerprint, Database } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../lib/api';

function speak(text) {
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9; window.speechSynthesis.speak(u);
  }
}

const SettingsPage = () => {
  const [health, setHealth]     = useState(null);
  const [audit, setAudit]       = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem('identix_voice') !== 'false');
  const [saved, setSaved]       = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [h, a, s] = await Promise.all([
        api.get('/api/health').catch(() => ({ data: null })),
        api.get('/api/audit/integrity').catch(() => ({ data: null })),
        api.get('/api/system/status').catch(() => ({ data: null })),
      ]);
      setHealth(h.data);
      setAudit(a.data);
      setSystemStatus(s.data);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    localStorage.setItem('identix_voice', next ? 'true' : 'false');
    if (next) speak('Voice assistance enabled.');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isOnline = navigator.onLine;

  const InfoRow = ({ label, value, mono, ok }) => (
    <div className="flex items-center justify-between py-3 border-b border-navy-700 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-medium ${mono ? 'font-mono' : ''} ${
        ok === true ? 'text-green-400' : ok === false ? 'text-red-400' : 'text-slate-200'
      }`}>{value}</span>
    </div>
  );

  const Section = ({ title, icon: Icon, children }) => (
    <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden mb-6">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-navy-700 bg-navy-800/60">
        <Icon className="w-4 h-4 text-cyber-500" />
        <h2 className="font-bold text-slate-200">{title}</h2>
      </div>
      <div className="px-6">{children}</div>
    </div>
  );

  return (
    <div className="flex h-screen bg-navy-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-200">Settings</h1>
            <p className="text-slate-400 mt-1">System configuration, health status, and audit verification</p>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 border border-navy-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </header>

        <div className="max-w-2xl space-y-0">

          {/* Voice Assistance */}
          <Section title="Voice Assistance" icon={Volume2}>
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-sm font-medium text-slate-200">Voice Narration</p>
                <p className="text-xs text-slate-500 mt-0.5">Speaks stage names, risk results, and alerts during screenings</p>
              </div>
              <button
                onClick={toggleVoice}
                className={`relative w-12 h-6 rounded-full transition-colors ${voiceEnabled ? 'bg-cyber-500' : 'bg-navy-600'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${voiceEnabled ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-navy-700">
              <span className="text-sm text-slate-400">Current Status</span>
              <span className={`text-sm font-medium flex items-center gap-1.5 ${voiceEnabled ? 'text-green-400' : 'text-slate-500'}`}>
                {voiceEnabled ? <><Volume2 className="w-3.5 h-3.5" /> Enabled</> : <><VolumeX className="w-3.5 h-3.5" /> Disabled</>}
              </span>
            </div>
          </Section>

          {/* Network */}
          <Section title="Network & Connectivity" icon={isOnline ? Wifi : WifiOff}>
            <InfoRow label="Internet Connection" value={isOnline ? 'Online' : 'Offline'} ok={isOnline} />
            <InfoRow label="Backend API" value={health ? `${health.service} v${health.version}` : 'Connecting…'} ok={!!health} />
            <InfoRow label="API Status" value={health?.status === 'ok' ? 'Operational' : 'Unreachable'} ok={health?.status === 'ok'} />
          </Section>

          {/* System Status */}
          <Section title="System Components" icon={Server}>
            {loading ? (
              <div className="py-6 flex justify-center"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : (
              <>
                <InfoRow
                  label="OCR Engine"
                  value={systemStatus?.ocr?.status === 'ok'
                    ? (systemStatus.ocr.message?.split(' available at')[0] || 'Tesseract')
                    : (systemStatus?.ocr?.message || 'Unavailable')}
                  ok={systemStatus?.ocr?.status === 'ok'}
                />
                <InfoRow
                  label="Face Recognition"
                  value={systemStatus?.face?.message || 'Unavailable'}
                  ok={systemStatus?.face?.status === 'ok'}
                />
                <InfoRow
                  label="ELA / Forensics"
                  value={systemStatus?.forensic_ela?.message || 'Unavailable'}
                  ok={systemStatus?.forensic_ela?.status === 'ok'}
                />
                <InfoRow
                  label="ML Forensic Model"
                  value={systemStatus?.ml_model?.message || 'Unavailable'}
                  ok={systemStatus?.ml_model?.status === 'ok'}
                />
                <InfoRow
                  label="Offline Watchlist"
                  value={systemStatus?.watchlist?.message || 'Loaded'}
                  ok={systemStatus?.watchlist?.status === 'ok'}
                />
                <InfoRow
                  label="Encryption"
                  value={systemStatus?.encryption?.message || 'Active'}
                  ok={systemStatus?.encryption?.status === 'ok'}
                />
                <InfoRow label="PDF Report Engine" value="ReportLab operational" ok />
              </>
            )}
          </Section>

          {/* Audit */}
          <Section title="Audit Chain Integrity" icon={Shield}>
            {loading ? (
              <div className="py-6 flex justify-center"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : audit ? (
              <>
                <div className={`my-4 flex items-center gap-3 p-3 rounded-lg border ${
                  audit.intact
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  {audit.intact
                    ? <CheckCircle2 className="w-5 h-5 shrink-0" />
                    : <XCircle className="w-5 h-5 shrink-0" />
                  }
                  <div>
                    <p className="font-bold text-sm">
                      {audit.intact ? 'Chain Verified — All records intact' : 'CHAIN COMPROMISED — Tampering detected'}
                    </p>
                    {!audit.intact && audit.tampered_at && (
                      <p className="text-xs mt-0.5">Tampered record: {audit.tampered_at}</p>
                    )}
                  </div>
                </div>
                <InfoRow label="Records Checked" value={audit.checked ?? '—'} mono />
                <InfoRow label="Hash Algorithm"  value="SHA-256 chain"       />
                <InfoRow label="Field Encryption" value="Fernet AES-128"     />
              </>
            ) : (
              <p className="text-slate-500 text-sm py-4">Audit service unavailable</p>
            )}
          </Section>

          {/* Station */}
          <Section title="Station Information" icon={Fingerprint}>
            <InfoRow label="Station ID"       value="T2-CP-04B"                     mono />
            <InfoRow label="Checkpoint"       value="Checkpoint Alpha"               />
            <InfoRow label="Backend Port"     value="127.0.0.1:8000"                mono />
            <InfoRow label="System Version"   value={`IDentix v${health?.version || '1.0.0'}`} />
          </Section>

          {/* Data */}
          <Section title="Data Management" icon={Database}>
            <InfoRow label="Database" value="SQLite (local)" />
            <InfoRow label="Encryption" value="Fernet symmetric encryption on PII fields" />
            <InfoRow label="Offline Mode" value="Watchlist cached locally — functions without internet" ok />
            <div className="py-3">
              <p className="text-xs text-slate-500">
                Sensitive fields (name, document number) are encrypted at rest using a Fernet key stored in <code className="text-cyber-400">secret.key</code>. The key never leaves the local server.
              </p>
            </div>
          </Section>

        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
