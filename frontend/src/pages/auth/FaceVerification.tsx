import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, AlertTriangle, CheckCircle2, ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type CameraState = 'INACTIVE' | 'STARTING' | 'ACTIVE' | 'ERROR';

/**
 * IDentix Officer Face Verification — Step 2 of 2
 *
 * Real WebRTC camera activation via getUserMedia.
 * Sends captured frame to POST /api/v1/auth/face-verify.
 *
 * Outcomes:
 *   BYPASS_ACTIVE              → Access granted (dev mode)
 *   BIOMETRIC_SERVICE_UNAVAILABLE → Honest error, no access
 *   BIOMETRIC_MISMATCH         → Face did not match, no access
 */
export const FaceVerification: React.FC = () => {
  const navigate = useNavigate();
  const { state, completeBiometric } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('INACTIVE');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const isBiometricUnavailable = state.error?.startsWith('BIOMETRIC_SERVICE_UNAVAILABLE:');
  const biometricMessage = isBiometricUnavailable
    ? state.error!.replace('BIOMETRIC_SERVICE_UNAVAILABLE: ', '')
    : null;

  // Redirect when authenticated
  useEffect(() => {
    if (state.phase === 'AUTHENTICATED') {
      stopCamera();
      navigate('/officer/dashboard', { replace: true });
    }
    // Redirect back to login if preAuth is missing (page refresh)
    if (state.phase === 'UNAUTHENTICATED' && !state.isInitializing) {
      navigate('/login', { replace: true });
    }
  }, [state.phase, state.isInitializing, navigate]); // eslint-disable-line

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []); // eslint-disable-line

  /** Returns the deviceId of the first real built-in webcam, skipping virtual cameras. */
  const getBuiltinCameraId = async (): Promise<string | undefined> => {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      tempStream.getTracks().forEach((t) => t.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      const VIRTUAL_KEYWORDS = ['iriun', 'droid', 'obs', 'virtual', 'ndi', 'snap camera', 'epoccam', 'camo', 'reincubate'];
      const builtIn = videoDevices.find((d) => {
        const label = d.label.toLowerCase();
        return !VIRTUAL_KEYWORDS.some((kw) => label.includes(kw));
      });
      return builtIn?.deviceId;
    } catch {
      return undefined;
    }
  };

  const startCamera = async () => {
    setCameraState('STARTING');
    setCameraError(null);
    try {
      const deviceId = await getBuiltinCameraId();
      const videoConstraints = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
        : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('ACTIVE');
    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setCameraError('Camera access denied. Please allow camera access in your browser settings and try again.');
      } else if (e.name === 'NotFoundError') {
        setCameraError('No camera detected on this device. Face verification requires a webcam.');
      } else {
        setCameraError(`Camera error: ${e.message}`);
      }
      setCameraState('ERROR');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const captureAndVerify = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !state.preAuth) return;

    setCapturing(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Export as JPEG, base64-encoded
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    // Strip "data:image/jpeg;base64," prefix → raw base64
    const b64 = dataUrl.split(',')[1];

    await completeBiometric(state.preAuth.preAuthToken, b64);
    setCapturing(false);
  }, [state.preAuth, completeBiometric]);

  const isVerifying = state.phase === 'BIOMETRIC_VERIFYING' || capturing;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Back */}
        <button
          type="button"
          onClick={() => { stopCamera(); navigate('/login'); }}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8 transition-colors"
          disabled={isVerifying}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </button>

        <div className="mb-6">
          <p className="text-slate-400 text-xs mb-1">Step 2 of 2 — Biometric verification</p>
          <h1 className="text-white text-xl font-bold">Officer Face Verification</h1>
          {state.preAuth && (
            <p className="text-slate-400 text-sm mt-1">
              Welcome, <strong className="text-white">{state.preAuth.fullName}</strong>
            </p>
          )}
        </div>

        {/* Dev bypass banner */}
        {state.preAuth?.biometricBypassActive && (
          <div className="mb-4 p-3 bg-amber-900/40 border border-amber-500/50 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-amber-200 text-xs font-bold">DEV MODE — BIOMETRIC BYPASS ACTIVE</p>
              <p className="text-amber-400 text-[11px] mt-0.5">
                BIOMETRIC_BYPASS_ENABLED=true in .env. Face image is captured and sent but not compared.
                Disable in production.
              </p>
            </div>
          </div>
        )}

        {/* Biometric service unavailable panel */}
        {isBiometricUnavailable && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-500/40 rounded-xl">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-200 text-sm font-semibold">Biometric Verification Unavailable</p>
                <p className="text-red-400 text-xs mt-1 leading-relaxed">{biometricMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Non-biometric error */}
        {state.error && !isBiometricUnavailable && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/40 rounded-xl text-red-200 text-sm flex gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            {state.error}
          </div>
        )}

        {/* Camera panel */}
        <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 mb-5">
          {cameraState === 'ERROR' ? (
            <div className="aspect-video flex flex-col items-center justify-center gap-3 p-6">
              <Camera className="w-10 h-10 text-slate-600" />
              <p className="text-slate-400 text-sm text-center">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="text-xs text-blue-400 hover:underline"
              >
                Retry camera
              </button>
            </div>
          ) : (
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full aspect-video object-cover bg-slate-900"
                muted
                playsInline
              />
              {/* Face guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-36 h-44 border-2 border-white/30 rounded-full" />
              </div>
              {cameraState === 'STARTING' && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
              )}
            </div>
          )}
          {/* Hidden canvas for frame capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <p className="text-slate-400 text-xs text-center mb-4">
          Position your face within the oval guide, then press the button below.
        </p>

        {/* Capture button */}
        <button
          type="button"
          onClick={captureAndVerify}
          disabled={cameraState !== 'ACTIVE' || isVerifying}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {isVerifying
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
            : <><Camera className="w-4 h-4" /> Capture & Verify Face</>
          }
        </button>
      </div>
    </div>
  );
};
