import React, { useEffect } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Navigate,
} from 'react-router-dom';

// Error Boundary
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Providers
import { AuthProvider } from './context/AuthContext';
import { ScreeningProvider } from './context/ScreeningContext';

// Route Guards
import { RequireAuth } from './components/guards/RequireAuth';
import { RequireRole } from './components/guards/RequireRole';

// Layouts
import { OfficerLayout } from './layouts/OfficerLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { TravellerLayout } from './layouts/TravellerLayout';

// Auth Pages
import { EntryGate } from './pages/auth/EntryGate';
import { OfficerLogin } from './pages/auth/OfficerLogin';
import { FaceVerification } from './pages/auth/FaceVerification';

// Kiosk Pages
import { KioskWelcome } from './pages/kiosk/KioskWelcome';
import { KioskScreening } from './pages/kiosk/KioskScreening';

// Officer Pages
import { OfficerDashboard } from './pages/officer/Dashboard';
import { NewScreening } from './pages/officer/NewScreening';
import { ScreeningHistory } from './pages/officer/ScreeningHistory';
import { OfficerAlerts } from './pages/officer/Alerts';
import { OfficerDocuments } from './pages/officer/Documents';
import { OfficerAnalytics } from './pages/officer/Analytics';
import { OfficerSettings } from './pages/officer/OfficerSettings';
import { ScreeningResult } from './pages/officer/ScreeningResult';
import { DemoLab } from './pages/officer/DemoLab';

// Admin Pages
import { AdminOverview } from './pages/admin/AdminOverview';
import { UsersAndRoles } from './pages/admin/UsersAndRoles';
import { WatchlistManagement } from './pages/admin/WatchlistManagement';
import { DocumentRules } from './pages/admin/DocumentRules';
import { AISettings } from './pages/admin/AISettings';
import { OfflineSync } from './pages/admin/OfflineSync';
import { AuditLogs } from './pages/admin/AuditLogs';
import { SystemHealth } from './pages/admin/SystemHealth';

// Traveller / Vault Pages
import { VaultHome } from './pages/traveller/VaultHome';
import { VaultDocuments } from './pages/traveller/VaultDocuments';
import { VaultUpload } from './pages/traveller/VaultUpload';
import { RenewalReminder } from './pages/traveller/RenewalReminder';
import { ConsentPrivacy } from './pages/traveller/ConsentPrivacy';
import { QRSessionJoin } from './pages/traveller/QRSessionJoin';

// ── Root Data Router Layout ───────────────────────────────────────────────────
// Placed inside the Data Router so that useBlocker and other Data Router hooks
// inside ScreeningProvider have access to the active Data Router context.
const RootLayout: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ScreeningProvider>
          <Outlet />
        </ScreeningProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <EntryGate /> },
      { path: '/login', element: <OfficerLogin /> },
      { path: '/login/face-verify', element: <FaceVerification /> },
      { path: '/kiosk', element: <KioskWelcome /> },
      { path: '/kiosk/screening', element: <KioskScreening /> },
      {
        path: '/officer',
        element: (
          <RequireAuth>
            <OfficerLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <OfficerDashboard /> },
          { path: 'screening/new', element: <NewScreening /> },
          { path: 'screening/:caseId/results', element: <ScreeningResult /> },
          { path: 'screenings', element: <ScreeningHistory /> },
          { path: 'alerts', element: <OfficerAlerts /> },
          { path: 'documents', element: <OfficerDocuments /> },
          { path: 'analytics', element: <OfficerAnalytics /> },
          { path: 'settings', element: <OfficerSettings /> },
          { path: 'demo', element: <DemoLab /> },
        ],
      },
      {
        path: '/admin',
        element: (
          <RequireAuth>
            <RequireRole minRole="SUPERVISOR">
              <AdminLayout />
            </RequireRole>
          </RequireAuth>
        ),
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: 'overview', element: <AdminOverview /> },
          {
            path: 'users',
            element: (
              <RequireRole minRole="ADMIN">
                <UsersAndRoles />
              </RequireRole>
            ),
          },
          { path: 'watchlist', element: <WatchlistManagement /> },
          { path: 'rules', element: <DocumentRules /> },
          { path: 'ai-settings', element: <AISettings /> },
          { path: 'sync', element: <OfflineSync /> },
          { path: 'audit', element: <AuditLogs /> },
          { path: 'health', element: <SystemHealth /> },
        ],
      },
      {
        path: '/vault',
        element: <TravellerLayout />,
        children: [
          { index: true, element: <VaultHome /> },
          { path: 'documents', element: <VaultDocuments /> },
          { path: 'upload', element: <VaultUpload /> },
          { path: 'reminders', element: <RenewalReminder /> },
          { path: 'consent', element: <ConsentPrivacy /> },
          { path: 'join', element: <QRSessionJoin /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

function App() {
  // Register Service Worker for PWA offline capability
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('[IDentix PWA] Service Worker registered:', registration.scope);
          },
          (error) => {
            console.warn('[IDentix PWA] Service Worker registration failed:', error);
          }
        );
      });
    }
  }, []);

  return <RouterProvider router={router} />;
}

export default App;
