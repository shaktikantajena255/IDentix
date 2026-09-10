import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import {
  Users, Database, FileCheck2, Cpu, RefreshCw, ScrollText, Activity,
  CheckCircle2, AlertTriangle, Clock, Server
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { PageHeader } from '../../components/common/PageHeader';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export const AdminOverview: React.FC = () => {
  const { status, pendingSyncCount, serverLatencyMs } = useNetworkStatus();
  const screenings = useLiveQuery(() => db.screenings.toArray()) || [];
  const auditLogs = useLiveQuery(() => db.auditLogs.toArray()) || [];

  const statusItems = [
    {
      label: 'Central Sync',
      icon: RefreshCw,
      value: status === 'ONLINE' ? 'Connected' : 'Disconnected',
      badge: status === 'ONLINE' ? 'clear' : 'high_risk',
      detail: status === 'ONLINE'
        ? `Latency: ${serverLatencyMs ?? '—'}ms`
        : `${pendingSyncCount} cases pending`
    },
    {
      label: 'Local Database',
      icon: Database,
      value: 'IndexedDB — Active',
      badge: 'clear',
      detail: `${screenings.length} screening records stored`
    },
    {
      label: 'Audit Trail',
      icon: ScrollText,
      value: 'Integrity Chain Active',
      badge: 'clear',
      detail: `${auditLogs.length} audit entries`
    },
    {
      label: 'AI Inference Engine',
      icon: Cpu,
      value: 'Phase 2+ Integration',
      badge: 'neutral',
      detail: 'OCR, MRZ, Face — not yet deployed'
    },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Administration Overview"
        subtitle="Checkpoint infrastructure status, policy configuration, and security governance."
        badge={
          <Badge variant={status === 'ONLINE' ? 'clear' : 'warning'} dot>
            {status === 'ONLINE' ? 'All Systems Nominal' : 'Degraded Connectivity'}
          </Badge>
        }
      />

      {/* Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statusItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-slate-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-0.5">
                    {item.label}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant={item.badge as 'clear' | 'high_risk' | 'neutral' | 'warning'}>
                      {item.value}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{item.detail}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Module Availability Map */}
      <Card cardTitle="Pipeline Module Deployment Status" subtitle="Phases 2–14 integration tracking.">
        <div className="space-y-2">
          {[
            { module: 'Document Ingestion (Upload/Camera)', phase: 'Phase 2', status: 'pending' },
            { module: 'OCR — PaddleOCR / Tesseract', phase: 'Phase 3', status: 'pending' },
            { module: 'MRZ Extraction & ICAO Check-Digit Engine', phase: 'Phase 3', status: 'pending' },
            { module: 'Document Standard Validation (VIZ ↔ MRZ)', phase: 'Phase 4', status: 'pending' },
            { module: 'Forensic / Tamper Analysis Engine', phase: 'Phase 5', status: 'pending' },
            { module: 'Face Extraction & Biometric Verification', phase: 'Phase 6', status: 'pending' },
            { module: 'Watchlist / Blacklist Lookup', phase: 'Phase 7', status: 'pending' },
            { module: 'Cross-Document & Timeline Analysis', phase: 'Phase 8', status: 'pending' },
            { module: 'Identity Graph Engine', phase: 'Phase 9', status: 'pending' },
            { module: 'Explainable Risk & Confidence Engine', phase: 'Phase 10', status: 'pending' },
            { module: 'Offline Sync & Conflict Resolution', phase: 'Phase 11', status: 'pending' },
            { module: 'Vault QR Ephemeral Sessions', phase: 'Phase 12', status: 'pending' },
          ].map((row) => (
            <div
              key={row.module}
              className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-50 border border-slate-100"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-sm text-slate-700">{row.module}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-slate-500 font-mono">{row.phase}</span>
                <Badge variant="neutral">Pending</Badge>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-sm text-slate-700 font-medium">Application Foundation, Routing & UI Architecture</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-slate-500 font-mono">Phase 1</span>
              <Badge variant="clear">Deployed</Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
