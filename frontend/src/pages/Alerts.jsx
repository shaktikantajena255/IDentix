import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, AlertTriangle, Eye, RefreshCw, Bell, ShieldCheck, Volume2 } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../lib/api';

function chime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [440, 330, 220].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f; o.type = 'square';
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.2);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.4);
      o.start(ctx.currentTime + i * 0.2); o.stop(ctx.currentTime + i * 0.2 + 0.5);
    });
  } catch (_) {}
}

function speak(text) {
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9; window.speechSynthesis.speak(u);
  }
}

const Alerts = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCount, setLastCount] = useState(0);
  const prevHighRef = useRef(0);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.get('/api/history');
      const alerts = (res.data || [])
        .filter(r => r.risk_tier === 'HIGH_RISK' || r.risk_tier === 'REVIEW')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      const highCount = alerts.filter(r => r.risk_tier === 'HIGH_RISK').length;
      if (highCount > prevHighRef.current && prevHighRef.current !== 0) {
        chime();
        speak('New high risk alert detected. Immediate attention required.');
      }
      prevHighRef.current = highCount;
      setLastCount(highCount);
      setRecords(alerts);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const id = setInterval(() => load(true), 30000);
    return () => clearInterval(id);
  }, []);

  const highRisk = records.filter(r => r.risk_tier === 'HIGH_RISK');
  const review   = records.filter(r => r.risk_tier === 'REVIEW');

  const AlertRow = ({ record }) => {
    const isHigh = record.risk_tier === 'HIGH_RISK';
    return (
      <div className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
        isHigh ? 'border-red-500/40 bg-red-500/8 hover:bg-red-500/12' : 'border-amber-500/30 bg-amber-500/8 hover:bg-amber-500/12'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          {isHigh
            ? <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
            : <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          }
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-cyber-400">{record.case_id}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                isHigh ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              }`}>
                {isHigh ? 'HIGH RISK' : 'REVIEW'}
              </span>
              {record.risk_score != null && (
                <span className="text-xs text-slate-400">Score: {record.risk_score}</span>
              )}
            </div>
            <p className="text-sm text-slate-300 mt-0.5 truncate">
              {record.extracted_name && record.extracted_name !== 'Not detected' ? record.extracted_name : 'Identity unverified'}
              {' · '}{record.doc_type || 'Unknown type'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{new Date(record.created_at).toLocaleString()}</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/screening/${record.case_id}/results`)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-navy-700 hover:bg-navy-600 text-slate-200 rounded-lg text-sm font-medium border border-navy-600 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Review
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-navy-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-200">Security Alerts</h1>
              {lastCount > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse">
                  <Volume2 className="w-3 h-3" /> {lastCount} Active
                </span>
              )}
            </div>
            <p className="text-slate-400 mt-1">Watchlist hits, biometric failures, forensic anomalies · Auto-refreshes every 30s</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 border border-navy-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </header>

        {/* Critical banner */}
        {highRisk.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/40 flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-red-500 shrink-0 animate-pulse" />
            <div>
              <p className="font-bold text-red-400">{highRisk.length} HIGH RISK {highRisk.length === 1 ? 'CASE' : 'CASES'} — Immediate Action Required</p>
              <p className="text-sm text-red-400/70 mt-0.5">These cases require immediate officer attention and physical verification.</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center h-48">
            <RefreshCw className="w-8 h-8 text-cyber-500 animate-spin" />
          </div>
        )}

        {!loading && records.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <ShieldCheck className="w-16 h-16 text-green-500/60 mb-4" />
            <h2 className="text-xl font-bold text-slate-300">No Active Alerts</h2>
            <p className="text-slate-500 mt-2 max-w-sm">All screenings are clear. High-risk anomalies detected by the verification engine will appear here.</p>
          </div>
        )}

        {!loading && highRisk.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> HIGH RISK — Immediate Attention ({highRisk.length})
            </h2>
            <div className="space-y-3">
              {highRisk.map(r => <AlertRow key={r.case_id} record={r} />)}
            </div>
          </section>
        )}

        {!loading && review.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5" /> REVIEW — Manual Inspection ({review.length})
            </h2>
            <div className="space-y-3">
              {review.map(r => <AlertRow key={r.case_id} record={r} />)}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Alerts;
