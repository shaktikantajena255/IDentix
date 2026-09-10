/**
 * DemoLab — Officer Demo Lab for IDentix.
 *
 * Lists 10 controlled synthetic test cases. When an officer clicks
 * "Run Test", the real production pipeline is called with the pre-built
 * demo images. No results are hardcoded or fabricated.
 *
 * All demo documents contain the disclaimer:
 *   "IDentix DEMO — NOT A REAL DOCUMENT"
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FlaskConical,
  Loader2,
  Play,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { PageHeader } from '../../components/common/PageHeader';

interface DemoCase {
  id: string;
  test_id: string;
  label: string;
  description: string;
  expected: string;
  has_selfie: boolean;
}

function authHeaders() {
  const token = sessionStorage.getItem('identix_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Converts base64 string to a File object */
function b64ToFile(b64: string, filename: string, mime = 'image/png'): File {
  const byteStr = atob(b64);
  const arr = new Uint8Array(byteStr.length);
  for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

const EXPECTED_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  CLEAR: {
    label: 'Expected: CLEAR',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />,
  },
  REVIEW: {
    label: 'Expected: REVIEW',
    color: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
  },
  HIGH_RISK: {
    label: 'Expected: HIGH RISK',
    color: 'bg-red-50 border-red-200 text-red-800',
    icon: <ShieldAlert className="w-3.5 h-3.5 text-red-600" />,
  },
  INSUFFICIENT: {
    label: 'Expected: INSUFFICIENT',
    color: 'bg-slate-50 border-slate-200 text-slate-700',
    icon: <AlertCircle className="w-3.5 h-3.5 text-slate-500" />,
  },
  INCONCLUSIVE: {
    label: 'Expected: INCONCLUSIVE',
    color: 'bg-slate-50 border-slate-200 text-slate-700',
    icon: <AlertCircle className="w-3.5 h-3.5 text-slate-400" />,
  },
};

export const DemoLab: React.FC = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<DemoCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [runErrors, setRunErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/demo/cases', { headers: authHeaders() });
        if (res.ok) {
          setCases(await res.json());
        } else {
          setFetchError('Could not load demo cases from backend.');
        }
      } catch {
        setFetchError('Backend unavailable. Start the IDentix backend server.');
      } finally {
        setLoadingCases(false);
      }
    };
    load();
  }, []);

  const runTest = async (c: DemoCase) => {
    setRunning((prev) => ({ ...prev, [c.id]: true }));
    setRunErrors((prev) => ({ ...prev, [c.id]: '' }));
    try {
      // 1. Fetch the demo document and selfie images (base64)
      const res = await fetch(`/api/demo/case/${c.id}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch demo case images.');
      const data = await res.json();

      // 2. Convert to File objects
      const docFile = b64ToFile(data.doc_image_b64, `${c.id}_doc.png`);
      const selfieFile = data.selfie_b64
        ? b64ToFile(data.selfie_b64, `${c.id}_selfie.png`)
        : null;

      // 3. Submit to the REAL pipeline via /api/screening/start
      const formData = new FormData();
      formData.append('document_image', docFile, docFile.name);
      if (selfieFile) {
        formData.append('selfie_image', selfieFile, selfieFile.name);
      }

      const token = sessionStorage.getItem('identix_access_token');
      const screenRes = await fetch('/api/screening/start', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!screenRes.ok) {
        const errData = await screenRes.json().catch(() => ({}));
        throw new Error(errData.detail || `Pipeline error (${screenRes.status})`);
      }

      const result = await screenRes.json();

      // 4. Navigate to results page
      navigate(`/officer/screening/${result.case_id}/results`, {
        state: { result, isDemo: true, expectedOutcome: c.expected },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setRunErrors((prev) => ({ ...prev, [c.id]: msg }));
    } finally {
      setRunning((prev) => ({ ...prev, [c.id]: false }));
    }
  };

  const TEST_ICONS: Record<number, React.ReactNode> = {
    1: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
    2: <AlertCircle className="w-4 h-4 text-amber-600" />,
    3: <Eye className="w-4 h-4 text-amber-600" />,
    4: <XCircle className="w-4 h-4 text-red-600" />,
    5: <Clock className="w-4 h-4 text-amber-500" />,
    6: <ShieldAlert className="w-4 h-4 text-red-700" />,
    7: <ShieldAlert className="w-4 h-4 text-red-700" />,
    8: <AlertCircle className="w-4 h-4 text-slate-500" />,
    9: <AlertCircle className="w-4 h-4 text-slate-400" />,
    10: <Eye className="w-4 h-4 text-slate-500" />,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demo Lab"
        subtitle="10 controlled synthetic test cases for judges and reviewers. All documents are fictional. Every test calls the real production verification pipeline."
        badge={<Badge variant="neutral">{cases.length} Test Cases</Badge>}
      />

      {/* Disclaimer */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3">
        <FlaskConical className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">IDentix DEMO — NOT A REAL DOCUMENT</p>
          <p>
            All demo documents use entirely fictional identities and are clearly marked as synthetic
            test material. No real personal data is used. Results are generated by the real pipeline —
            outcomes may vary based on OCR quality, ELA analysis, and face recognition availability.
          </p>
        </div>
      </div>

      {loadingCases && (
        <div className="flex items-center justify-center py-12 gap-3 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading demo cases…</span>
        </div>
      )}

      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {fetchError}
        </div>
      )}

      {!loadingCases && !fetchError && cases.length === 0 && (
        <Card>
          <div className="py-8 text-center text-sm text-slate-500">
            No demo cases found. Run{' '}
            <code className="font-mono text-xs bg-slate-100 px-1 rounded">
              python generate_demo_docs.py
            </code>{' '}
            in the backend directory to generate them.
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cases.map((c, idx) => {
          const testNum = idx + 1;
          const exp = EXPECTED_LABELS[c.expected] ?? EXPECTED_LABELS.INCONCLUSIVE;
          const isRunning = running[c.id] || false;
          const err = runErrors[c.id];

          return (
            <Card key={c.id}>
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-xs text-slate-600">
                    {testNum}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {TEST_ICONS[testNum]}
                      <p className="text-sm font-semibold text-slate-900 leading-tight">
                        {c.label}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">{c.description}</p>
                  </div>
                </div>

                {/* Expected outcome badge */}
                <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${exp.color}`}>
                  {exp.icon}
                  {exp.label}
                </div>

                {/* Selfie note */}
                {!c.has_selfie && (
                  <p className="text-xs text-slate-400 italic">
                    No selfie for this test — face verification will be UNAVAILABLE.
                  </p>
                )}

                {/* Error */}
                {err && (
                  <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {err}
                  </div>
                )}

                {/* Run button */}
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isRunning}
                  isLoading={isRunning}
                  icon={
                    isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )
                  }
                  onClick={() => runTest(c)}
                >
                  {isRunning ? 'Running pipeline…' : 'Run Test'}
                </Button>

                {/* Expected vs actual note */}
                {!isRunning && !err && (
                  <p className="text-[11px] text-slate-400">
                    Sends demo images to the real pipeline. Results shown on the standard Results page.
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Run all note */}
      {cases.length > 0 && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500">
          <strong className="text-slate-700">Note for judges:</strong> Each "Run Test" submits the
          synthetic document to the live IDentix backend pipeline. Processing may take 10–30 seconds
          per case. OCR, ELA forensics, and face verification run in real time. Results may differ
          from the expected outcome if Tesseract, OpenCV, or face_recognition libraries are
          unavailable — the pipeline gracefully marks those checks UNAVAILABLE.
        </div>
      )}
    </div>
  );
};
