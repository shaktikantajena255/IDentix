import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface RequireAuthProps {
  children: React.ReactNode;
}

/**
 * Route guard: redirects to /login if the session is not AUTHENTICATED.
 * Also handles the UNAUTHENTICATED state during session restore (shows nothing
 * while isInitializing is true to avoid a flash redirect).
 */
export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { state } = useAuth();

  if (state.isInitializing) {
    // Don't redirect during startup — wait for session restore to complete
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Restoring session…</p>
        </div>
      </div>
    );
  }

  if (state.phase !== 'AUTHENTICATED') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
