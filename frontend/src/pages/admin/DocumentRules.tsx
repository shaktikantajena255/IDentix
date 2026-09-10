import React from 'react';
import { FileCheck2, BookOpen, Globe, CreditCard, Car, FileText, Plus } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { PageHeader } from '../../components/common/PageHeader';
import type { DocumentType } from '@shared/types';

interface DocRuleConfig {
  type: DocumentType;
  standard: string;
  mrzFormat: string;
  checkDigits: string;
  templateMatching: 'Active' | 'Pending';
  icon: typeof FileText;
}

const DOC_RULES: DocRuleConfig[] = [
  {
    type: 'PASSPORT',
    standard: 'ICAO Doc 9303 — TD3',
    mrzFormat: '2-line × 44 chars',
    checkDigits: 'Doc No, DOB, Expiry, Composite',
    templateMatching: 'Pending',
    icon: BookOpen,
  },
  {
    type: 'NATIONAL_ID',
    standard: 'ICAO Doc 9303 — TD1 / TD2',
    mrzFormat: '3-line × 30 chars (TD1) / 2-line × 36 chars (TD2)',
    checkDigits: 'Doc No, DOB, Expiry',
    templateMatching: 'Pending',
    icon: CreditCard,
  },
  {
    type: 'VISA',
    standard: 'ICAO MRV-A / MRV-B',
    mrzFormat: '2-line × 44 chars (A) / 2-line × 36 chars (B)',
    checkDigits: 'Doc No, DOB, Expiry',
    templateMatching: 'Pending',
    icon: Globe,
  },
  {
    type: 'DRIVING_LICENCE',
    standard: 'ISO 18013 (Jurisdiction-specific)',
    mrzFormat: 'Jurisdiction optional — no ICAO standard',
    checkDigits: 'N/A (non-ICAO)',
    templateMatching: 'Pending',
    icon: Car,
  },
  {
    type: 'PERMIT',
    standard: 'Convention Travel Document / Laissez-Passer',
    mrzFormat: '2-line × 44 chars (ICAO 9303 where applicable)',
    checkDigits: 'ICAO standard where applicable',
    templateMatching: 'Pending',
    icon: FileText,
  },
];

export const DocumentRules: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Rules & Standards"
        subtitle="ICAO 9303 template configurations and field extraction rules for each supported document type."
        actions={
          <Button variant="secondary" size="sm" icon={<Plus className="w-4 h-4" />}>
            Add Custom Template
          </Button>
        }
      />

      <div className="space-y-4">
        {DOC_RULES.map((rule) => {
          const Icon = rule.icon;
          return (
            <Card key={rule.type}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{rule.type.replace(/_/g, ' ')}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{rule.standard}</p>
                    </div>
                    <Badge variant={rule.templateMatching === 'Active' ? 'clear' : 'neutral'}>
                      Template: {rule.templateMatching}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <p className="font-semibold text-slate-700 mb-1">MRZ Format</p>
                      <p className="text-slate-500 font-mono">{rule.mrzFormat}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <p className="font-semibold text-slate-700 mb-1">Check Digits (ICAO 7-3-1)</p>
                      <p className="text-slate-500">{rule.checkDigits}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
