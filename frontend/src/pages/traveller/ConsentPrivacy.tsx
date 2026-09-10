import React, { useState } from 'react';
import { Lock, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../../components/common/Button';

export const ConsentPrivacy: React.FC = () => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);

  const sections = [
    {
      id: 'what',
      title: 'What IDentix Vault Transfers',
      content: `When you approve a QR session transfer, you are sending a copy of a document image or PDF file to the border officer's local terminal. This is transmitted over an encrypted, one-time session. The officer's terminal never receives your IDentix Vault login credentials, device ID, or any other data besides the selected document file.`
    },
    {
      id: 'identity',
      title: 'Transfer ≠ Identity Verification',
      content: `Transferring a document through the Vault does NOT prove that you are physically present at the checkpoint, nor does it prove you are the rightful holder of the document. The border officer is legally required to conduct a separate live biometric verification at the checkpoint.`
    },
    {
      id: 'session',
      title: 'One-Time Session Security',
      content: `Each QR code generates a temporary session token with a 5-minute expiry. After the document is transferred, the session is immediately invalidated. No session can be reused. The QR code does not contain any sensitive data — only a short-lived session reference.`
    },
    {
      id: 'storage',
      title: 'Local Storage & Retention',
      content: `Your document files in the Vault are stored on your device only. IDentix does not upload your documents to cloud servers without your explicit action. When you share a document via QR session, only that specific transfer is transmitted.`
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Lock className="w-5 h-5 text-slate-700" />
          <h3 className="text-lg font-bold text-slate-900">Consent & Privacy</h3>
        </div>
        <p className="text-xs text-slate-500">
          Please review and understand how IDentix Vault handles your document data.
        </p>
      </div>

      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.id} className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(expanded === section.id ? null : section.id)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <span className="text-sm font-semibold text-slate-900">{section.title}</span>
              {expanded === section.id
                ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
            </button>
            {expanded === section.id && (
              <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Consent Checkbox */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded accent-emerald-600"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">I understand and consent</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              I have read and understood that document transfer through IDentix Vault does not replace physical biometric verification at the checkpoint, and that each session is one-time use and expires automatically.
            </p>
          </div>
        </label>
      </div>

      {consented ? (
        <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          Consent recorded locally on your device.
        </div>
      ) : (
        <div className="flex items-center gap-2 text-slate-500 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          You must review and accept before sharing documents via QR session.
        </div>
      )}
    </div>
  );
};
