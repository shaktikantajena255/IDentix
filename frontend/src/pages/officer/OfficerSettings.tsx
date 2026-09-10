/**
 * OfficerSettings — Full settings page with:
 *  - General: station ID, terminal name
 *  - Voice: ON/OFF toggle
 *  - Security: audit chain integrity check
 *  - Offline: online/offline indicator, watchlist sync
 *  - System Health: real status from /api/system/status
 */
import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Save,
  Server,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { PageHeader } from '../../components/common/PageHeader';

interface SystemStatus {
  ocr: { status: string; message: string };
  face: { status: string; message: string };
  forensic_ela: { status: string; message: string };
  ml_model: { status: string; message: string };
  watchlist: { status: string; message: string };
  encryption: { status: string; message: string };
  audit_chain: { status: string; message: string };
}

interface AuditResult {
  intact: boolean;
  records_checked: number;
  compromised_case_id: string | null;
}

function authHeaders() {
  const token = sessionStorage.getItem('identix_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string) {
  const res = await fetch(path, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const StatusIndicator: React.FC<{ status: string; message: string; label: string }> = ({
  status, message, label,
}) => {
  const ok = status === 'ok';
  const unavail = status === 'unavailable';
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
      ) : unavail ? (
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5 break-words">{message}</p>
      </div>
      <span
        className={`ml-auto shrink-0 text-xs font-mono font-semibold uppercase px-2 py-0.5 rounded-full ${
          ok
            ? 'bg-emerald-100 text-emerald-700'
            : unavail
            ? 'bg-amber-100 text-amber-700'
            : 'bg-red-100 text-red-700'
        }`}
      >
        {status}
      </span>
    </div>
  );
};

export const OfficerSettings: React.FC = () => {
  // General
  const [stationId, setStationId] = useState('T2-CP-04B');
  const [terminalName, setTerminalName] = useState('Terminal 2 — Checkpoint Alpha');
  const [retentionDays, setRetentionDays] = useState('30');
  const [saved, setSaved] = useState(false);

  // Voice
  const [voiceEnabled, setVoiceEnabled] = useState(
    localStorage.getItem('identix_voice_enabled') !== 'false',
  );

  // System status
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);
  const [sysLoading, setSysLoading] = useState(false);
  const [sysError, setSysError] = useState<string | null>(null);

  // Audit
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Connectivity
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const loadSysStatus = async () => {
    setSysLoading(true);
    setSysError(null);
    try {
      const data = await apiFetch('/api/system/status');
      setSysStatus(data);
    } catch {
      setSysError('Could not reach backend to check system status.');
    } finally {
      setSysLoading(false);
    }
  };

  const runAudit = async () => {
    setAuditLoading(true);
    setAuditError(null);
    setAuditResult(null);
    try {
      const data = await apiFetch('/api/audit/integrity');
      setAuditResult(data);
    } catch {
      setAuditError('Audit check failed — backend may be unavailable.');
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    loadSysStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVoice = () => {
    const newVal = !voiceEnabled;
    setVoiceEnabled(newVal);
    localStorage.setItem('identix_voice_enabled', newVal ? 'true' : 'false');
    if (newVal) {
      try {
        const u = new SpeechSynthesisUtterance('Voice feedback enabled.');
        u.rate = 0.9;
        window.speechSynthesis?.speak(u);
      } catch {
        /* voice failure must never block settings */
      }
    } else {
      window.speechSynthesis?.cancel();
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('identix_station_id', stationId);
    localStorage.setItem('identix_terminal_name', terminalName);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Terminal Settings"
        subtitle="Workstation configuration, voice preferences, security, and system health."
        badge={saved ? <Badge variant="clear">Saved</Badge> : undefined}
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* ── General ─────────────────────────────────────────────────── */}
        <Card cardTitle="General" subtitle="Station identity bound to audit logs.">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Station Identifier
              </label>
              <input
                type="text"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Terminal Name
              </label>
              <input
                type="text"
                value={terminalName}
                onChange={(e) => setTerminalName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </Card>

        {/* ── Voice ───────────────────────────────────────────────────── */}
        <Card cardTitle="Voice Assistance" subtitle="Audio announcements during the screening workflow.">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {voiceEnabled ? 'Voice Assistance ON' : 'Voice Assistance OFF'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Key events are spoken aloud (document captured, CLEAR, REVIEW, HIGH RISK).
                Voice failure never blocks the pipeline.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleVoice}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                voiceEnabled
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {voiceEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </Card>

        {/* ── Security / Audit ─────────────────────────────────────────── */}
        <Card
          cardTitle={
            <span className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Security & Audit Chain
            </span>
          }
          subtitle="Verify SHA-256 hash chain integrity across all screening records."
        >
          <div className="space-y-4">
            {auditResult && (
              <div
                className={`rounded-xl border p-4 ${
                  auditResult.intact
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {auditResult.intact ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <p
                    className={`text-sm font-semibold ${
                      auditResult.intact ? 'text-emerald-800' : 'text-red-800'
                    }`}
                  >
                    {auditResult.intact
                      ? `Chain Intact — ${auditResult.records_checked} records verified`
                      : `Chain Compromised — tampered record: ${auditResult.compromised_case_id}`}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  {auditResult.intact
                    ? 'All SHA-256 hashes match expected values. No modification detected.'
                    : 'A record hash mismatch was detected. Investigate the flagged case immediately.'}
                </p>
              </div>
            )}
            {auditError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {auditError}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={auditLoading}
              icon={<Activity className="w-3.5 h-3.5" />}
              onClick={runAudit}
            >
              {auditLoading ? 'Verifying chain…' : 'Verify Chain Integrity'}
            </Button>
          </div>
        </Card>

        {/* ── Offline / Connectivity ───────────────────────────────────── */}
        <Card
          cardTitle={
            <span className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-emerald-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              Connectivity Status
            </span>
          }
        >
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Network</span>
              <span
                className={`font-semibold ${isOnline ? 'text-emerald-700' : 'text-red-700'}`}
              >
                {isOnline ? '● Online' : '● Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Live Watchlist</span>
              <span className="text-slate-500">
                {isOnline ? 'Available' : 'UNAVAILABLE — using local cache'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Local OCR/ELA</span>
              <span className="text-emerald-700 font-medium">Always available</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Local Face Engine</span>
              <span className="text-emerald-700 font-medium">Always available</span>
            </div>
            <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
              IDentix processes all checks locally. Network is only required for live watchlist
              updates and remote sync.
            </p>
          </div>
        </Card>

        {/* ── System Health ────────────────────────────────────────────── */}
        <Card
          cardTitle={
            <span className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              System Health
            </span>
          }
          subtitle="Real-time engine statuses from the IDentix backend."
        >
          <div className="space-y-1">
            {sysLoading && (
              <p className="text-sm text-slate-500 py-4 text-center">
                Checking system status…
              </p>
            )}
            {sysError && (
              <div className="flex gap-2 text-sm text-red-700 mb-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {sysError}
              </div>
            )}
            {sysStatus && (
              <>
                <StatusIndicator
                  label="OCR (Tesseract)"
                  status={sysStatus.ocr.status}
                  message={sysStatus.ocr.message}
                />
                <StatusIndicator
                  label="Face Recognition"
                  status={sysStatus.face.status}
                  message={sysStatus.face.message}
                />
                <StatusIndicator
                  label="Forensic ELA (OpenCV)"
                  status={sysStatus.forensic_ela.status}
                  message={sysStatus.forensic_ela.message}
                />
                <StatusIndicator
                  label="ML Forensic Model"
                  status={sysStatus.ml_model.status}
                  message={sysStatus.ml_model.message}
                />
                <StatusIndicator
                  label="Watchlist Cache"
                  status={sysStatus.watchlist.status}
                  message={sysStatus.watchlist.message}
                />
                <StatusIndicator
                  label="Encryption (Fernet)"
                  status={sysStatus.encryption.status}
                  message={sysStatus.encryption.message}
                />
                <StatusIndicator
                  label="Audit Chain (SHA-256)"
                  status={sysStatus.audit_chain.status}
                  message={sysStatus.audit_chain.message}
                />
              </>
            )}
            <div className="pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<RefreshCw className={`w-3.5 h-3.5 ${sysLoading ? 'animate-spin' : ''}`} />}
                onClick={loadSysStatus}
                disabled={sysLoading}
              >
                Refresh Status
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Data Retention ───────────────────────────────────────────── */}
        <Card cardTitle="Local Storage Policy" subtitle="Manage local data retention period.">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Local Case Retention Period
            </label>
            <select
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
            >
              <option value="7">7 Days — Standard Checkpoint</option>
              <option value="30">30 Days — Recommended</option>
              <option value="90">90 Days — Extended Audit</option>
            </select>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" icon={<Save className="w-4 h-4" />}>
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
};
