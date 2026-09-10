/**
 * OfficerAnalytics — Reads from the real backend /api/analytics/stats endpoint.
 * Shows actual screening stats from the SQLite database.
 */
import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Shield, AlertTriangle, Clock, FileText, Eye } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader } from '../../components/common/PageHeader';

interface AnalyticsStats {
  total: number;
  clear: number;
  review: number;
  high_risk: number;
  insufficient_evidence: number;
  avg_processing_time: number;
  doc_types: Record<string, number>;
  tamper_detections: number;
  face_mismatches: number;
  watchlist_hits: number;
}

function request(path: string) {
  const token = sessionStorage.getItem('identix_access_token');
  return fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

const StatBlock: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}> = ({ label, value, icon, color, sub }) => (
  <div className={`rounded-xl border p-4 ${color}`}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold uppercase opacity-70">{label}</span>
      {icon}
    </div>
    <p className="text-2xl font-bold">{value}</p>
    {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
  </div>
);

const BarRow: React.FC<{ label: string; count: number; total: number; color: string }> = ({
  label, count, total, color,
}) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-600">
        <span className="font-medium">{label}</span>
        <span className="font-mono">{count} ({pct}%)</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export const OfficerAnalytics: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await request('/api/analytics/stats');
        if (res.ok) {
          setStats(await res.json());
        } else {
          setError('Failed to load analytics data from backend.');
        }
      } catch {
        setError('Backend unavailable — cannot load analytics.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Analytics & Telemetry"
        subtitle="Throughput rates, risk distribution, and checkpoint operational performance — sourced from real backend records."
        badge={<Badge variant="neutral">{stats?.total ?? '—'} Total Screenings</Badge>}
      />

      {loading && (
        <Card>
          <p className="text-sm text-slate-500 py-4 text-center">Loading analytics from backend…</p>
        </Card>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      {!loading && !error && stats && stats.total === 0 && (
        <Card>
          <EmptyState
            icon={<BarChart3 className="w-6 h-6 text-slate-500" />}
            title="Insufficient Telemetry Data"
            description="Operational analytics require at least one completed screening. Run a new screening or use the Demo Lab to generate records."
          />
        </Card>
      )}

      {!loading && stats && stats.total > 0 && (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatBlock
              label="Total Screenings"
              value={stats.total}
              icon={<FileText className="w-4 h-4" />}
              color="bg-slate-50 border-slate-200 text-slate-700"
            />
            <StatBlock
              label="Cleared"
              value={stats.clear}
              icon={<Shield className="w-4 h-4 text-emerald-600" />}
              color="bg-emerald-50 border-emerald-200 text-emerald-800"
              sub={`${stats.total > 0 ? Math.round((stats.clear / stats.total) * 100) : 0}%`}
            />
            <StatBlock
              label="Review"
              value={stats.review}
              icon={<Eye className="w-4 h-4 text-amber-600" />}
              color="bg-amber-50 border-amber-200 text-amber-800"
              sub={`${stats.total > 0 ? Math.round((stats.review / stats.total) * 100) : 0}%`}
            />
            <StatBlock
              label="High Risk"
              value={stats.high_risk}
              icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
              color="bg-red-50 border-red-200 text-red-800"
              sub={`${stats.total > 0 ? Math.round((stats.high_risk / stats.total) * 100) : 0}%`}
            />
            <StatBlock
              label="Avg Time"
              value={`${stats.avg_processing_time}s`}
              icon={<Clock className="w-4 h-4 text-blue-600" />}
              color="bg-blue-50 border-blue-200 text-blue-800"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk distribution */}
            <Card cardTitle="Risk Distribution">
              <div className="space-y-4">
                <BarRow label="CLEAR" count={stats.clear} total={stats.total} color="bg-emerald-500" />
                <BarRow label="REVIEW" count={stats.review} total={stats.total} color="bg-amber-400" />
                <BarRow label="HIGH RISK" count={stats.high_risk} total={stats.total} color="bg-red-500" />
                {stats.insufficient_evidence > 0 && (
                  <BarRow
                    label="INSUFFICIENT EVIDENCE"
                    count={stats.insufficient_evidence}
                    total={stats.total}
                    color="bg-slate-400"
                  />
                )}
              </div>
            </Card>

            {/* Anomaly breakdown */}
            <Card cardTitle="Anomaly Breakdown">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Tamper / ELA Detections</p>
                    <p className="text-xs text-slate-500">Forensic anomalies flagged</p>
                  </div>
                  <span className={`text-lg font-bold ${stats.tamper_detections > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {stats.tamper_detections}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Face Mismatches</p>
                    <p className="text-xs text-slate-500">Biometric comparison failures</p>
                  </div>
                  <span className={`text-lg font-bold ${stats.face_mismatches > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {stats.face_mismatches}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Watchlist Hits</p>
                    <p className="text-xs text-slate-500">Documents matching flagged entries</p>
                  </div>
                  <span className={`text-lg font-bold ${stats.watchlist_hits > 0 ? 'text-red-700' : 'text-slate-400'}`}>
                    {stats.watchlist_hits}
                  </span>
                </div>
              </div>
            </Card>

            {/* Document types */}
            {Object.keys(stats.doc_types).length > 0 && (
              <Card cardTitle="Document Types Processed">
                <div className="space-y-3">
                  {Object.entries(stats.doc_types)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <BarRow
                        key={type}
                        label={type || 'UNKNOWN'}
                        count={count}
                        total={stats.total}
                        color="bg-blue-500"
                      />
                    ))}
                </div>
              </Card>
            )}

            {/* Processing info */}
            <Card cardTitle="Pipeline Performance">
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>Total records processed</span>
                  <span className="font-mono font-semibold text-slate-900">{stats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average pipeline time</span>
                  <span className="font-mono font-semibold text-slate-900">{stats.avg_processing_time}s</span>
                </div>
                <div className="flex justify-between border-t pt-3 mt-3">
                  <span className="text-xs text-slate-400">Data source: Live backend SQLite</span>
                  <TrendingUp className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
