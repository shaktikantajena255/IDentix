import React from 'react';
import { Database, RefreshCw, AlertCircle, Shield, Upload } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader } from '../../components/common/PageHeader';

export const WatchlistManagement: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Watchlist Management"
        subtitle="Locally cached Stolen, Lost, Revoked, and Wanted document records for offline-capable screening."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={<RefreshCw className="w-4 h-4" />}>
              Synchronize
            </Button>
            <Button variant="secondary" size="sm" icon={<Upload className="w-4 h-4" />}>
              Import Records
            </Button>
          </div>
        }
      />

      {/* Cache Status */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Records', value: '0', color: 'slate' },
          { label: 'STOLEN', value: '0', color: 'red' },
          { label: 'REVOKED', value: '0', color: 'amber' },
          { label: 'WANTED', value: '0', color: 'red' },
        ].map((stat) => (
          <Card key={stat.label} className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-1">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Cache metadata */}
      <Card cardTitle="Cache Metadata" subtitle="Local watchlist version and last synchronization.">
        <dl className="divide-y divide-slate-100 text-sm">
          <div className="py-3 flex justify-between items-center">
            <dt className="text-slate-600 font-medium">Cache Version</dt>
            <dd className="font-mono text-slate-900">—</dd>
          </div>
          <div className="py-3 flex justify-between items-center">
            <dt className="text-slate-600 font-medium">Last Synchronized</dt>
            <dd className="text-slate-500">Never</dd>
          </div>
          <div className="py-3 flex justify-between items-center">
            <dt className="text-slate-600 font-medium">Source Authority</dt>
            <dd>
              <Badge variant="neutral">Synthetic / Test Dataset</Badge>
            </dd>
          </div>
          <div className="py-3 flex justify-between items-center">
            <dt className="text-slate-600 font-medium">Live Authority Access</dt>
            <dd>
              <Badge variant="warning">⚠ Hardware/Authority Integration Required</Badge>
            </dd>
          </div>
        </dl>
      </Card>

      {/* Records table */}
      <Card cardTitle="Watchlist Records" subtitle="Indexed locally for offline query.">
        <EmptyState
          icon={<Database className="w-6 h-6" />}
          title="No Watchlist Records Loaded"
          description="The local watchlist cache is empty. Use 'Import Records' to load a synthetic test dataset, or synchronize with the central authority when connectivity is available."
          action={
            <div className="flex gap-3">
              <Button variant="outline" size="sm" icon={<Upload className="w-4 h-4" />}>
                Import Test Dataset
              </Button>
            </div>
          }
        />
      </Card>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed flex gap-3">
        <AlertCircle className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
        <p>
          <strong>Authority Notice:</strong> IDentix does not have access to live INTERPOL I/24-7, SLTD, or national law enforcement databases. The watchlist subsystem is designed to receive periodic delta updates from a central authority server when connectivity permits. Until Phase 7 integration, all watchlist checks use a clearly labeled synthetic dataset.
        </p>
      </div>
    </div>
  );
};
