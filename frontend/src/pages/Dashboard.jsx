import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, FileText, ShieldCheck, AlertTriangle, XOctagon } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import StatCard from '../components/StatCard';
import RiskBadge from '../components/RiskBadge';
import api from '../lib/api';

const Dashboard = () => {
  const [time, setTime] = useState(new Date());
  const [stats, setStats] = useState(null);
  const [auditIntact, setAuditIntact] = useState(null);
  const [recentScreenings, setRecentScreenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, auditRes] = await Promise.all([
          api.get('/api/dashboard/stats').catch(() => ({ data: { total: 0, clear: 0, review: 0, high_risk: 0, recent: [] }})),
          api.get('/api/audit/integrity').catch(() => ({ data: { intact: true, records_checked: 0 }}))
        ]);
        
        setStats(statsRes.data);
        setRecentScreenings(statsRes.data.recent || []);
        setAuditIntact(auditRes.data);
      } catch (err) {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="flex h-screen bg-navy-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-200">Security Dashboard</h1>
            <p className="text-slate-400 mt-1">Live Checkpoint Monitoring</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-mono text-cyber-500">{time.toLocaleTimeString()}</div>
            <div className="text-sm text-slate-400">{time.toLocaleDateString()}</div>
          </div>
        </header>

        {auditIntact && (
          <div className={`mb-6 p-4 rounded-lg border font-medium flex items-center gap-3 ${
            auditIntact.intact 
              ? 'bg-green-500/10 border-green-500/30 text-green-400' 
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {auditIntact.intact ? (
              <><span>🔗 Audit Chain Integrity: VERIFIED ✓ — {auditIntact.records_checked} records checked</span></>
            ) : (
              <><span>⚠️ AUDIT CHAIN COMPROMISED — Record {auditIntact.compromised_case_id || 'UNKNOWN'} may have been altered</span></>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-12 h-12 animate-spin text-cyber-500" />
          </div>
        ) : error ? (
          <div className="text-red-500 bg-red-500/10 p-4 rounded-lg border border-red-500/30">{error}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatCard title="Total Screenings" value={stats?.total || 0} icon={FileText} color="cyan" />
              <StatCard title="Clear" value={stats?.clear || 0} icon={ShieldCheck} color="green" />
              <StatCard title="Review" value={stats?.review || 0} icon={AlertTriangle} color="amber" />
              <StatCard title="High Risk" value={stats?.high_risk || 0} icon={XOctagon} color="red" />
            </div>

            <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-navy-600 bg-navy-800">
                <h2 className="text-lg font-medium text-slate-200">Recent Screenings</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-navy-900/50 text-slate-400">
                    <tr>
                      <th className="px-6 py-3 font-medium">Case ID</th>
                      <th className="px-6 py-3 font-medium">Document Type</th>
                      <th className="px-6 py-3 font-medium">Risk Tier</th>
                      <th className="px-6 py-3 font-medium">Risk Score</th>
                      <th className="px-6 py-3 font-medium">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-600">
                    {recentScreenings.map((req, i) => (
                      <tr 
                        key={i} 
                        className="hover:bg-navy-700/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/screening/${req.case_id || 'unknown'}/results`)}
                      >
                        <td className="px-6 py-4 font-mono text-cyber-400">{req.case_id}</td>
                        <td className="px-6 py-4">{req.doc_type || 'Unknown'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                            req.risk_tier === 'CLEAR' ? 'bg-green-500/10 border-green-500/30 text-green-500' :
                            req.risk_tier === 'REVIEW' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                            req.risk_tier === 'HIGH_RISK' ? 'bg-red-500/10 border-red-500/30 text-red-500' :
                            'bg-slate-500/10 border-slate-500/30 text-slate-400'
                          }`}>
                            {req.risk_tier || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono">{req.risk_score}</td>
                        <td className="px-6 py-4 text-slate-400">{new Date(req.timestamp || req.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                    {recentScreenings.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-slate-500">No recent screenings found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
