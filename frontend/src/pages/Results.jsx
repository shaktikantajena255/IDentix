import { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileDown, Loader2 } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import RiskBadge from '../components/RiskBadge';
import CheckResult from '../components/CheckResult';
import api from '../lib/api';

function playChime(type) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  
  if (type === 'success') {
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.4);
    });
  } else if (type === 'alert') {
    [440, 330].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.3 + 0.5);
      osc.start(ctx.currentTime + i * 0.3);
      osc.stop(ctx.currentTime + i * 0.3 + 0.5);
    });
  }
}

const Results = () => {
  const { caseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [result, setResult] = useState(location.state?.result || null);
  const [loading, setLoading] = useState(!result);
  const [error, setError] = useState(null);
  const [sessionTime, setSessionTime] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSessionTime(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!result) {
      const fetchResult = async () => {
        try {
          const res = await api.get(`/api/screening/${caseId}`);
          setResult(res.data);
          
          if (res.data.risk_tier === 'CLEAR') playChime('success');
          else if (res.data.risk_tier === 'HIGH_RISK') playChime('alert');
          
        } catch (err) {
          setError('Failed to load screening results.');
        } finally {
          setLoading(false);
        }
      };
      fetchResult();
    } else {
      if (result.risk_tier === 'CLEAR') playChime('success');
      else if (result.risk_tier === 'HIGH_RISK') playChime('alert');
    }
  }, [caseId, result]);

  const downloadReport = async () => {
    try {
      const response = await api.get(`/api/report/${caseId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IDentix-Report-${caseId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download report.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-navy-900">
        <Sidebar />
        <main className="flex-1 flex justify-center items-center">
          <Loader2 className="w-12 h-12 text-cyber-500 animate-spin" />
        </main>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex h-screen bg-navy-900">
        <Sidebar />
        <main className="flex-1 p-8 text-center text-red-500">
          {error || 'Result not found.'}
        </main>
      </div>
    );
  }

  const checks = result.checks || {};

  // Pipeline returns flat fields: extracted_name, extracted_dob, etc.
  const extracted = {
    name: result.extracted_name,
    document_number: result.extracted_doc_number,
    dob: result.extracted_dob,
    expiry: result.extracted_expiry,
    nationality: result.extracted_nationality,
    document_type: result.doc_type,
  };

  return (
    <div className="flex h-screen bg-navy-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 relative">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/screening/new')} className="p-2 bg-navy-800 hover:bg-navy-700 text-slate-300 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-200">Screening Results</h1>
              <p className="text-sm font-mono text-cyber-500 mt-1">CASE ID: {result.case_id}</p>
            </div>
          </div>
          <div className="text-right text-sm text-slate-400">
            <p>Verified in {(result.processing_time || 0).toFixed(1)} seconds</p>
            <p>Session time: {sessionTime}s</p>
          </div>
        </header>

        <div className="mb-8">
          <RiskBadge tier={result.risk_tier} score={result.risk_score} />
          {result.risk_explanation && (
            <div className="mt-4 bg-navy-800 border border-navy-600 text-slate-300 p-4 rounded-lg text-sm leading-relaxed">
              <span className="text-slate-500 font-medium uppercase text-xs tracking-wider">AI Explanation: </span>
              {result.risk_explanation}
            </div>
          )}
          {result.insufficient_evidence && (
             <div className="mt-4 bg-amber-500/10 border border-amber-500/30 text-amber-500 p-4 rounded-lg flex items-center gap-3">
               <span className="font-bold">⚠️ Insufficient Evidence</span> — Manual Verification Required. System could not confidently determine risk tier.
             </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-lg font-bold text-slate-200 mb-4 border-b border-navy-700 pb-2">Verification Checks</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CheckResult name="Document Type" status={checks.doc_type?.status} detail={checks.doc_type?.detail} />
              <CheckResult name="OCR & Field Extraction" status={checks.ocr?.status} detail={checks.ocr?.detail} />
              <CheckResult name="MRZ Checksum" status={checks.mrz?.status} detail={checks.mrz?.detail} />
              <CheckResult name="Forensic Tamper (ELA)" status={checks.tamper?.status} detail={checks.tamper?.detail} />
              <CheckResult name="Face Verification" status={checks.face?.status} detail={checks.face?.detail} />
              <CheckResult name="Watchlist Check" status={checks.watchlist?.status} detail={checks.watchlist?.detail} />
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-bold text-slate-200 mb-4 border-b border-navy-700 pb-2">Extracted Data</h2>
              <div className="bg-navy-800 border border-navy-600 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Name</div>
                    <div className="font-medium text-slate-200">{extracted.name || <span className="italic text-slate-500">Not detected</span>}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Document Number</div>
                    <div className="font-mono text-slate-200">{extracted.document_number || <span className="italic text-slate-500">Not detected</span>}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Date of Birth</div>
                    <div className="font-medium text-slate-200">{extracted.dob || <span className="italic text-slate-500">Not detected</span>}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Expiry Date</div>
                    <div className="font-medium text-slate-200">{extracted.expiry || <span className="italic text-slate-500">Not detected</span>}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Nationality</div>
                    <div className="font-medium text-slate-200">{extracted.nationality || <span className="italic text-slate-500">Not detected</span>}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Document Type</div>
                    <div className="font-medium text-slate-200">{extracted.document_type || <span className="italic text-slate-500">Not detected</span>}</div>
                  </div>
                </div>
              </div>
            </div>

            {result.ela_image_b64 && (
              <div>
                <h2 className="text-lg font-bold text-slate-200 mb-4 border-b border-navy-700 pb-2">Forensic Evidence Heatmap</h2>
                <div className="bg-navy-800 border border-navy-600 rounded-xl p-2 relative">
                  <img src={`data:image/png;base64,${result.ela_image_b64}`} alt="ELA Heatmap" className="w-full h-auto rounded-lg" />
                  {result.suspicious_region && (
                    <div className="mt-2 text-sm text-amber-500 font-mono text-center">
                      Suspicious region: [x:{result.suspicious_region?.x}, y:{result.suspicious_region?.y}, w:{result.suspicious_region?.w}, h:{result.suspicious_region?.h}]
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4 border-t border-navy-700 pt-6">
          <button
            onClick={downloadReport}
            className="bg-navy-700 hover:bg-navy-600 text-slate-200 px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors"
          >
            <FileDown className="w-5 h-5" /> Download Report
          </button>
          <button
            onClick={() => navigate('/screening/new')}
            className="bg-cyber-500 hover:bg-cyber-600 text-white px-6 py-3 rounded-lg font-bold transition-colors ml-auto"
          >
            New Screening
          </button>
        </div>
      </main>
    </div>
  );
};

export default Results;
