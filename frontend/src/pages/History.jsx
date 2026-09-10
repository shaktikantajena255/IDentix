import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../lib/api';

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/api/history');
        setHistory(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setError('Failed to load history data');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredHistory = history.filter(item => 
    (item.case_id && item.case_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.extracted_name && item.extracted_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex h-screen bg-navy-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-200 flex items-center gap-3">
              Screening History
              <span className="bg-navy-700 text-cyber-400 text-sm py-1 px-3 rounded-full font-mono">
                {history.length} Total
              </span>
            </h1>
          </div>
          <div className="relative w-64">
            <input 
              type="text" 
              placeholder="Search Case ID or Name..."
              className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-10 pr-4 py-2 text-slate-200 focus:outline-none focus:border-cyber-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-12 h-12 animate-spin text-cyber-500" />
          </div>
        ) : error ? (
          <div className="text-red-500 bg-red-500/10 p-4 rounded-lg border border-red-500/30">{error}</div>
        ) : (
          <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-navy-900/50 text-slate-400 border-b border-navy-600">
                  <tr>
                    <th className="px-6 py-4 font-medium">Case ID</th>
                    <th className="px-6 py-4 font-medium">Document Type</th>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Risk Tier</th>
                    <th className="px-6 py-4 font-medium">Score</th>
                    <th className="px-6 py-4 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-600/50">
                  {filteredHistory.map((req, i) => (
                    <tr 
                      key={i} 
                      className="hover:bg-navy-700/50 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/screening/${req.case_id}/results`)}
                    >
                      <td className="px-6 py-4 font-mono text-cyber-400 group-hover:text-cyber-300">{req.case_id}</td>
                      <td className="px-6 py-4">{req.doc_type || 'Unknown'}</td>
                      <td className="px-6 py-4 font-medium">{req.extracted_name || '-'}</td>
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
                      <td className="px-6 py-4 font-mono font-medium">{req.risk_score !== undefined ? req.risk_score : '-'}</td>
                      <td className="px-6 py-4 text-slate-400">{new Date(req.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-500 text-lg">No screening records found matching "{searchTerm}".</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default History;
