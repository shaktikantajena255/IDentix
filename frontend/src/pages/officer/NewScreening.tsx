/**
 * NewScreening — Officer document screening workflow.
 *
 * Step 1: Document Capture  (upload file OR live webcam snapshot)
 * Step 2: Live Selfie        (live webcam REQUIRED — not optional)
 * Step 3: Start Verification (disabled until BOTH document + selfie present)
 *
 * Webcam uses navigator.mediaDevices.getUserMedia().
 * Voice feedback at every key event (respects identix_voice_enabled setting).
 * Face verification is NEVER silently skipped.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ScanLine,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { PageHeader } from '../../components/common/PageHeader';
import { LegacyApiError, startScreening } from '../../services/legacyApi';
import { useWebcam } from '../../hooks/useWebcam';

// ── Voice helper ──────────────────────────────────────────────────────────────
function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    if (localStorage.getItem('identix_voice_enabled') === 'false') return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  } catch {
    /* voice failure must never block screening */
  }
}

// ── Webcam Panel ──────────────────────────────────────────────────────────────
interface WebcamPanelProps {
  /** Label used in file name when capturing */
  captureLabel: string;
  /** Called when a new image is captured or uploaded */
  onImage: (file: File | null) => void;
  /** Optional hint text shown under the heading */
  hint?: React.ReactNode;
  /** Whether upload fallback is allowed (document only) */
  allowUpload?: boolean;
  /** Camera facing mode: 'user' for selfie, 'environment' for document. Default: 'environment' */
  facingMode?: 'user' | 'environment';
  /** Called when the webcam state changes (for parent tracking) */
  onStateChange?: (state: string, error: { code: string; message: string } | null) => void;
}

const WebcamPanel: React.FC<WebcamPanelProps> = ({
  captureLabel,
  onImage,
  hint,
  allowUpload = false,
  facingMode = 'environment',
  onStateChange,
}) => {
  const cam = useWebcam({ facingMode });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notify parent whenever captured file changes
  useEffect(() => {
    onImage(cam.capturedFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.capturedFile]);

  // Notify parent whenever webcam state changes (for tracking camera failures)
  useEffect(() => {
    onStateChange?.(cam.state, cam.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.state, cam.error]);

  const handleCapture = useCallback(() => {
    const file = cam.capture(captureLabel);
    if (file) {
      onImage(file);
    }
  }, [cam, captureLabel, onImage]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Stop any running camera before switching to upload
    cam.stopCamera();
    onImage(file);
    // Reset so onChange fires again if same file is reselected
    e.target.value = '';
  };

  const handleRemoveUpload = () => {
    onImage(null);
  };

  // ── Captured state ─────────────────────────────────────────────────────────
  if (cam.state === 'captured' && cam.capturedPreview) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden border border-emerald-300 bg-emerald-50">
          <img
            src={cam.capturedPreview}
            alt="Captured image preview"
            className="w-full max-h-64 object-contain"
          />
          <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Captured
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => { cam.retake(); onImage(null); }}
          >
            Retake
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<X className="w-3.5 h-3.5" />}
            onClick={() => { cam.retake(); onImage(null); }}
          >
            Remove
          </Button>
        </div>
      </div>
    );
  }

  // ── Streaming state ────────────────────────────────────────────────────────
  if (cam.state === 'streaming') {
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden border-2 border-blue-400 bg-black">
          {/* Live video */}
          <video
            ref={cam.videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-64 object-contain"
            aria-label="Live camera preview"
          />
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 bg-white rounded-full" /> LIVE
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={<Camera className="w-3.5 h-3.5" />}
            onClick={handleCapture}
          >
            Capture
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<CameraOff className="w-3.5 h-3.5" />}
            onClick={cam.stopCamera}
          >
            Stop Camera
          </Button>
        </div>
      </div>
    );
  }

  // ── Starting state ─────────────────────────────────────────────────────────
  if (cam.state === 'starting') {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm">Requesting camera access…</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (cam.state === 'error' && cam.error) {
    return (
      <div className="space-y-3">
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Camera Unavailable</p>
            <p className="text-xs text-red-700 mt-1">{cam.error.message}</p>
            {!allowUpload && (
              <p className="text-xs text-red-600 mt-2 font-medium">
                Camera not available — face verification cannot proceed. This will be recorded as UNAVAILABLE.
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            icon={<Video className="w-3.5 h-3.5" />}
            onClick={cam.startCamera}
          >
            Retry Camera
          </Button>
          {allowUpload && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<Upload className="w-3.5 h-3.5" />}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Instead
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleUpload}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Idle state — show upload fallback if file already present from upload ──
  // (This handles the case where user used upload on a previous run)

  // ── Idle state ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="secondary"
          size="sm"
          icon={<Video className="w-3.5 h-3.5" />}
          onClick={cam.startCamera}
        >
          Start Camera
        </Button>
        {allowUpload && (
          <>
            <Button
              variant="outline"
              size="sm"
              icon={<Upload className="w-3.5 h-3.5" />}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleUpload}
            />
          </>
        )}
      </div>
    </div>
  );
};

// ── Upload-only preview (for document when uploaded via file) ─────────────────
interface UploadPreviewProps {
  file: File;
  preview: string;
  onRemove: () => void;
}
const UploadPreview: React.FC<UploadPreviewProps> = ({ file, preview, onRemove }) => (
  <div className="space-y-2">
    <div className="relative rounded-xl overflow-hidden border border-slate-200">
      <img src={preview} alt={file.name} className="w-full max-h-64 object-contain bg-slate-50" />
      <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
        <Upload className="w-3 h-3" /> Uploaded
      </div>
    </div>
    <p className="text-xs text-slate-500 font-mono truncate">{file.name}</p>
    <Button variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5" />} onClick={onRemove}>
      Remove
    </Button>
  </div>
);

// ── Step indicator ────────────────────────────────────────────────────────────
const StepDot: React.FC<{ n: number; done: boolean; active: boolean }> = ({ n, done, active }) => (
  <div
    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 transition-colors ${
      done
        ? 'bg-emerald-500 border-emerald-500 text-white'
        : active
        ? 'bg-blue-600 border-blue-600 text-white'
        : 'bg-white border-slate-200 text-slate-400'
    }`}
  >
    {done ? <CheckCircle2 className="w-4 h-4" /> : n}
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
export const NewScreening: React.FC = () => {
  const navigate = useNavigate();

  // ── Document state ─────────────────────────────────────────────────────────
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  // Track whether document came from upload (to show UploadPreview) vs webcam
  const [documentSource, setDocumentSource] = useState<'camera' | 'upload' | null>(null);

  // ── Selfie state ───────────────────────────────────────────────────────────
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  /** True once the user has attempted to start the selfie camera. */
  const [selfieAttempted, setSelfieAttempted] = useState(false);
  /** True when the selfie camera genuinely failed (no hardware or permission denied). */
  const [selfieCameraFailed, setSelfieCameraFailed] = useState(false);
  /** The error message from the failed camera, for display. */
  const [selfieCameraError, setSelfieCameraError] = useState<string | null>(null);

  // ── Submission state ───────────────────────────────────────────────────────
  const [processing, setProcessing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Object URL cleanup for document upload preview
  const docPreviewRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (docPreviewRef.current) URL.revokeObjectURL(docPreviewRef.current);
    };
  }, []);

  // ── Document handlers ──────────────────────────────────────────────────────
  const handleDocumentFromCamera = useCallback((file: File | null) => {
    setDocumentFile(file);
    if (file) {
      setDocumentSource('camera');
      // Preview is managed inside the WebcamPanel
      setDocumentPreview(null);
      speak('Document captured. Ready for selfie.');
    } else {
      setDocumentSource(null);
      setDocumentPreview(null);
    }
  }, []);

  const handleDocumentUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (docPreviewRef.current) URL.revokeObjectURL(docPreviewRef.current);
      const url = URL.createObjectURL(file);
      docPreviewRef.current = url;
      setDocumentFile(file);
      setDocumentPreview(url);
      setDocumentSource('upload');
      speak('Document received. Ready for selfie.');
      e.target.value = '';
    },
    []
  );

  const removeDocument = useCallback(() => {
    if (docPreviewRef.current) {
      URL.revokeObjectURL(docPreviewRef.current);
      docPreviewRef.current = null;
    }
    setDocumentFile(null);
    setDocumentPreview(null);
    setDocumentSource(null);
  }, []);

  // ── Selfie handler ─────────────────────────────────────────────────────────
  const handleSelfieFromCamera = useCallback((file: File | null) => {
    setSelfieFile(file);
    if (file) {
      setSelfieCameraFailed(false);
      setSelfieCameraError(null);
      speak('Live selfie captured.');
    }
  }, []);

  /** Track webcam state changes for the selfie panel. */
  const handleSelfieStateChange = useCallback((state: string, error: { code: string; message: string } | null) => {
    if (state === 'starting' || state === 'streaming') {
      setSelfieAttempted(true);
      setSelfieCameraFailed(false);
      setSelfieCameraError(null);
    }
    if (state === 'error' && error) {
      setSelfieAttempted(true);
      setSelfieCameraFailed(true);
      setSelfieCameraError(error.message);
      console.warn('[IDentix] Selfie camera failed:', error.code, error.message);
    }
  }, []);

  // ── Submission ─────────────────────────────────────────────────────────────
  // Allow submission when document is present AND (selfie captured OR camera genuinely failed)
  const canSubmit = !!documentFile && (!!selfieFile || selfieCameraFailed) && !processing;

  const handleSubmit = async () => {
    if (!documentFile && !selfieFile && !selfieCameraFailed) return;
    setProcessing(true);
    setSubmitError(null);
    speak('Document received, starting verification. Please wait.');

    // Log what is being sent to backend
    console.log('[IDentix] Starting screening submission:', {
      document: documentFile ? `${documentFile.name} (${(documentFile.size / 1024).toFixed(1)} KB)` : 'MISSING',
      selfie: selfieFile ? `${selfieFile.name} (${(selfieFile.size / 1024).toFixed(1)} KB)` : 'NOT PROVIDED (camera unavailable)',
      faceVerification: selfieFile ? 'Will be compared' : 'Will be marked UNAVAILABLE',
    });

    try {
      const result = await startScreening(documentFile!, selfieFile);
      speak('Verification in progress.');
      navigate(`/officer/screening/${result.case_id}/results`, { state: { result } });
    } catch (err) {
      const msg =
        err instanceof LegacyApiError
          ? err.message
          : 'Screening request failed. Check that the IDentix backend is running.';
      setSubmitError(msg);
      setProcessing(false);
    }
  };

  // ── Step progress ──────────────────────────────────────────────────────────
  const step1Done = !!documentFile;
  const step2Done = !!selfieFile || selfieCameraFailed;
  const step2Active = step1Done && !step2Done;
  const step3Active = step1Done && step2Done;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="New Screening Session"
        subtitle="Capture the travel document and a live selfie, then run the full 10-stage verification pipeline."
      />

      {/* Global submission error */}
      {submitError && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex items-center gap-3">
        <StepDot n={1} done={step1Done} active={!step1Done} />
        <div className={`h-0.5 flex-1 rounded-full transition-colors ${step1Done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
        <StepDot n={2} done={step2Done} active={step2Active} />
        <div className={`h-0.5 flex-1 rounded-full transition-colors ${step2Done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
        <StepDot n={3} done={false} active={step3Active} />
      </div>

      {/* ── Step 1 — Document Capture ───────────────────────────────────────── */}
      <Card
        cardTitle={
          <span className="flex items-center gap-2">
            <StepDot n={1} done={step1Done} active={!step1Done} />
            Step 1 — Document Capture
          </span>
        }
        subtitle="Use the live camera to photograph the travel document, or upload a file."
      >
        {/* If already have a file from upload, show preview first */}
        {documentSource === 'upload' && documentFile && documentPreview ? (
          <UploadPreview
            file={documentFile}
            preview={documentPreview}
            onRemove={removeDocument}
          />
        ) : documentSource === 'camera' && documentFile ? (
          /* Camera capture is shown inside WebcamPanel in 'captured' state.
             But we need to allow the user to see a confirmation here too. */
          <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Document captured via camera</p>
              <p className="text-xs text-emerald-700 mt-0.5">{documentFile.name}</p>
              <Button
                className="mt-2"
                variant="ghost"
                size="sm"
                icon={<X className="w-3.5 h-3.5" />}
                onClick={removeDocument}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Camera capture */}
            <WebcamPanel
              captureLabel="document"
              onImage={handleDocumentFromCamera}
              allowUpload={false}
              hint="Position the document flat, with good lighting. Avoid glare."
            />

            {/* Divider + upload alternative */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">or upload a scan</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <label className="flex items-center gap-3 cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-4 hover:border-blue-300 hover:bg-blue-50/40 transition-colors">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleDocumentUpload}
              />
              <Upload className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">Choose document image file</p>
                <p className="text-xs text-slate-400">JPEG, PNG or WebP</p>
              </div>
            </label>
          </div>
        )}
      </Card>

      {/* ── Step 2 — Live Selfie ────────────────────────────────────────────── */}
      <Card
        cardTitle={
          <span className="flex items-center gap-2">
            <StepDot n={2} done={step2Done} active={step2Active} />
            Step 2 — Live Selfie
          </span>
        }
        subtitle="Capture a live selfie of the traveller presenting the document."
      >
        {/* Required notice — only when not yet attempted */}
        {!step2Done && !selfieCameraFailed && (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-medium">
              Live selfie required for identity verification. Face verification is never silently skipped.
            </p>
          </div>
        )}

        {/* UNAVAILABLE banner — shown when camera genuinely failed after an attempt */}
        {selfieCameraFailed && !selfieFile && (
          <div className="flex gap-3 rounded-xl border border-slate-300 bg-slate-50 p-4 mb-4">
            <span className="text-lg shrink-0">⏸️</span>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Face Verification — UNAVAILABLE
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {selfieCameraError ?? 'Camera could not be accessed.'}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                This will be recorded as <strong>UNAVAILABLE</strong> in the pipeline. Per the evidence rules,
                2+ UNAVAILABLE checks will trigger an Insufficient Evidence outcome requiring manual verification.
              </p>
            </div>
          </div>
        )}

        <WebcamPanel
          captureLabel="selfie"
          onImage={handleSelfieFromCamera}
          allowUpload={false}
          facingMode="user"
          onStateChange={handleSelfieStateChange}
          hint="Ask the traveller to look directly at the camera with their face clearly visible."
        />
      </Card>

      {/* ── Step 3 — Start Verification ────────────────────────────────────── */}
      <Card
        cardTitle={
          <span className="flex items-center gap-2">
            <StepDot n={3} done={false} active={step3Active} />
            Step 3 — Start Verification
          </span>
        }
        subtitle="Sends both images to the 10-stage pipeline (OCR → MRZ → Cross-field → ELA → Face → Risk)."
      >
        {/* Checklist */}
        <div className="space-y-2 mb-5">
          <ChecklistItem done={step1Done} label="Document image captured or uploaded" />
          {selfieFile ? (
            <ChecklistItem done={true} label="Live selfie captured" />
          ) : selfieCameraFailed ? (
            <div className="flex items-center gap-2">
              <span className="text-base">⏸️</span>
              <span className="text-sm text-slate-500">
                Face Verification — <strong>UNAVAILABLE</strong> (camera failed — will be recorded as UNAVAILABLE)
              </span>
            </div>
          ) : (
            <ChecklistItem
              done={false}
              label="Live selfie captured"
              failLabel="Live selfie required — capture a selfie above"
            />
          )}
        </div>

        {/* Submit */}
        <Button
          variant="primary"
          size="lg"
          disabled={!canSubmit}
          isLoading={processing}
          icon={processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
          onClick={handleSubmit}
          id="btn-start-verification"
        >
          {processing ? 'Verification in progress…' : 'Start Verification'}
        </Button>

        {!canSubmit && !processing && (
          <p className="text-xs text-slate-400 mt-3">
            {!step1Done && !step2Done
              ? 'Complete Steps 1 and 2 to enable verification.'
              : !step1Done
              ? 'Complete Step 1 (document capture) to continue.'
              : !selfieAttempted
              ? 'Complete Step 2 (live selfie) to continue. Live selfie required for identity verification.'
              : selfieCameraFailed
              ? 'Camera unavailable — face verification will be UNAVAILABLE. You may proceed.'
              : 'Complete Step 2 (live selfie) to continue.'}
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
          Risk formula: Face 40% · Forensic/ELA 35% · OCR + Cross-field 25%
          &nbsp;|&nbsp; MRZ failure → 90+ · Watchlist → 95+
        </div>
      </Card>
    </div>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────────
const ChecklistItem: React.FC<{
  done: boolean;
  label: string;
  failLabel?: string;
}> = ({ done, label, failLabel }) => (
  <div className="flex items-center gap-2">
    {done ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
    ) : (
      <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
    )}
    <span className={`text-sm ${done ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
      {done ? label : (failLabel ?? label)}
    </span>
  </div>
);
