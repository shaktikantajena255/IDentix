import React, { useState, useCallback } from 'react';
import { Upload, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { db } from '../../services/db';
import type { DocumentType, TravellerDocument } from '@shared/types';

const DOC_TYPES: { type: DocumentType; label: string }[] = [
  { type: 'PASSPORT', label: 'Passport' },
  { type: 'VISA', label: 'Visa' },
  { type: 'NATIONAL_ID', label: 'National ID Card' },
  { type: 'DRIVING_LICENCE', label: 'Driving Licence' },
  { type: 'PERMIT', label: 'Travel Permit / Document' },
];

export const VaultUpload: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>('PASSPORT');
  const [issuingCountry, setIssuingCountry] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Only JPEG, PNG, or PDF files are accepted.');
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleSave = async () => {
    if (!selectedFile || !issuingCountry || !expiryDate) {
      setError('Please fill in all fields and select a file.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Calculate days until expiry
      const expiry = new Date(expiryDate);
      const now = new Date();
      const diffMs = expiry.getTime() - now.getTime();
      const daysUntilExpiry = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const doc: TravellerDocument = {
        id: `VD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        documentType: docType,
        title: `${docType.replace(/_/g, ' ')} — ${issuingCountry.toUpperCase()}`,
        documentNumberMasked: '****' + Math.random().toString(36).substring(2, 6).toUpperCase(),
        expiryDate,
        issuingCountry: issuingCountry.toUpperCase(),
        uploadedAt: new Date().toISOString(),
        fileSizeBytes: selectedFile.size,
        hasRenewalAlert: daysUntilExpiry < 90,
        daysUntilExpiry,
      };

      await db.vaultDocuments.add(doc);
      setSaved(true);
      setSelectedFile(null);
      setIssuingCountry('');
      setExpiryDate('');
    } catch (err) {
      setError('Failed to save document to vault. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Document Saved to Vault</h3>
          <p className="text-xs text-slate-500 mt-1">
            Your document is stored locally in the IDentix Vault. You can now transfer it to a border officer via the QR session flow.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSaved(false)}>
          Upload Another Document
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Upload Document to Vault</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Only JPEG, PNG, and PDF files are accepted. Maximum 10MB per file.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex gap-2 items-center">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          {error}
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50'
            : selectedFile
            ? 'border-emerald-400 bg-emerald-50/40'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50'
        }`}
        onClick={() => document.getElementById('vault-file-input')?.click()}
      >
        <input
          id="vault-file-input"
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,application/pdf"
          onChange={handleFileInput}
        />
        {selectedFile ? (
          <>
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <FileText className="w-5 h-5 text-emerald-700" />
            </div>
            <p className="text-sm font-semibold text-emerald-900">{selectedFile.name}</p>
            <p className="text-xs text-emerald-700 mt-1">
              {(selectedFile.size / 1024).toFixed(1)} KB — Click to change
            </p>
          </>
        ) : (
          <>
            <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Upload className="w-5 h-5 text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Drop file here or click to browse</p>
            <p className="text-xs text-slate-500 mt-1">JPEG · PNG · PDF</p>
          </>
        )}
      </div>

      {/* Metadata Fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Document Type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {DOC_TYPES.map((d) => (
              <option key={d.type} value={d.type}>{d.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Issuing Country (ISO Code)</label>
          <input
            type="text"
            value={issuingCountry}
            onChange={(e) => setIssuingCountry(e.target.value.toUpperCase())}
            placeholder="e.g. GBR, USA, IND"
            maxLength={3}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono uppercase"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Expiry Date</label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <Button
        variant="secondary"
        className="w-full"
        isLoading={isSaving}
        onClick={handleSave}
        disabled={!selectedFile || !issuingCountry || !expiryDate}
      >
        Save to Vault
      </Button>
    </div>
  );
};
