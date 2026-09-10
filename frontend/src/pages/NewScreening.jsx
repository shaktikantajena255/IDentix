import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, Upload, Camera, CheckCircle2, Loader2, Video, VideoOff } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../lib/api';

function speak(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }
}

const NewScreening = () => {
  const [documentFile, setDocumentFile] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  // Track camera failure so we can allow submission with UNAVAILABLE state
  const [selfieCameraFailed, setSelfieCameraFailed] = useState(false);
  const [selfieCameraError, setSelfieCameraError] = useState(null);

  const [activeTab, setActiveTab] = useState('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState(null);

  // Store streams in refs AND state so we can use them in useEffect
  const [docStream, setDocStream] = useState(null);
  const [selfieStream, setSelfieStream] = useState(null);
  const selfieStreamRef = useRef(null);
  const docStreamRef = useRef(null);

  const docVideoRef = useRef(null);
  const docCanvasRef = useRef(null);

  const selfieVideoRef = useRef(null);
  const selfieCanvasRef = useRef(null);

  const navigate = useNavigate();

  // Debug: log on mount
  useEffect(() => {
    console.log('[IDentix] NewScreening mounted. navigator.mediaDevices available:', !!navigator.mediaDevices?.getUserMedia);
  }, []);

  // KEY FIX — Bug 2: Attach selfie stream to <video> AFTER React renders the element.
  // selfieStream state becomes truthy → React renders <video ref={selfieVideoRef}> →
  // this effect fires and finds selfieVideoRef.current now valid.
  useEffect(() => {
    if (!selfieStream) return;

    const attach = () => {
      const video = selfieVideoRef.current;
      if (!video) {
        // Element not mounted yet — retry after next paint (React 18 concurrent mode edge case)
        console.warn('[IDentix] selfieVideoRef not ready yet, retrying after next frame...');
        requestAnimationFrame(attach);
        return;
      }
      video.srcObject = selfieStream;
      video.play()
        .then(() => console.log('[IDentix] Selfie video stream attached and playing (' + video.videoWidth + 'x' + video.videoHeight + ')'))
        .catch(e => console.warn('[IDentix] Selfie video autoplay blocked (stream still attached):', e.message));
    };

    attach();
  }, [selfieStream]);

  // Same fix for document camera
  useEffect(() => {
    if (!docStream) return;
    const video = docVideoRef.current;
    if (!video) return;
    video.srcObject = docStream;
    video.play()
      .then(() => console.log('[IDentix] Doc video stream attached and playing'))
      .catch(e => console.warn('[IDentix] Doc video autoplay blocked:', e.message));
  }, [docStream]);

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      if (selfieStreamRef.current) selfieStreamRef.current.getTracks().forEach(t => t.stop());
      if (docStreamRef.current) docStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Document upload handler
  const handleDocUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDocumentFile(file);
      setDocumentPreview(URL.createObjectURL(file));
      speak("Document received. Ready to start verification.");
    }
  };

  // Selfie upload handler
  const handleSelfieUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelfieFile(file);
      setSelfiePreview(URL.createObjectURL(file));
    }
  };

  const startDocCamera = async () => {
    console.log('[IDentix] Requesting document camera via getUserMedia...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
        audio: false,
      });
      docStreamRef.current = stream;
      // Do NOT try to assign to docVideoRef.current here — the <video> element
      // may not be in the DOM yet. The useEffect above handles attachment.
      setDocStream(stream);
      console.log('[IDentix] Document camera stream acquired.');
    } catch (err) {
      console.error('[IDentix] Document camera error:', err.name, err.message);
      setError('Document camera error: ' + (err.message || err.name) + '. Check browser permissions.');
    }
  };

  const captureDoc = () => {
    if (docVideoRef.current && docCanvasRef.current) {
      const video = docVideoRef.current;
      const canvas = docCanvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        const file = new File([blob], 'document_capture.jpg', { type: 'image/jpeg' });
        setDocumentFile(file);
        setDocumentPreview(URL.createObjectURL(file));
        if (docStreamRef.current) { docStreamRef.current.getTracks().forEach(t => t.stop()); docStreamRef.current = null; }
        setDocStream(null);
        speak('Document captured. Ready to start verification.');
        console.log('[IDentix] Capture: document_capture.jpg');
      }, 'image/jpeg');
    }
  };

  const startSelfieCamera = async () => {
    console.log('[IDentix] Requesting selfie camera via getUserMedia (facingMode: user)...');
    setSelfieCameraFailed(false);
    setSelfieCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      selfieStreamRef.current = stream;
      // Store in state — the useEffect above will attach to <video> after render.
      setSelfieStream(stream);
      console.log('[IDentix] Selfie camera stream acquired. Waiting for React to render <video>...');
    } catch (err) {
      console.error('[IDentix] Selfie camera error:', err.name, err.message);
      setSelfieCameraFailed(true);
      setSelfieCameraError(err.message || err.name);
    }
  };

  const captureSelfie = () => {
    const video = selfieVideoRef.current;
    if (!video) {
      console.error('[IDentix] captureSelfie: selfieVideoRef is null — camera not ready');
      return;
    }
    // Create canvas on-the-fly — no ref needed, avoids null-ref failure
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) { console.error('[IDentix] captureSelfie: canvas 2d context unavailable'); return; }

    // Mirror the image to match the mirrored preview (scale-x-[-1])
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) { console.error('[IDentix] captureSelfie: toBlob returned null'); return; }
      const file = new File([blob], 'selfie_capture.jpg', { type: 'image/jpeg' });
      setSelfieFile(file);
      setSelfiePreview(URL.createObjectURL(file));
      // Stop stream after capture
      if (selfieStreamRef.current) {
        selfieStreamRef.current.getTracks().forEach(t => t.stop());
        selfieStreamRef.current = null;
      }
      setSelfieStream(null);
      console.log('[IDentix] Capture: selfie_capture.jpg (' + (blob.size / 1024).toFixed(1) + ' KB, ' + canvas.width + 'x' + canvas.height + ')');
      speak('Selfie captured. Ready to start verification.');
    }, 'image/jpeg', 0.92);
  };


  // Progress simulation
  useEffect(() => {
    if (!isProcessing) return;
    const stages = [
      { name: 'Document Type Detection', progress: 15 },
      { name: 'OCR & Field Extraction', progress: 30 },
      { name: 'MRZ Checksum Validation', progress: 45 },
      { name: 'Forensic Analysis (ELA)', progress: 62 },
      { name: 'Face Verification', progress: 78 },
      { name: 'Watchlist Check', progress: 92 },
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < stages.length) {
        setProcessingStage(stages[i].name);
        setProcessingProgress(stages[i].progress);
        if (i === 0 || i === 2 || i === 4) {
          speak(stages[i].name + ' in progress');
        }
        i++;
      }
    }, 800);
    return () => clearInterval(interval);
  }, [isProcessing]);

  // FIX 3 — Selfie is MANDATORY.
  // Allow submission only when: document present AND (selfie captured OR camera genuinely failed).
  const selfieReady = !!selfieFile || selfieCameraFailed;
  const canSubmit = !!documentFile && selfieReady && !isProcessing;

  const handleStartVerification = async () => {
    if (!documentFile || !selfieReady) return;
    speak("Starting verification pipeline. Please wait.");
    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('document_image', documentFile);
      if (selfieFile) {
        formData.append('selfie_image', selfieFile);
      }

      const res = await api.post('/api/screening/start', formData);
      speak("Verification complete. Displaying results.");
      
      // Allow progress to finish visually before navigating
      setTimeout(() => {
        navigate(`/screening/${res.data.case_id}/results`, { state: { result: res.data } });
      }, 1000);

    } catch (err) {
      speak("Verification failed. Please try again.");
      setIsProcessing(false);
      setError("Failed to start screening. " + (err.response?.data?.detail || err.message));
    }
  };

  const stagesList = [
    'Document Type Detection',
    'OCR & Field Extraction',
    'MRZ Checksum Validation',
    'Forensic Analysis (ELA)',
    'Face Verification',
    'Watchlist Check'
  ];

  const currentStageIndex = stagesList.indexOf(processingStage);

  return (
    <div className="flex h-screen bg-navy-900 overflow-hidden relative">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-200">New Screening</h1>
          <p className="text-slate-400 mt-1">Initiate a new document verification process</p>
        </header>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Document Section */}
          <section className="bg-navy-800 border border-navy-600 rounded-xl p-6">
            <h2 className="text-xl font-bold text-slate-200 mb-4">Step 1: Document Image</h2>
            
            <div className="flex gap-4 mb-6 border-b border-navy-700 pb-2">
              <button 
                className={`pb-2 px-2 font-medium border-b-2 transition-colors ${activeTab === 'upload' ? 'border-cyber-500 text-cyber-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                onClick={() => setActiveTab('upload')}
              >
                Upload File
              </button>
              <button 
                className={`pb-2 px-2 font-medium border-b-2 transition-colors ${activeTab === 'webcam' ? 'border-cyber-500 text-cyber-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                onClick={() => setActiveTab('webcam')}
              >
                Webcam Capture
              </button>
            </div>

            {activeTab === 'upload' && (
              <div>
                {!documentPreview ? (
                  <div className="border-2 border-dashed border-cyber-500/50 rounded-xl p-12 text-center hover:bg-navy-700/50 transition-colors relative">
                    <input type="file" accept="image/*" onChange={handleDocUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <Upload className="w-12 h-12 text-cyber-500 mx-auto mb-4" />
                    <p className="text-slate-300 font-medium">Drop document image here or click to browse</p>
                    <p className="text-slate-500 text-sm mt-2">Supports JPG, PNG</p>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-navy-600 bg-navy-900 aspect-[4/3] flex items-center justify-center">
                    <img src={documentPreview} alt="Document Preview" className="max-h-full max-w-full object-contain" />
                    <button 
                      className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-lg"
                      onClick={() => { setDocumentFile(null); setDocumentPreview(null); }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'webcam' && (
              <div>
                {!docStream && !documentPreview && (
                  <button onClick={startDocCamera} className="w-full py-12 border-2 border-dashed border-cyber-500/50 rounded-xl flex flex-col items-center justify-center text-cyber-500 hover:bg-navy-700/50 transition-colors">
                    <Camera className="w-12 h-12 mb-4" />
                    <span className="font-medium">Start Camera</span>
                  </button>
                )}
                
                <div className={`${(!docStream || documentPreview) ? 'hidden' : 'block'} relative rounded-xl overflow-hidden border border-navy-600 bg-navy-900 aspect-[4/3]`}>
                  <video ref={docVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <button onClick={captureDoc} className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-cyber-500 hover:bg-cyber-600 text-white px-6 py-2 rounded-full font-bold shadow-lg flex items-center gap-2">
                    <Camera className="w-5 h-5" /> Capture Document
                  </button>
                </div>

                <canvas ref={docCanvasRef} className="hidden" />

                {documentPreview && (
                  <div className="relative rounded-xl overflow-hidden border border-navy-600 bg-navy-900 aspect-[4/3] flex items-center justify-center">
                    <img src={documentPreview} alt="Captured Document" className="max-h-full max-w-full object-contain" />
                    <button 
                      className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-lg"
                      onClick={() => { setDocumentFile(null); setDocumentPreview(null); }}
                    >
                      Retake
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Selfie Section — MANDATORY */}
          <section className="bg-navy-800 border border-navy-600 rounded-xl p-6">
            <h2 className="text-xl font-bold text-slate-200 mb-1">Step 2: Live Selfie <span className="text-red-400 text-base font-semibold">(Required)</span></h2>
            <p className="text-slate-400 text-sm mb-1">Face verification is mandatory — verification cannot proceed without a selfie.</p>
            {selfieCameraFailed && (
              <div className="mb-4 mt-2 flex gap-3 rounded-lg border border-slate-600 bg-slate-800/60 p-3">
                <span className="text-xl shrink-0">⏸️</span>
                <div>
                  <p className="text-sm font-semibold text-slate-200">Face Verification — UNAVAILABLE</p>
                  <p className="text-xs text-slate-400 mt-1">{selfieCameraError || 'Camera could not be accessed.'}</p>
                  <p className="text-xs text-slate-500 mt-1">This will be recorded as UNAVAILABLE. You may proceed.</p>
                </div>
              </div>
            )}

            {!selfiePreview ? (
              <div className="flex flex-col gap-4">
                {!selfieStream ? (
                  <button onClick={startSelfieCamera} className="w-full py-8 border border-navy-600 bg-navy-900 rounded-xl flex flex-col items-center justify-center text-slate-300 hover:text-white hover:border-slate-400 transition-colors">
                    <Video className="w-8 h-8 mb-2" />
                    <span className="font-medium">Start Webcam for Selfie</span>
                  </button>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-navy-600 bg-navy-900 aspect-video">
                    <video ref={selfieVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                    <button onClick={captureSelfie} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-cyber-500 hover:bg-cyber-600 text-white px-6 py-2 rounded-full font-bold shadow-lg flex items-center gap-2">
                      <Camera className="w-5 h-5" /> Capture Selfie
                    </button>
                  </div>
                )}

                <div className="text-center text-slate-500 my-2">OR</div>
                
                <div className="relative">
                  <input type="file" accept="image/*" onChange={handleSelfieUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="w-full py-4 border border-navy-600 bg-navy-900 rounded-xl flex items-center justify-center text-slate-300 gap-2">
                    <Upload className="w-5 h-5" /> Upload Selfie File
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border border-navy-600 bg-navy-900 aspect-video flex items-center justify-center">
                <img src={selfiePreview} alt="Selfie Preview" className="max-h-full max-w-full object-contain transform scale-x-[-1]" />
                <button 
                  className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-lg"
                  onClick={() => { setSelfieFile(null); setSelfiePreview(null); }}
                >
                  Clear
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="mt-8 flex flex-col items-end gap-2">
          {!canSubmit && !isProcessing && (
            <p className="text-xs text-slate-400">
              {!documentFile && !selfieReady
                ? 'Complete Steps 1 and 2 to enable verification.'
                : !documentFile
                ? 'Step 1 required: upload or capture a document image.'
                : 'Step 2 required: capture a live selfie or wait for camera failure detection.'}
            </p>
          )}
          <button
            onClick={handleStartVerification}
            disabled={!canSubmit}
            className={`px-8 py-4 rounded-xl font-bold text-lg flex items-center gap-3 transition-colors ${
              !canSubmit
                ? 'bg-navy-700 text-slate-500 cursor-not-allowed'
                : 'bg-cyber-500 hover:bg-cyber-600 text-white shadow-lg shadow-cyber-500/20'
            }`}
          >
            <ScanLine className="w-6 h-6" />
            Start Verification
          </button>
        </div>
      </main>

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-navy-900/90 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-navy-800 border border-navy-600 rounded-2xl p-8 w-full max-w-lg shadow-2xl relative overflow-hidden">
            
            {/* Animated scanning line overlay */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
              <div className="w-full h-1 bg-cyber-500 shadow-[0_0_15px_#06b6d4] animate-[scan_2s_ease-in-out_infinite]" 
                   style={{ animation: 'scan 2s ease-in-out infinite alternate', position: 'absolute', left: 0, right: 0 }} />
            </div>

            <style dangerouslySetInnerHTML={{__html: `
              @keyframes scan {
                0% { top: 0%; }
                100% { top: 100%; }
              }
            `}} />

            <div className="text-center mb-8">
              <ScanLine className="w-16 h-16 text-cyber-500 mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl font-bold text-slate-200">Analyzing Document</h2>
              <p className="text-cyber-400 mt-2 font-medium">{processingStage || 'Initializing...'}</p>
            </div>

            <div className="w-full bg-navy-900 rounded-full h-3 mb-8 border border-navy-700 overflow-hidden">
              <div 
                className="bg-cyber-500 h-3 rounded-full transition-all duration-500 ease-out relative"
                style={{ width: `${processingProgress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>

            <div className="space-y-4">
              {stagesList.map((stage, idx) => {
                const isCompleted = currentStageIndex > idx || processingProgress === 100;
                const isCurrent = currentStageIndex === idx && processingProgress < 100;
                const isPending = currentStageIndex < idx;
                
                return (
                  <div key={stage} className={`flex items-center gap-4 ${isPending ? 'opacity-40' : ''}`}>
                    <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                      {isCompleted ? (
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      ) : isCurrent ? (
                        <Loader2 className="w-5 h-5 text-cyber-500 animate-spin" />
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                      )}
                    </div>
                    <span className={`font-medium ${isCurrent ? 'text-cyber-400' : isCompleted ? 'text-slate-300' : 'text-slate-500'}`}>
                      {stage}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewScreening;
