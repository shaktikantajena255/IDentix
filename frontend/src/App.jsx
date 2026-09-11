import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewScreening from './pages/NewScreening';
import Results from './pages/Results';
import History from './pages/History';
import Analytics from './pages/Analytics';
import SettingsPage from './pages/SettingsPage';
import Alerts from './pages/Alerts';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('identix_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const OnlineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-navy-800 border border-navy-600">
      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
      {isOnline ? 'ONLINE' : 'OFFLINE'}
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <OnlineIndicator />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/screening/new" element={<ProtectedRoute><NewScreening /></ProtectedRoute>} />
        <Route path="/screening/:caseId/results" element={<ProtectedRoute><Results /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
