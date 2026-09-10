import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { FileCheck, Calendar, AlertCircle, Upload, Globe } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { useNavigate } from 'react-router-dom';

export const VaultDocuments: React.FC = () => {
  const navigate = useNavigate();
  const docs = useLiveQuery(() => db.vaultDocuments.toArray()) || [];

  const getDocIcon = () => <FileCheck className="w-5 h-5" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">My Documents</h3>
          <p className="text-xs text-slate-500 mt-0.5">{docs.length} document(s) stored in vault</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Upload className="w-4 h-4" />}
          onClick={() => navigate('/vault/upload')}
        >
          Upload Document
        </Button>
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={<FileCheck className="w-6 h-6" />}
          title="No Documents in Vault"
          description="Your vault is empty. Upload scanned copies of your travel documents (passport, visa, ID card) to enable secure checkpoint transfer."
          action={
            <Button
              variant="secondary"
              size="sm"
              icon={<Upload className="w-4 h-4" />}
              onClick={() => navigate('/vault/upload')}
            >
              Upload Your First Document
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 shrink-0">
                  {getDocIcon()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Globe className="w-3 h-3" />
                      <span>{doc.issuingCountry}</span>
                    </div>
                    <span className="text-slate-300">·</span>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      <span>Expires: {doc.expiryDate}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc.hasRenewalAlert && (
                  <Badge variant="review">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Renew Soon
                  </Badge>
                )}
                <Badge variant="neutral">{doc.documentType}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
