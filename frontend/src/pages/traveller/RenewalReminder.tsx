import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { BellRing, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';

export const RenewalReminder: React.FC = () => {
  const docs = useLiveQuery(() => db.vaultDocuments.toArray()) || [];
  const expiring = docs.filter((d) => d.daysUntilExpiry <= 90);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Document Renewal Reminders</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Documents expiring within 90 days are flagged for renewal.
        </p>
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={<BellRing className="w-6 h-6" />}
          title="No Documents to Monitor"
          description="Upload documents to your vault to begin receiving renewal reminders."
        />
      ) : expiring.length === 0 ? (
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <h4 className="text-base font-semibold text-slate-900">All Documents Valid</h4>
          <p className="text-xs text-slate-500 mt-1">
            None of your {docs.length} document(s) expire within the next 90 days.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {expiring.map((doc) => (
            <div
              key={doc.id}
              className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                doc.daysUntilExpiry <= 30
                  ? 'bg-red-50 border-red-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle
                  className={`w-5 h-5 shrink-0 ${
                    doc.daysUntilExpiry <= 30 ? 'text-red-600' : 'text-amber-600'
                  }`}
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{doc.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Expires: {doc.expiryDate} — {doc.daysUntilExpiry} day(s) remaining
                  </p>
                </div>
              </div>
              <Badge variant={doc.daysUntilExpiry <= 30 ? 'high_risk' : 'review'}>
                {doc.daysUntilExpiry <= 30 ? 'URGENT' : 'Renew Soon'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
