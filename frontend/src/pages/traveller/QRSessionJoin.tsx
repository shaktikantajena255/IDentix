import React, { useState } from 'react';
import { QrCode, AlertCircle, Wifi, ArrowRight } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export const QRSessionJoin: React.FC = () => {
  const { status } = useNetworkStatus();
  const [sessionToken, setSessionToken] = useState('');
  const [joining, setJoining] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken.trim()) {
      setSessionError('Please enter a valid session token from the officer\'s screen.');
      return;
    }
    if (status === 'OFFLINE') {
      setSessionError('Cannot connect to an officer session while offline. Please ensure you have connectivity.');
      return;
    }

    setJoining(true);
    setSessionError(null);

    // In Phase 12, this will POST to /api/v1/vault/session/{token}/status
    // For Phase 1, we show an accurate "not yet implemented" state rather than faking success.
    setTimeout(() => {
      setJoining(false);
      setSessionError(
        'QR Session backend not yet deployed (Phase 12). The Vault transfer WebSocket bridge will be integrated in Phase 12.'
      );
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <QrCode className="w-5 h-5 text-emerald-700" />
          <h3 className="text-lg font-bold text-slate-900">Join Officer QR Session</h3>
        </div>
        <p className="text-xs text-slate-500">
          Enter the session token shown on the officer's terminal, or scan the QR code with your device camera.
        </p>
      </div>

      {/* Security Warning */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex gap-3">
        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Only join sessions at a physical checkpoint</p>
          <p>
            Never scan a QR code that was sent to you via messaging app, email, or social media. A legitimate IDentix officer session QR is only displayed on a checkpoint officer's workstation screen — in your physical presence.
          </p>
        </div>
      </div>

      {/* Connectivity Check */}
      {status === 'OFFLINE' && (
        <div className="p-4 bg-slate-100 border border-slate-300 rounded-xl text-xs text-slate-700 flex items-center gap-3">
          <Wifi className="w-4 h-4 text-slate-500 shrink-0" />
          <p>
            <strong>Offline Mode:</strong> QR session connection requires network access. Please ensure your device has connectivity before joining.
          </p>
        </div>
      )}

      {/* Token Entry Form */}
      <form onSubmit={handleJoin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Session Token (from officer's screen)
          </label>
          <input
            type="text"
            value={sessionToken}
            onChange={(e) => setSessionToken(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
            placeholder="e.g.  SES-A7F3-9BKZ"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono tracking-widest"
            maxLength={20}
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Session tokens expire in 5 minutes and are single-use only.
          </p>
        </div>

        {sessionError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{sessionError}</span>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          style={{ backgroundColor: '#15803d', color: 'white' }}
          isLoading={joining}
          disabled={status === 'OFFLINE' || !sessionToken}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Connect to Officer Session
        </Button>
      </form>

      <div className="pt-4 border-t border-slate-100">
        <Badge variant="neutral" className="text-[10px]">
          QR Camera Scanning: Phase 12 Integration
        </Badge>
        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
          In-browser QR code scanning via device camera will be activated in Phase 12 using a JavaScript camera library. For now, manually enter the session token displayed on the officer's workstation.
        </p>
      </div>
    </div>
  );
};
