import React from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Badge } from './Badge';

export const NetworkStatusBadge: React.FC = () => {
  const { status, pendingSyncCount, serverLatencyMs } = useNetworkStatus();

  return (
    <div className="flex items-center gap-2">
      {status === 'ONLINE' && (
        <Badge variant="online" dot className="bg-white border-emerald-300 text-emerald-800 shadow-2xs">
          <Wifi className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Online</span>
          {serverLatencyMs !== null && (
            <span className="text-[10px] text-emerald-600 font-normal">({serverLatencyMs}ms)</span>
          )}
        </Badge>
      )}

      {status === 'LOW_CONNECTIVITY' && (
        <Badge variant="warning" dot className="bg-amber-50 border-amber-300 text-amber-900 shadow-2xs">
          <Wifi className="w-3 h-3 text-amber-600 shrink-0" />
          <span>Low Connectivity</span>
        </Badge>
      )}

      {status === 'OFFLINE' && (
        <Badge variant="offline" dot className="bg-slate-100 border-slate-300 text-slate-700 shadow-2xs">
          <WifiOff className="w-3 h-3 text-slate-500 shrink-0" />
          <span>Offline (Local Mode)</span>
        </Badge>
      )}

      {pendingSyncCount > 0 && (
        <div
          title={`${pendingSyncCount} offline case(s) queued for synchronization`}
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 font-medium"
        >
          <RefreshCw className="w-2.5 h-2.5 text-blue-600 animate-spin" />
          <span>{pendingSyncCount} pending sync</span>
        </div>
      )}
    </div>
  );
};
