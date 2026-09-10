import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { ScrollText, Search, ShieldCheck, Inbox } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';

export const AuditLogs: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const logs = useLiveQuery(() =>
    db.auditLogs.orderBy('timestamp').reverse().toArray()
  ) || [];

  const filtered = logs.filter((log) =>
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.targetEntity.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const roleVariant = (role: string) => {
    if (role === 'ADMIN') return 'high_risk';
    if (role === 'SUPERVISOR') return 'warning';
    return 'info';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        subtitle="Tamper-evident, append-only record of all system and officer actions on this terminal."
        badge={<Badge variant="neutral">{logs.length} Entries</Badge>}
      />

      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by action, officer name, or entity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {logs.length === 0 ? (
          <EmptyState
            icon={<Inbox className="w-6 h-6" />}
            title="No Audit Log Entries"
            description="The tamper-evident audit chain contains no events yet. Actions such as screening initialization, officer decisions, and admin configuration changes are permanently recorded here."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="w-6 h-6" />}
            title="No Matching Audit Entries"
            description={`No audit events matched "${searchQuery}".`}
            action={
              <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Officer / User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Integrity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-xs font-mono text-slate-600">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">{log.userName}</td>
                    <td className="py-3 px-4">
                      <Badge variant={roleVariant(log.userRole) as 'high_risk' | 'warning' | 'info'}>
                        {log.userRole}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800">
                        {log.action}
                      </code>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{log.targetEntity}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-xs text-emerald-700">
                        <ShieldCheck className="w-3 h-3" />
                        <span className="font-mono truncate max-w-[80px]" title={log.integrityHash}>
                          {log.integrityHash.substring(0, 12)}…
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
