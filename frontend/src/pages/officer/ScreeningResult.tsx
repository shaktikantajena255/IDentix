import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, FileDown, ShieldCheck, ShieldX, ShieldAlert, Clock, Volume2, VolumeX } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { PageHeader } from '../../components/common/PageHeader';
import type { ScreeningResult as Result } from '../../services/legacyApi';

// ── Voice feedback ─────────────────────────────────────────────────────────────
function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    const voiceEnabled = localStorage.getItem('identix_voice_enabled');
    if (voiceEnabled === 'false') return;
    // Cancel any queued speech to avoid duplicates
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Fail silently — voice must never block the UI
  }
}

// ── Check display helpers ──────────────────────────────────────────────────────
const CHECK_LABELS: Record<string, string> = {
  preprocessing: 'Image Preprocessing',
  doc_type: 'Document Type Detection',
  ocr: 'OCR & Field Extraction',
  mrz: 'MRZ Checksum (ICAO 9303)',
  cross_field: 'Cross-Field Validation',
  expiry: 'Document Validity (Expiry)',
  tamper: 'Forensic Analysis (ELA)',
  face: 'Face Verification',
  watchlist: 'Watchlist Check',
};

const statusStyle = (status: string) => {
  if (status === 'PASSED') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'FAILED') return 'bg-red-100 text-red-800 border-red-200';
  if (status === 'INCONCLUSIVE') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200'; // UNAVAILABLE
};

const statusIcon = (status: string) => {
  if (status === 'PASSED') return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
  if (status === 'FAILED') return <ShieldX className="w-4 h-4 text-red-600" />;
  if (status === 'INCONCLUSIVE') return <ShieldAlert className="w-4 h-4 text-amber-600" />;
  return <Clock className="w-4 h-4 text-slate-400" />;
};

// ── Risk tier display ──────────────────────────────────────────────────────────
const tierBadge = (tier: string | null) => {
  if (tier === 'CLEAR') return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-sm">
      <ShieldCheck className="w-5 h-5" /> CLEAR — Document Approved
    </div>
  );
  if (tier === 'HIGH_RISK') return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-100 border border-red-200 text-red-800 font-bold text-sm">
      <ShieldX className="w-5 h-5" /> HIGH RISK — Manual Verification Required
    </div>
  );
  if (tier === 'REVIEW') return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 font-bold text-sm">
      <ShieldAlert className="w-5 h-5" /> REVIEW — Secondary Inspection Needed
    </div>
  );
  return null;
};

// ── Main Component ─────────────────────────────────────────────────────────────
export const ScreeningResult: React.FC = () => {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const location = useLocation();
  const [result, setResult] = useState<Result | null>(
    (location.state as { result?: Result } | null)?.result ?? null
  );
  const [loading, setLoading] = useState(!result);
  const [reportError, setReportError] = useState<string | null>(null);
  const [voiceMuted, setVoiceMuted] = useState(
    localStorage.getItem('identix_voice_enabled') === 'false'
  );

  // Fetch result from backend if not in router state
  useEffect(() => {
    if (result) return;
    const token = sessionStorage.getItem('identix_access_token');
    fetch(`/api/screening/${caseId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => { setResult(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [caseId, result]);

  // Voice feedback — runs once result is available
  useEffect(() => {
    if (!result) return;
    if (result.insufficient_evidence) {
      speak('Insufficient evidence. Manual verification required.');
    } else if (result.risk_tier === 'CLEAR') {
      speak('Verification complete. Document cleared.');
    } else if (result.risk_tier === 'REVIEW') {
      speak('Verification requires manual review.');
    } else if (result.risk_tier === 'HIGH_RISK') {
      speak('High risk detected. Manual verification required.');
    }
  }, [result]);

  const toggleVoice = () => {
    const newVal = !voiceMuted;
    setVoiceMuted(newVal);
    localStorage.setItem('identix_voice_enabled', newVal ? 'false' : 'true');
    window.speechSynthesis?.cancel();
  };

  const download = async () => {
    setReportError(null);
    const token = sessionStorage.getItem('identix_access_token');
    try {
      const response = await fetch(`/api/report/${caseId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `IDentix-Report-${caseId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setReportError('Report could not be downloaded. Backend may be unavailable.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Loading Screening Result…" />
        <Card><p className="text-sm text-slate-500">Fetching record from backend…</p></Card>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-6">
        <PageHeader title="Screening Result Unavailable" />
        <Card>
          <p className="text-sm text-slate-600">
            The result payload was not found. Return to New Screening and submit again.
          </p>
          <Button className="mt-4" onClick={() => navigate('/officer/screening/new')}>
            New Screening
          </Button>
        </Card>
      </div>
    );
  }

  const checks = result.checks || {};
  const fields: [string, string | undefined][] = [
    ['Name', result.extracted_name],
    ['Document Number', result.extracted_doc_number],
    ['Date of Birth', result.extracted_dob],
    ['Expiry Date', result.extracted_expiry],
    ['Nationality', result.extracted_nationality],
    ['Document Type', result.doc_type],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Screening Results"
        subtitle={`Case ID: ${result.case_id} • Backend processing time: ${result.processing_time?.toFixed(1) ?? '?'} seconds`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoice}
              title={voiceMuted ? 'Enable voice feedback' : 'Mute voice feedback'}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              {voiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <Button
              variant="outline"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate('/officer/screening/new')}
            >
              New Screening
            </Button>
          </div>
        }
      />

      {/* Insufficient Evidence Banner */}
      {result.insufficient_evidence && (
        <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong>Insufficient Evidence — Manual Verification Required.</strong>
            <p className="mt-1 text-xs text-amber-800">{result.risk_explanation}</p>
          </div>
        </div>
      )}

      {/* Risk Summary */}
      {!result.insufficient_evidence && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <p className="text-xs uppercase text-slate-500 font-semibold">Risk Assessment</p>
            <p className="text-4xl font-bold text-slate-900 mt-2 font-mono">
              {result.risk_score ?? '—'}<span className="text-lg text-slate-400">/100</span>
            </p>
            <div className="mt-3">{tierBadge(result.risk_tier)}</div>
            <p className="text-xs text-slate-600 mt-4 leading-relaxed">{result.risk_explanation}</p>
            <div className="mt-3 text-[11px] text-slate-400 border-t pt-2">
              Risk formula: Face 40% · Tamper 35% · OCR+Cross-field 25%
            </div>
          </Card>

          {/* Verification Checks Grid */}
          <Card className="lg:col-span-2" cardTitle="Verification Checks">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(checks).map(([key, check]) => (
                <div
                  key={key}
                  className={`rounded-lg border p-3 ${statusStyle(check.status)}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2">
                      {statusIcon(check.status)}
                      <span className="font-semibold text-xs">
                        {CHECK_LABELS[key] || key}
                      </span>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-xs font-bold border ${statusStyle(check.status)}`}>
                      {check.status}
                    </span>
                  </div>
                  {check.detail && (
                    <p className="text-[11px] mt-2 leading-snug opacity-80">{check.detail}</p>
                  )}
                  {(check as { match_percentage?: number }).match_percentage != null && (
                    <p className="text-[11px] mt-1 font-mono">
                      Face similarity: {(check as { match_percentage: number }).match_percentage.toFixed(1)}%
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Extracted Fields */}
      <Card cardTitle="Extracted Document Fields">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fields.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs uppercase text-slate-500 font-semibold">{label}</p>
              <p className="font-medium text-slate-900 mt-1 font-mono text-sm">
                {value || <span className="italic text-slate-400 font-sans">Not detected</span>}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Forensic Heatmap */}
      {result.ela_image_b64 && (
        <Card cardTitle="Forensic Evidence Heatmap (ELA)">
          <p className="text-xs text-slate-500 mb-3">
            Error Level Analysis visualisation. Bright regions indicate higher recompression
            residuals. This is forensic evidence — not proof of tampering.
          </p>
          <img
            className="max-w-full rounded-lg border border-slate-200"
            src={`data:image/png;base64,${result.ela_image_b64}`}
            alt="Backend-generated ELA forensic heatmap"
          />
          {result.suspicious_region && (
            <p className="text-xs text-amber-700 font-mono mt-2">
              Highest-activity region: x={result.suspicious_region.x} y={result.suspicious_region.y}{' '}
              w={result.suspicious_region.w} h={result.suspicious_region.h}
            </p>
          )}
        </Card>
      )}

      {/* Download Report */}
      {reportError && <p className="text-sm text-red-700">{reportError}</p>}
      <Button variant="secondary" icon={<FileDown className="w-4 h-4" />} onClick={download}>
        Download Investigation Report (PDF)
      </Button>
    </div>
  );
};
