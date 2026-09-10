/**
 * useWebcam — reusable hook for live camera capture in IDentix.
 *
 * Handles:
 *  - navigator.mediaDevices.getUserMedia()
 *  - Permission denied (NotAllowedError)
 *  - No camera attached (NotFoundError)
 *  - OverconstrainedError fallback (retry without facingMode)
 *  - Generic browser camera errors
 *  - Stream stop / retake lifecycle
 *  - Canvas snapshot → File
 *
 * States:
 *  idle → starting → streaming → captured | error
 *
 * KEY DESIGN NOTE — Why useEffect for stream attachment:
 *  startCamera() acquires the MediaStream and calls setState('streaming').
 *  The <video> element only exists in the DOM when state === 'streaming'.
 *  React renders asynchronously, so videoRef.current is null when
 *  startCamera() runs. We use a useEffect that watches state === 'streaming'
 *  to attach the stream AFTER React has rendered the <video> element.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type WebcamState = 'idle' | 'starting' | 'streaming' | 'captured' | 'error';

export interface WebcamError {
  code: 'PERMISSION_DENIED' | 'NO_CAMERA' | 'BROWSER_ERROR' | 'STOPPED';
  message: string;
}

export interface WebcamOptions {
  /** Camera facing mode: 'user' for front/selfie, 'environment' for rear/document. Default: 'environment' */
  facingMode?: 'user' | 'environment';
}

export interface WebcamHook {
  state: WebcamState;
  error: WebcamError | null;
  capturedFile: File | null;
  capturedPreview: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Start the webcam stream. */
  startCamera: () => Promise<void>;
  /** Capture a still frame from the live video as a JPEG File. */
  capture: (label?: string) => File | null;
  /** Clear captured frame and resume live preview. */
  retake: () => void;
  /** Stop the stream and return to idle. */
  stopCamera: () => void;
}

export function useWebcam(options: WebcamOptions = {}): WebcamHook {
  const { facingMode = 'environment' } = options;

  const videoRef = useRef<HTMLVideoElement>(null!);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [state, setState] = useState<WebcamState>('idle');
  const [error, setError] = useState<WebcamError | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  /** Release object URL memory. */
  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  /** Stop the MediaStream tracks. */
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  /**
   * KEY FIX — Bug 1: Attach stream to video element AFTER React renders <video>.
   *
   * startCamera() acquires the stream and calls setState('streaming').
   * React then renders the <video> element (which only exists in streaming state).
   * This effect fires after that render, when videoRef.current is now valid.
   */
  useEffect(() => {
    if (state !== 'streaming') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) {
      console.warn('[IDentix] streaming state but video/stream ref missing — cannot attach.');
      return;
    }

    video.srcObject = stream;
    video
      .play()
      .then(() => {
        console.log(
          `[IDentix] Video stream attached and playing (facingMode: '${facingMode}', ` +
          `${video.videoWidth}x${video.videoHeight})`
        );
      })
      .catch((e: Error) => {
        // Autoplay blocked — not fatal, stream is still attached
        console.warn('[IDentix] Video autoplay blocked (stream is still attached):', e.message);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  /** Stop camera tracks when component unmounts. */
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  /** Attempt getUserMedia with given constraints, with OverconstrainedError fallback. */
  const _acquireStream = async (): Promise<MediaStream> => {
    const primaryConstraints: MediaStreamConstraints = {
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode },
      audio: false,
    };

    try {
      return await navigator.mediaDevices.getUserMedia(primaryConstraints);
    } catch (err) {
      const domErr = err as DOMException;
      // If the requested facingMode is not available (e.g. laptop has no rear camera
      // but 'environment' was requested, or vice versa), retry without facingMode.
      if (domErr.name === 'OverconstrainedError') {
        console.warn(
          `[IDentix] Camera facingMode '${facingMode}' not available, falling back to any camera.`
        );
        return await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      }
      throw err; // re-throw non-overconstrained errors
    }
  };

  const startCamera = useCallback(async () => {
    // If already streaming or captured, do nothing
    if (state === 'streaming' || state === 'starting') return;

    // Reset state
    setError(null);
    revokePreview();
    setCapturedFile(null);
    setCapturedPreview(null);
    setState('starting');

    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error');
      setError({
        code: 'BROWSER_ERROR',
        message: 'Your browser does not support camera access (getUserMedia). Try Chrome or Firefox.',
      });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await _acquireStream();
    } catch (err) {
      const domErr = err as DOMException;
      setState('error');
      if (domErr.name === 'NotAllowedError' || domErr.name === 'PermissionDeniedError') {
        setError({
          code: 'PERMISSION_DENIED',
          message: 'Camera permission denied. Allow camera access in your browser settings and try again.',
        });
      } else if (
        domErr.name === 'NotFoundError' ||
        domErr.name === 'DevicesNotFoundError' ||
        domErr.name === 'NotReadableError'
      ) {
        setError({
          code: 'NO_CAMERA',
          message: 'No camera found or camera is in use by another application. Connect a camera and retry.',
        });
      } else {
        setError({
          code: 'BROWSER_ERROR',
          message: `Camera error: ${domErr.message || domErr.name || 'Unknown error'}`,
        });
      }
      return;
    }

    // Store stream in ref — the useEffect above will attach it to the
    // <video> element AFTER React renders it in response to setState('streaming').
    streamRef.current = stream;

    // Listen for track ending (e.g. camera physically disconnected or revoked by OS)
    stream.getTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        setState((prev) => {
          if (prev === 'streaming') {
            setError({
              code: 'STOPPED',
              message: 'Camera stream ended unexpectedly. This can happen if the camera was disconnected or access was revoked.',
            });
            return 'error';
          }
          return prev;
        });
      });
    });

    console.log(
      `[IDentix] Camera stream acquired (facingMode: '${facingMode}'). ` +
      'Will attach to video element after React renders it…'
    );
    // setState('streaming') causes React to render the <video> element,
    // then the useEffect above fires and attaches streamRef to it.
    setState('streaming');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, revokePreview, facingMode]);

  const capture = useCallback(
    (label = 'capture'): File | null => {
      if (!videoRef.current || state !== 'streaming') return null;

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas → Blob → File (synchronous-ish via dataURL)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

      // Revoke old preview
      revokePreview();

      // Decode dataURL to File
      const byteString = atob(dataUrl.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: 'image/jpeg' });
      const file = new File([blob], `${label}_${Date.now()}.jpg`, { type: 'image/jpeg' });

      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;

      // Stop stream after capture (saves resources)
      stopStream();

      setCapturedFile(file);
      setCapturedPreview(previewUrl);
      setState('captured');

      console.log(
        `[IDentix] Capture: ${file.name} (${(file.size / 1024).toFixed(1)} KB, ${canvas.width}x${canvas.height})`
      );

      return file;
    },
    [state, revokePreview, stopStream]
  );

  const retake = useCallback(() => {
    stopStream();
    revokePreview();
    setCapturedFile(null);
    setCapturedPreview(null);
    setError(null);
    setState('idle');
  }, [stopStream, revokePreview]);

  const stopCamera = useCallback(() => {
    stopStream();
    revokePreview();
    setCapturedFile(null);
    setCapturedPreview(null);
    setError(null);
    setState('idle');
  }, [stopStream, revokePreview]);

  return {
    state,
    error,
    capturedFile,
    capturedPreview,
    videoRef,
    startCamera,
    capture,
    retake,
    stopCamera,
  };
}
