import React from 'react';
import { Cpu, AlertCircle, Clock } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { PageHeader } from '../../components/common/PageHeader';

interface ModuleSpec {
  name: string;
  library: string;
  purpose: string;
  status: 'Active' | 'Phase 3+' | 'Phase 5+' | 'Phase 6+' | 'Hardware';
  note?: string;
}

const AI_MODULES: ModuleSpec[] = [
  {
    name: 'OCR — Visual Inspection Zone',
    library: 'PaddleOCR (Mobile PP-OCRv4) + Tesseract fallback',
    purpose: 'Extract text from the human-readable zone of documents',
    status: 'Phase 3+',
  },
  {
    name: 'MRZ Extraction & Check Digits',
    library: 'PassportEye + ICAO 7-3-1 custom validator',
    purpose: 'Parse and mathematically validate Machine Readable Zone',
    status: 'Phase 3+',
  },
  {
    name: 'Forensic Analysis — Error Level Analysis',
    library: 'OpenCV + Pillow + NumPy',
    purpose: 'Detect copy-paste artifacts, compression anomalies, text baseline jitter',
    status: 'Phase 5+',
    note: 'ELA alone is not proof of forgery. Combined with multiple signals.',
  },
  {
    name: 'Face Extraction',
    library: 'OpenCV YuNet / RetinaFace',
    purpose: 'Detect and crop portrait region from document scan',
    status: 'Phase 6+',
  },
  {
    name: 'Face Embedding & Similarity',
    library: 'InsightFace MobileFaceNet (ONNX Runtime — CPU inference)',
    purpose: 'Generate 512-d embedding; compute cosine similarity vs. live capture',
    status: 'Phase 6+',
  },
  {
    name: 'Passive Liveness',
    library: 'MediaPipe Face Mesh + texture gradient analysis',
    purpose: 'Detect print/screen presentation attacks',
    status: 'Phase 6+',
    note: 'Production-grade active liveness requires depth camera hardware.',
  },
  {
    name: 'Active 3D Liveness',
    library: 'Hardware depth sensor (e.g. Intel RealSense)',
    purpose: 'Structured-light 3D face verification',
    status: 'Hardware',
    note: 'Hardware/Authority Integration Required — not implemented in prototype.',
  },
  {
    name: 'NFC ePassport Chip Read',
    library: 'PC/SC smartcard reader + ICAO 9303 BAC/EAC/SAC',
    purpose: 'Cryptographically verify chip authenticity via CVCA certificate chain',
    status: 'Hardware',
    note: 'Hardware/Authority Integration Required — requires government CVCA certificate access.',
  },
];

export const AISettings: React.FC = () => {
  const statusVariant = (status: ModuleSpec['status']) => {
    if (status === 'Active') return 'clear';
    if (status === 'Hardware') return 'high_risk';
    return 'neutral';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI & Detection Module Settings"
        subtitle="Computer vision pipeline configuration, model selection, and inference threshold management."
      />

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex gap-3">
        <AlertCircle className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
        <p>
          AI inference engines are deployed in Phase 3+ of the implementation roadmap. This panel displays planned module configurations. Threshold sliders and model selection will become active when each phase is deployed.
        </p>
      </div>

      <Card cardTitle="AI & CV Module Registry">
        <div className="space-y-3">
          {AI_MODULES.map((mod) => (
            <div
              key={mod.name}
              className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900">{mod.name}</p>
                  <Badge variant={statusVariant(mod.status)}>{mod.status}</Badge>
                </div>
                <p className="text-xs text-slate-600 mt-1 font-mono">{mod.library}</p>
                <p className="text-xs text-slate-500 mt-1">{mod.purpose}</p>
                {mod.note && (
                  <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {mod.note}
                  </p>
                )}
              </div>
              {mod.status !== 'Hardware' && mod.status !== 'Active' && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{mod.status}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
