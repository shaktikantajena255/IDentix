import React from 'react';
import { Activity, Server, Cpu, HardDrive, Wifi, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { PageHeader } from '../../components/common/PageHeader';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export const SystemHealth: React.FC = () => {
  const { status, serverLatencyMs, lastChecked } = useNetworkStatus();

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health & Diagnostics"
        subtitle="Real-time checkpoint workstation health, storage capacity, and API gateway status."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Backend API */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Server className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Backend API</p>
              <div className="mt-1">
                <Badge variant={status === 'ONLINE' ? 'clear' : status === 'LOW_CONNECTIVITY' ? 'warning' : 'offline'} dot>
                  {status === 'ONLINE' ? 'Reachable' : status === 'LOW_CONNECTIVITY' ? 'Degraded' : 'Unreachable'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Latency: {serverLatencyMs !== null ? `${serverLatencyMs}ms` : 'N/A'}
              </p>
              <p className="text-[11px] text-slate-400">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </Card>

        {/* Local Database */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Local Storage (IndexedDB)</p>
              <div className="mt-1">
                <Badge variant="clear" dot>Operational</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Browser-native IndexedDB — persistent across sessions
              </p>
            </div>
          </div>
        </Card>

        {/* PWA Service Worker */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Wifi className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">PWA / Service Worker</p>
              <div className="mt-1">
                <Badge variant="info">Active Cache</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                UI assets cached for offline access
              </p>
            </div>
          </div>
        </Card>

        {/* OCR Engine */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">OCR / MRZ Engine</p>
              <div className="mt-1">
                <Badge variant="neutral">Phase 3 — Not Deployed</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                PaddleOCR + PassportEye awaiting Phase 3 setup
              </p>
            </div>
          </div>
        </Card>

        {/* Face Engine */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Biometric Engine</p>
              <div className="mt-1">
                <Badge variant="neutral">Phase 6 — Not Deployed</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                InsightFace ONNX awaiting Phase 6 setup
              </p>
            </div>
          </div>
        </Card>

        {/* Watchlist */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Watchlist Cache</p>
              <div className="mt-1">
                <Badge variant="warning">Empty — No Records</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Import synthetic test records in Watchlist Management
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
