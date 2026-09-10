import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { OfficerRole } from '@shared/types';

const ROLE_RANK: Record<OfficerRole, number> = {
  OFFICER: 1,
  SUPERVISOR: 2,
  ADMIN: 3,
};

interface RequireRoleProps {
  children: React.ReactNode;
  minRole: OfficerRole; // minimum role required to access this route
}

/**
 * Route guard: redirects to /officer/dashboard if the authenticated officer
 * does not meet the minimum role requirement.
 */
export const RequireRole: React.FC<RequireRoleProps> = ({ children, minRole }) => {
  const { state } = useAuth();
  const officerRole = state.officer?.role ?? 'OFFICER';

  if (ROLE_RANK[officerRole] < ROLE_RANK[minRole]) {
    return <Navigate to="/officer/dashboard" replace />;
  }

  return <>{children}</>;
};
