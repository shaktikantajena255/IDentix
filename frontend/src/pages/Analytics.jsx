import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, ShieldCheck, AlertTriangle, XOctagon, FileText, RefreshCw, Clock } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../lib/api';

const COLORS = {
  CLEAR: '#22c55e',
  REVIEW: '#f59e0b',
  HIGH_RISK: '#ef4444',
};

function Bar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-4 bg-navy-900 rounded-full overflow-hidden border border-navy-700">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono text-slate-300 w-8 text-right">{value}</span>
    </div>
  );
}

function DonutChart({ clear, review, high }) {
  const total = clear + review + high || 1;
  const clearPct = (clear / total) * 100;
  const reviewPct = (review / total) * 100;
  const highPct = (high / total) * 100;

  // SVG donut
  const r = 60, cx = 70, cy = 70, stroke = 22;
  const circ = 2 * Math.PI * r;
  const segments = [
    { pct: clearPct, color: COLORS.CLEAR, offset: 0 },
    { pct: reviewPct, color: COLORS.REVIEW, offset: clearPct },
    { pct: highPct, color: COLORS.HIGH_RISK, offset: clearPct + reviewPct },
  ];

  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
      {segments.map((s, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${(s.pct / 100) * circ} ${circ}`}
          strokeDashoffset={-((s.offset / 100) * circ)}
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeLinecap="butt"
          opacity={s.pct > 0 ? 1 : 0}
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#e2e8f0" fontSize={22} fontWeight="bold">
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize={11}>
        total
      </text>
    </svg>
  );
}

function StatBlock({ icon: Icon, label, value, sub, color }) {
  const colorMap = {
    cyan: 'text-cyber-500 bg-cyber-500/10 border-cyber-500/20',
    green: 'text-green-500 bg-green-500/10 border-green-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-500 bg-red-500/10 border-red-500/20',
  };
  const cls = colorMap[color] || colorMap.cyan;
  return (
    <div className={`rounded-xl p-5 border ${cls}`}>
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium text-slate-400">{label}</span>
      </div>
      <p className="text-3xl font-bold text-slate-100">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

const Analytics = () => {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [statsRes, histRes] = await Promise.all([
        api.get('/api/analytics/stats').catch(() => ({ data: null })),
        api.get('/api/history').catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data);
      setHistory(histRes.data || []);
    } catch (_) { }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const total = stats?.total_screenings ?? history.length;
  const clear = stats?.clear_count ?? history.filter(r => r.risk_tier === 'CLEAR').length;
  const review = stats?.review_count ?? history.filter(r => r.risk_tier === 'REVIEW').length;
  const highRisk = stats?.high_risk_count ?? history.filter(r => r.risk_tier === 'HIGH_RISK').length;
  const insuff = history.filter(r => !r.risk_tier || r.risk_tier === null).length;

  // Average risk score (exclude null)
  const scored = history.filter(r => r.risk_score != null);
  const avgScore = scored.length ? Math.round(scored.reduce((a, b) => a + b.risk_score, 0) / scored.length) : '—';

  // Doc type breakdown
  const docTypes = history.reduce((acc, r) => {
    const t = r.doc_type || 'UNKNOWN';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const maxDocCount = Math.max(...Object.values(docTypes), 1);

  // Last 7 days by day
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toLocaleDateString('en-CA');
    const count = history.filter(r => r.created_at?.startsWith(key) || (r.created_at && new Date(r.created_at).toLocaleDateString('en-CA') === key)).length;
    return { label: d.toLocaleDateString('en', { weekday: 'short' }), count };
  });
  const maxDay = Math.max(...last7.map(d => d.count), 1);

  // Average processing time
  const timed = history.filter(r => r.processing_time != null);
  const avgTime = timed.length ? (timed.reduce((a, b) => a + b.processing_time, 0) / timed.length).toFixed(1) : '—';

  return (
    <div className="flex h-screen bg-navy-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-200">Analytics</h1>
            <p className="text-slate-400 mt-1">Operational metrics and risk distribution across all screenings</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 border border-navy-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </header>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <RefreshCw className="w-8 h-8 text-cyber-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatBlock icon={FileText} label="Total Screenings" value={total} sub="all time" color="cyan" />
              <StatBlock icon={ShieldCheck} label="Clear" value={clear} sub={`${total ? Math.round(clear / total * 100) : 0}% pass rate`} color="green" />
              <StatBlock icon={AlertTriangle} label="Review" value={review} sub="needs inspection" color="amber" />
              <StatBlock icon={XOctagon} label="High Risk" value={highRisk} sub="immediate action" color="red" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Donut */}
              <div className="bg-navy-800 border border-navy-600 rounded-xl p-6 flex flex-col items-center">
                <h2 className="text-base font-bold text-slate-200 mb-4 self-start">Risk Distribution</h2>
                <DonutChart clear={clear} review={review} high={highRisk} />
                <div className="flex gap-4 mt-4 text-xs">
                  {[['CLEAR', COLORS.CLEAR], ['REVIEW', COLORS.REVIEW], ['HIGH RISK', COLORS.HIGH_RISK]].map(([l, c]) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                      <span className="text-slate-400">{l}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metrics */}
              <div className="bg-navy-800 border border-navy-600 rounded-xl p-6">
                <h2 className="text-base font-bold text-slate-200 mb-6">Performance Metrics</h2>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Avg. Risk Score</span>
                      <span className="font-mono font-bold text-slate-200">{avgScore}</span>
                    </div>
                    {typeof avgScore === 'number' && (
                      <div className="h-2 bg-navy-900 rounded-full overflow-hidden border border-navy-700">
                        <div className="h-full bg-cyber-500 rounded-full" style={{ width: `${avgScore}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Avg. Processing Time</span>
                    <span className="font-mono font-bold text-slate-200">{avgTime}s</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Insufficient Evidence</span>
                    <span className="font-mono font-bold text-amber-400">{insuff}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">High-Risk Rate</span>
                    <span className="font-mono font-bold text-red-400">
                      {total ? `${Math.round(highRisk / total * 100)}%` : '0%'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Document Types */}
              <div className="bg-navy-800 border border-navy-600 rounded-xl p-6">
                <h2 className="text-base font-bold text-slate-200 mb-6">Document Types</h2>
                {Object.keys(docTypes).length === 0 ? (
                  <p className="text-slate-500 text-sm text-center mt-8">No data yet</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(docTypes).sort((a, b) => b[1] - a[1]).map(([t, c]) => (
                      <Bar key={t} label={t} value={c} max={maxDocCount} color="#06b6d4" />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Last 7 days bar chart */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl p-6">
              <h2 className="text-base font-bold text-slate-200 mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyber-500" /> Screenings — Last 7 Days
              </h2>
              <div className="flex items-end gap-4 h-40">
                {last7.map(({ label, count }) => (
                  <div key={label} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">{count || ''}</span>
                    <div className="w-full flex items-end justify-center" style={{ height: '100px' }}>
                      <div
                        className="w-full rounded-t-md transition-all duration-700"
                        style={{
                          height: `${Math.max((count / maxDay) * 100, count > 0 ? 8 : 0)}%`,
                          backgroundColor: count > 0 ? '#06b6d4' : '#1e293b',
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Analytics;
