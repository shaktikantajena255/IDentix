import React from 'react';
import { FolderLock, FileCheck, AlertCircle, Info } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { useNavigate } from 'react-router-dom';

export const VaultHome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <FolderLock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">IDentix Vault</h2>
            <p className="text-xs text-slate-500">Your secure, private document transfer space</p>
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900 flex gap-3">
        <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">What IDentix Vault Does</p>
          <p className="text-xs leading-relaxed">
            IDentix Vault enables you to securely transfer selected document copies to a border officer's terminal during checkpoint clearance — using a one-time QR session code. Your documents are never shared via email, WhatsApp, or any insecure channel.
          </p>
        </div>
      </div>

      {/* What it doesn't do */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Important: Vault Transfer is Not Identity Proof</p>
          <p className="text-xs leading-relaxed">
            Uploading a document through the Vault only transfers the file to the officer's terminal. It does <strong>not</strong> prove that you are the rightful holder. The officer will always perform a separate live biometric verification at the checkpoint.
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4 hover:border-slate-300 transition-colors cursor-pointer" onClick={() => navigate('/vault/documents')}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">My Documents</p>
              <p className="text-xs text-slate-500">View and manage stored document files</p>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 hover:border-emerald-400 border-emerald-300 bg-emerald-50/40 cursor-pointer transition-colors"
          onClick={() => navigate('/vault/join')}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Badge variant="clear" className="text-[10px]">QR</Badge>
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-900">Join Officer QR Session</p>
              <p className="text-xs text-emerald-700">Scan the officer's checkpoint QR code</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
