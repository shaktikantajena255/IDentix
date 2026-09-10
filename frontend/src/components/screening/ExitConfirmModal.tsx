import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../common/Button';

interface ExitConfirmModalProps {
  isOpen: boolean;
  isProcessing: boolean;
  caseId?: string;
  onKeep: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation modal shown when officer attempts to exit an active screening.
 * Requires explicit confirmation — not dismissible by clicking outside.
 */
export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  isOpen,
  isProcessing,
  caseId,
  onKeep,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 border border-slate-200">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>

        {/* Title */}
        <h2 className="text-lg font-bold text-slate-900 text-center mb-1">
          End This Screening Session?
        </h2>

        {caseId && (
          <p className="text-center text-xs font-mono text-slate-500 mb-3">Case: {caseId}</p>
        )}

        {/* Warning */}
        {isProcessing ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 mb-5 text-center">
            <strong>Warning:</strong> A processing operation is currently active. Exiting now may
            result in incomplete evidence capture. The screening record will be preserved.
          </div>
        ) : (
          <p className="text-sm text-slate-600 text-center mb-5">
            The screening record and audit trail will be preserved. The current case will be
            marked as incomplete. Are you sure you want to end this session?
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={onKeep}
          >
            Keep Screening
          </Button>
          <Button
            variant="danger"
            className="w-full justify-center"
            onClick={onConfirm}
          >
            End Screening Session
          </Button>
        </div>

        <p className="text-[10px] text-slate-400 text-center mt-4">
          The audit log entry for this session exit will be recorded.
        </p>
      </div>
    </div>
  );
};
