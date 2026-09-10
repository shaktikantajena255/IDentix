import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * IDentix Officer Login — Step 1: Badge ID + Password
 * Real API call to POST /api/v1/auth/login.
 * On success: navigate to /login/face-verify.
 * On failure: show specific error from the API (wrong credentials, locked account).
 */
export const OfficerLogin: React.FC = () => {
  const navigate = useNavigate();
  const { state, login, clearError } = useAuth();

  const [badgeId, setBadgeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (state.phase === 'AUTHENTICATED') {
      navigate('/officer/dashboard', { replace: true });
    }
    // Navigate to face-verify when password succeeds
    if (state.phase === 'PASSWORD_VERIFIED') {
      navigate('/login/face-verify', { replace: true });
    }
  }, [state.phase, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!badgeId.trim() || !password) return;
    await login(badgeId.trim().toUpperCase(), password);
  };

  const isLoading = state.phase === 'PASSWORD_VERIFYING';

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Back */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Entry Gate
        </button>

        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">IDentix</p>
            <p className="text-slate-400 text-xs">Officer Authentication</p>
          </div>
        </div>

        <h1 className="text-white text-xl font-bold mb-1">Officer Login</h1>
        <p className="text-slate-400 text-xs mb-6">
          Step 1 of 2 — Password authentication
        </p>

        {/* Error */}
        {state.error && (
          <div className="flex gap-3 p-4 bg-red-900/40 border border-red-500/50 rounded-xl mb-5 text-sm text-red-200">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>{state.error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Officer username
            </label>
            <input
              type="text"
              value={badgeId}
              onChange={(e) => setBadgeId(e.target.value)}
              placeholder="e.g. officer1"
              autoComplete="username"
              className="w-full px-4 py-3 bg-slate-800 text-white border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 font-mono uppercase text-sm"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-slate-800 text-white border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 text-sm pr-12"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !badgeId || !password}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? 'Verifying…' : 'Continue to Face Verification'}
          </button>
        </form>

        {/* Security note */}
        <p className="text-slate-600 text-xs text-center mt-6">
          Face verification is required after password authentication.
          Accounts lock after {' '}
          <span className="text-slate-500 font-semibold">5 failed attempts</span>.
        </p>

        {/* Dev hint */}
        <div className="mt-8 p-3 bg-amber-900/20 border border-amber-700/30 rounded-xl text-[11px] text-amber-400">
          <p className="font-semibold mb-1">Development accounts</p>
          <p>Officer: <code className="font-mono">officer1</code> / <code className="font-mono">password123</code></p>
        </div>
      </div>
    </div>
  );
};
