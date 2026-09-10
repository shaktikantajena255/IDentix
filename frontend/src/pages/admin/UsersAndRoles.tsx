import React, { useState } from 'react';
import { Users, PlusCircle, Shield, ShieldCheck, ShieldAlert, Pencil, Trash2 } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader } from '../../components/common/PageHeader';

interface MockUser {
  id: string;
  name: string;
  badgeId: string;
  role: 'OFFICER' | 'SUPERVISOR' | 'ADMIN';
  station: string;
  status: 'ACTIVE' | 'SUSPENDED';
  lastActivity: string;
}

const INITIAL_USERS: MockUser[] = [
  { id: '1', name: 'Officer J. Vance', badgeId: 'JV-4829', role: 'OFFICER', station: 'T2-CP-04B', status: 'ACTIVE', lastActivity: 'Active now' },
  { id: '2', name: 'Supervisor M. Chen', badgeId: 'MC-0012', role: 'SUPERVISOR', station: 'T2-HQ', status: 'ACTIVE', lastActivity: '12 minutes ago' },
  { id: '3', name: 'Admin Supervisor', badgeId: 'AD-0001', role: 'ADMIN', station: 'Central', status: 'ACTIVE', lastActivity: 'Active now' },
];

const RoleBadge: React.FC<{ role: MockUser['role'] }> = ({ role }) => {
  const map = {
    OFFICER: { variant: 'info' as const, Icon: Shield, label: 'Officer' },
    SUPERVISOR: { variant: 'warning' as const, Icon: ShieldCheck, label: 'Supervisor' },
    ADMIN: { variant: 'high_risk' as const, Icon: ShieldAlert, label: 'Administrator' },
  };
  const { variant, Icon, label } = map[role];
  return (
    <Badge variant={variant}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
};

export const UsersAndRoles: React.FC = () => {
  const [users] = useState<MockUser[]>(INITIAL_USERS);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        subtitle="Access control management for all IDentix checkpoint operators and administrators."
        actions={
          <Button variant="secondary" size="sm" icon={<PlusCircle className="w-4 h-4" />}>
            Add User Account
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{users.filter(u => u.role === 'OFFICER').length}</p>
          <p className="text-xs text-slate-500 mt-1 font-semibold uppercase tracking-wide">Officers</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{users.filter(u => u.role === 'SUPERVISOR').length}</p>
          <p className="text-xs text-slate-500 mt-1 font-semibold uppercase tracking-wide">Supervisors</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{users.filter(u => u.role === 'ADMIN').length}</p>
          <p className="text-xs text-slate-500 mt-1 font-semibold uppercase tracking-wide">Administrators</p>
        </Card>
      </div>

      <Card cardTitle="User Directory" subtitle="All credentialed checkpoint personnel.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Badge ID</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Station</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Active</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-900">{user.name}</td>
                  <td className="py-3 px-4 font-mono text-slate-600 text-xs">{user.badgeId}</td>
                  <td className="py-3 px-4"><RoleBadge role={user.role} /></td>
                  <td className="py-3 px-4 text-slate-600 text-xs">{user.station}</td>
                  <td className="py-3 px-4">
                    <Badge variant={user.status === 'ACTIVE' ? 'clear' : 'high_risk'} dot>
                      {user.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{user.lastActivity}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
        <strong>Production Note:</strong> User authentication will integrate with the FastAPI JWT authentication layer in Phase 1 backend hardening. Role enforcement at API and UI route level is designed but not yet enforced pending auth module completion.
      </div>
    </div>
  );
};
