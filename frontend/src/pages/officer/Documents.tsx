import React from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader } from '../../components/common/PageHeader';

export const OfficerDocuments: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Repository"
        subtitle="Catalog of physical scans and encrypted Vault transfers examined at this checkpoint."
        badge={<Badge variant="neutral">0 Files Cached</Badge>}
      />

      <Card>
        <EmptyState
          icon={<FolderOpen className="w-6 h-6" />}
          title="Document Cache Empty"
          description="No document scans or Vault transfers are currently held in the local encrypted cache. Documents will automatically appear here once captured during active screening sessions."
        />
      </Card>
    </div>
  );
};
