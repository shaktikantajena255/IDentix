import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Search, Filter, Inbox } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader } from '../../components/common/PageHeader';

interface HistoryRecord {
  case_id: string;
  doc_type: string;
  risk_tier: string | null;
  risk_score: number | null;
  extracted_name: string;
  created_at: string;
}

function request(path: string) {
  const token = sessionStorage.getItem('identix_access_token');
  return fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export const ScreeningHistory: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState('ALL');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await request('/api/history');
        if (res.ok) {
          const data: HistoryRecord[] = await res.json();
          setRecords(data);
        }
      } catch {
        // Backend unavailable — show empty
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filtered = records.filter((r) => {
    const matchesSearch =
      r.case_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.extracted_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.doc_type || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = filterRisk === 'ALL' || r.risk_tier === filterRisk;
    return matchesSearch && matchesRisk;
  });

  const tierVariant = (tier: string | null): 'clear' | 'review' | 'high_risk' | 'neutral' => {
    if (tier === 'CLEAR') return 'clear';
    if (tier === 'REVIEW') return 'review';
    if (tier === 'HIGH_RISK') return 'high_risk';
    return 'neutral';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Screening History"
        subtitle="Chronological register of all verification sessions stored in the backend database."
        badge={<Badge variant="neutral">{records.length} Total Records</Badge>}
      />

      <Card>
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Case ID, Name, or Document type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="CLEAR">CLEAR Only</option>
              <option value="REVIEW">REVIEW Only</option>
              <option value="HIGH_RISK">HIGH RISK Only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 py-8 text-center">Loading records from backend…</p>
        ) : records.length === 0 ? (
          <EmptyState
            icon={<Inbox className="w-6 h-6" />}
            title="No Screening Records"
            description="No completed verifications found. Run a new screening to create the first record."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="w-6 h-6" />}
            title="No Matching Records"
            description={`No sessions matched "${searchQuery || filterRisk}".`}
            action={
              <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setFilterRisk('ALL'); }}>
                Reset Filters
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
                  <th className="py-3 px-4">Doc Type</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.case_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 text-xs">{item.case_id}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{item.doc_type || '—'}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{item.extracted_name || 'Not detected'}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {item.risk_score != null ? item.risk_score : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={tierVariant(item.risk_tier)}>
                        {item.risk_tier ?? 'MANUAL REVIEW'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
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
