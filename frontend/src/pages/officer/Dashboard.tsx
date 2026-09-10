import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  PlusCircle,
  Clock,
  ExternalLink,
  Inbox,
  Wifi,
  WifiOff,
  Link2,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader } from '../../components/common/PageHeader';

interface DashboardStats {
  total: number;
  clear: number;
  review: number;
  high_risk: number;
  recent: Array<{
    case_id: string;
    doc_type: string;
    risk_tier: string | null;
    risk_score: number | null;
    extracted_name: string;
    timestamp: string;
  }>;
}

interface AuditStatus {
  intact: boolean;
  records_checked: number;
  compromised_case_id: string | null;
}

function request(path: string) {
  const token = sessionStorage.getItem('identix_access_token');
  return fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export const OfficerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [audit, setAudit] = useState<AuditStatus | null>(null);
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, auditRes] = await Promise.all([
          request('/api/dashboard/stats'),
          request('/api/audit/integrity'),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (auditRes.ok) setAudit(await auditRes.json());
      } catch {
        // Backend offline — show zeros
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalScreenings = stats?.total ?? 0;
  const clearCount = stats?.clear ?? 0;
  const reviewCount = stats?.review ?? 0;
  const highRiskCount = stats?.high_risk ?? 0;
  const recentItems = stats?.recent ?? [];

  const tierColor = (tier: string | null) => {
    if (tier === 'CLEAR') return 'clear';
    if (tier === 'HIGH_RISK') return 'high_risk';
    if (tier === 'REVIEW') return 'review';
    return 'neutral';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Dashboard"
        subtitle="Real-time terminal oversight, queue status, and decision metrics."
        actions={
          <Button
            variant="secondary"
            icon={<PlusCircle className="w-4 h-4" />}
            onClick={() => navigate('/officer/screening/new')}
          >
            Start New Screening
          </Button>
        }
      />

      {/* Online / Offline + Audit Integrity banners */}
      <div className="flex flex-wrap gap-3">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            online
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {online ? 'ONLINE' : 'OFFLINE — live watchlist unavailable'}
        </div>

        {audit && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              audit.intact
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            Audit Integrity:{' '}
            {audit.intact ? `VERIFIED ✓ (${audit.records_checked} records)` : `COMPROMISED ✗ at ${audit.compromised_case_id}`}
          </div>
        )}
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Screened</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{loading ? '…' : totalScreenings}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">Backend SQLite records</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">CLEAR Cases</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{loading ? '…' : clearCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            {totalScreenings > 0 ? `${Math.round((clearCount / totalScreenings) * 100)}% of total volume` : 'No cases yet'}
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">REVIEW Cases</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{loading ? '…' : reviewCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">Secondary inspection referrals</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-red-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">HIGH RISK Alerts</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{loading ? '…' : highRiskCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">Watchlist, biometric, or tamper hits</p>
        </Card>
      </div>

      {/* Recent Screenings from Backend */}
      <Card
        cardTitle="Recent Screenings"
        subtitle="Latest verifications from the connected IDentix backend."
        action={
          totalScreenings > 0 && (
            <Button
              variant="ghost"
              size="sm"
              icon={<ExternalLink className="w-3.5 h-3.5" />}
              onClick={() => navigate('/officer/screenings')}
            >
              View Full History
            </Button>
          )
        }
      >
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : recentItems.length === 0 ? (
          <EmptyState
            icon={<Inbox className="w-6 h-6" />}
            title="No Screening Sessions Recorded"
            description="No documents have been processed yet. Click 'Start New Screening' to begin."
            action={
              <Button
                variant="primary"
                icon={<PlusCircle className="w-4 h-4" />}
                onClick={() => navigate('/officer/screening/new')}
              >
                Initialize First Screening
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="py-3 px-4">Case ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Document Type</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Risk</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentItems.map((item) => (
                  <tr key={item.case_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-800 text-xs">{item.case_id}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{item.doc_type || '—'}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{item.extracted_name || '—'}</td>
                    <td className="py-3 px-4">
                      <Badge variant={tierColor(item.risk_tier) as 'clear' | 'review' | 'high_risk' | 'neutral'}>
                        {item.risk_tier ?? 'MANUAL REVIEW'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/officer/screening/${item.case_id}/results`)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
