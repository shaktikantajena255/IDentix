import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { RefreshCw, CheckCircle2, Clock, Upload, AlertCircle } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader } from '../../components/common/PageHeader';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export const OfflineSync: React.FC = () => {
  const { status, pendingSyncCount, lastChecked, serverLatencyMs } = useNetworkStatus();
  const pendingItems = useLiveQuery(() =>
    db.offlineSyncQueue.where('status').equals('PENDING').toArray()
  ) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offline Synchronization"
        subtitle="Bidirectional sync between local terminal database and central border authority server."
      />

      {/* Connectivity Status Panel */}
      <Card cardTitle="Current Connectivity Status">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <Badge
              variant={
                status === 'ONLINE' ? 'online' :
                status === 'LOW_CONNECTIVITY' ? 'warning' : 'offline'
              }
              dot
              className="mb-2"
            >
              {status === 'ONLINE' ? 'Online' :
               status === 'LOW_CONNECTIVITY' ? 'Low Connectivity' : 'Offline (Local Mode)'}
            </Badge>
            <p className="text-xs text-slate-500 mt-1">
              {status === 'ONLINE'
                ? `API latency: ${serverLatencyMs ?? '—'}ms`
                : 'Backend API unreachable'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <p className="text-xl font-bold text-slate-900">{pendingSyncCount}</p>
            <p className="text-xs text-slate-500 mt-1 font-semibold uppercase tracking-wide">
              Cases Awaiting Sync
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <p className="text-xs font-mono text-slate-700">
              {lastChecked.toLocaleTimeString()}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-semibold uppercase tracking-wide">
              Last Status Check
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload className="w-4 h-4" />}
            disabled={status !== 'ONLINE' || pendingSyncCount === 0}
          >
            Push {pendingSyncCount > 0 ? `(${pendingSyncCount})` : ''} to Authority
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            disabled={status !== 'ONLINE'}
          >
            Pull Watchlist Delta
          </Button>
        </div>
      </Card>

      {/* Sync Queue */}
      <Card cardTitle="Offline Sync Queue" subtitle="Records held locally pending network connectivity.">
        {pendingItems.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />}
            title="Sync Queue Empty"
            description="All screening records are either synchronized with the central authority or there are no completed cases yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Queued At</th>
                  <th className="py-3 px-4">Retry Count</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono text-xs text-slate-800">{item.entityId}</td>
                    <td className="py-3 px-4"><Badge variant="neutral">{item.entityType}</Badge></td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {new Date(item.enqueuedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{item.retryCount}</td>
                    <td className="py-3 px-4">
                      <Badge variant={item.status === 'FAILED' ? 'high_risk' : 'warning'}>
                        {item.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex gap-3">
        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p>
          <strong>Offline Policy:</strong> IDentix never claims live authority verification was performed when the system is offline. All screening reports generated during offline periods are explicitly marked <code className="bg-amber-100 px-1 rounded">OFFLINE_SESSION</code> and include the local watchlist cache version.
        </p>
      </div>
    </div>
  );
};
