import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import type { OfficerProfile, AuthPhase, PreAuthState } from '@shared/types';
import { getCurrentOfficer, LegacyApiError, loginOfficer } from '../services/legacyApi';

const SESSION_KEY = 'identix_access_token';
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;
interface AuthState { phase: AuthPhase; officer: OfficerProfile | null; preAuth: PreAuthState | null; error: string | null; isInitializing: boolean; }
type Action = { type: 'INIT'; officer: OfficerProfile | null } | { type: 'START' } | { type: 'SUCCESS'; officer: OfficerProfile } | { type: 'FAIL'; error: string } | { type: 'LOGOUT' } | { type: 'CLEAR' };
const initial: AuthState = { phase: 'UNAUTHENTICATED', officer: null, preAuth: null, error: null, isInitializing: true };
function reducer(state: AuthState, action: Action): AuthState {
  if (action.type === 'INIT') return { ...state, isInitializing: false, phase: action.officer ? 'AUTHENTICATED' : 'UNAUTHENTICATED', officer: action.officer };
  if (action.type === 'START') return { ...state, phase: 'PASSWORD_VERIFYING', error: null };
  if (action.type === 'SUCCESS') return { ...state, phase: 'AUTHENTICATED', officer: action.officer, error: null, preAuth: null };
  if (action.type === 'FAIL') return { ...state, phase: 'UNAUTHENTICATED', error: action.error };
  if (action.type === 'LOGOUT') return { ...initial, isInitializing: false };
  return { ...state, error: null };
}
interface AuthContextValue { state: AuthState; login: (username: string, password: string) => Promise<void>; completeBiometric: (token: string, image: string) => Promise<void>; logout: () => Promise<void>; clearError: () => void; }
const AuthContext = createContext<AuthContextValue | null>(null);
const profile = (officer: { id: number; badge_number: string; full_name: string }, token: string): OfficerProfile => ({ officerId: String(officer.id), badgeId: officer.badge_number, fullName: officer.full_name, role: 'OFFICER', sessionId: `legacy-${officer.id}`, loginAt: new Date().toISOString(), biometricStatus: 'UNAVAILABLE', accessToken: token });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimeout = useCallback(() => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(() => { sessionStorage.removeItem(SESSION_KEY); dispatch({ type: 'LOGOUT' }); }, SESSION_TIMEOUT_MS); }, []);
  useEffect(() => {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) { dispatch({ type: 'INIT', officer: null }); return; }
    getCurrentOfficer().then((officer) => { dispatch({ type: 'INIT', officer: profile(officer, token) }); armTimeout(); }).catch(() => { sessionStorage.removeItem(SESSION_KEY); dispatch({ type: 'INIT', officer: null }); });
  }, [armTimeout]);
  const login = useCallback(async (username: string, password: string) => {
    dispatch({ type: 'START' });
    try { const result = await loginOfficer(username, password); sessionStorage.setItem(SESSION_KEY, result.access_token); dispatch({ type: 'SUCCESS', officer: profile(result.officer, result.access_token) }); armTimeout(); }
    catch (error) { dispatch({ type: 'FAIL', error: (error as LegacyApiError).message || 'Authentication failed.' }); }
  }, [armTimeout]);
  const completeBiometric = useCallback(async () => { dispatch({ type: 'FAIL', error: 'Officer biometric verification is unavailable on the connected legacy backend.' }); }, []);
  const logout = useCallback(async () => { if (timerRef.current) clearTimeout(timerRef.current); sessionStorage.removeItem(SESSION_KEY); dispatch({ type: 'LOGOUT' }); }, []);
  const clearError = useCallback(() => dispatch({ type: 'CLEAR' }), []);
  return <AuthContext.Provider value={{ state, login, completeBiometric, logout, clearError }}>{children}</AuthContext.Provider>;
};
export function useAuth(): AuthContextValue { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within <AuthProvider>'); return value; }
